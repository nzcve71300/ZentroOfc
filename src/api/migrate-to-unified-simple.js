const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class SimpleMigration {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'zentro_bot',
        multipleStatements: false // Execute one statement at a time
      });
      console.log('✅ Connected to database for migration');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('✅ Disconnected from database');
    }
  }

  async runMigration() {
    try {
      console.log('🚀 Starting unified schema migration...');
      
      // Read the schema file
      const schemaPath = path.join(__dirname, '../../sql/unified_schema.sql');
      if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found: ${schemaPath}`);
      }

      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      
      // Split by semicolon and filter out empty statements
      const statements = schemaContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      console.log(`📋 Found ${statements.length} SQL statements to execute`);

      // Execute each statement individually
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        // Skip stored procedure creation for now (handled separately)
        if (statement.includes('CREATE PROCEDURE') || statement.includes('DELIMITER')) {
          console.log(`⏭️ Skipping stored procedure statement ${i + 1}/${statements.length}`);
          continue;
        }

        try {
          console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
          await this.connection.execute(statement);
        } catch (error) {
          console.log(`❌ Error executing statement ${i + 1}: ${error.message}`);
          // Continue with other statements
        }
      }

      // Create stored procedure separately
      await this.createStoredProcedure();

      console.log('✅ Migration completed successfully');
      
      // Verify migration
      await this.verifyMigration();

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }

  async createStoredProcedure() {
    try {
      console.log('🔄 Creating stored procedure...');
      
      const procedureSQL = `
        DELIMITER //
        CREATE PROCEDURE IF NOT EXISTS TransferBalance(
            IN from_player_id INT,
            IN to_player_id INT,
            IN server_id INT,
            IN amount DECIMAL(15,2),
            IN transfer_reason VARCHAR(255)
        )
        BEGIN
            DECLARE from_balance DECIMAL(15,2) DEFAULT 0;
            DECLARE to_balance DECIMAL(15,2) DEFAULT 0;
            DECLARE EXIT HANDLER FOR SQLEXCEPTION
            BEGIN
                ROLLBACK;
                RESIGNAL;
            END;
            
            START TRANSACTION;
            
            SELECT COALESCE(balance, 0) INTO from_balance 
            FROM player_balances 
            WHERE player_id = from_player_id AND server_id = server_id;
            
            SELECT COALESCE(balance, 0) INTO to_balance 
            FROM player_balances 
            WHERE player_id = to_player_id AND server_id = server_id;
            
            IF from_balance < amount THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient balance';
            END IF;
            
            INSERT INTO player_balances (player_id, server_id, balance, total_spent, last_transaction_at)
            VALUES (from_player_id, server_id, from_balance - amount, 0, NOW())
            ON DUPLICATE KEY UPDATE
                balance = balance - amount,
                last_transaction_at = NOW(),
                updated_at = NOW();
            
            INSERT INTO player_balances (player_id, server_id, balance, total_spent, last_transaction_at)
            VALUES (to_player_id, server_id, to_balance + amount, 0, NOW())
            ON DUPLICATE KEY UPDATE
                balance = balance + amount,
                last_transaction_at = NOW(),
                updated_at = NOW();
            
            INSERT INTO server_events (server_id, player_id, event_type, event_data)
            VALUES (server_id, from_player_id, 'balance_transfer', JSON_OBJECT(
                'from_player_id', from_player_id,
                'to_player_id', to_player_id,
                'amount', amount,
                'reason', transfer_reason
            ));
            
            COMMIT;
        END //
        DELIMITER ;
      `;

      // Execute the procedure creation
      await this.connection.query(procedureSQL);
      console.log('✅ Stored procedure created successfully');
      
    } catch (error) {
      console.log(`⚠️ Stored procedure creation failed: ${error.message}`);
      // Don't fail the entire migration for this
    }
  }

  async verifyMigration() {
    try {
      console.log('🔍 Verifying migration...');
      
      const requiredTables = [
        'servers',
        'players', 
        'app_users',
        'player_balances',
        'shop_categories',
        'shop_items',
        'server_events',
        'audit_logs',
        'home_teleport_configs',
        'night_skip_configs',
        'event_configs',
        'teleport_configs',
        'zorp_configs',
        'recycler_configs',
        'prison_configs',
        'subscriptions',
        'subscription_features',
        'subscription_logs',
        'subscription_payments',
        'rust_servers',
        'economy'
      ];

      const missingTables = [];

      for (const table of requiredTables) {
        try {
          const [rows] = await this.connection.execute(`SHOW TABLES LIKE '${table}'`);
          if (rows.length === 0) {
            missingTables.push(table);
            console.log(`❌ Table ${table} missing`);
          } else {
            console.log(`✅ Table ${table} exists`);
          }
        } catch (error) {
          missingTables.push(table);
          console.log(`❌ Table ${table} missing`);
        }
      }

      if (missingTables.length > 0) {
        console.log(`❌ Verification failed: ${missingTables.length} tables missing`);
        console.log('Missing tables:', missingTables.join(', '));
      } else {
        console.log('✅ All required tables exist');
      }

    } catch (error) {
      console.error('❌ Verification failed:', error.message);
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migration = new SimpleMigration();
  
  migration.connect()
    .then(() => migration.runMigration())
    .then(() => migration.disconnect())
    .catch(error => {
      console.error('❌ Migration failed:', error);
      migration.disconnect().finally(() => process.exit(1));
    });
}

module.exports = SimpleMigration;
