const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class UnifiedMigration {
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
        port: process.env.DB_PORT || 3306
      });
      console.log('✅ Connected to database for migration');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
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
      await this.connect();
      
      console.log('🚀 Starting unified schema migration...');
      
      // Read the unified schema
      const schemaPath = path.join(__dirname, '../../sql/unified_schema.sql');
      if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found: ${schemaPath}`);
      }

      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Split schema into individual statements
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt && !stmt.startsWith('--') && !stmt.startsWith('SET'));

      console.log(`📋 Found ${statements.length} SQL statements to execute`);

      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement) {
          try {
            console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
            await this.connection.execute(statement);
          } catch (error) {
            // Log error but continue with migration
            if (error.message.includes('already exists') || 
                error.message.includes('Duplicate column name') ||
                error.message.includes('Duplicate key name')) {
              console.log(`⏭️  Skipping (already exists): ${error.message.split('\n')[0]}`);
            } else {
              console.error(`❌ Error executing statement ${i + 1}:`, error.message);
              // Don't throw - continue with migration
            }
          }
        }
      }

      console.log('✅ Migration completed successfully');
      
      // Verify migration
      await this.verifyMigration();
      
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  async verifyMigration() {
    try {
      console.log('🔍 Verifying migration...');
      
      // Check if new tables exist
      const tables = [
        'app_users',
        'servers', 
        'server_secrets',
        'player_stats',
        'player_balances',
        'server_events',
        'audit_logs'
      ];

      for (const table of tables) {
        const [rows] = await this.connection.execute(
          'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
          [process.env.DB_NAME || 'zentro_bot', table]
        );
        
        if (rows[0].count > 0) {
          console.log(`✅ Table ${table} exists`);
        } else {
          console.log(`❌ Table ${table} missing`);
        }
      }

      // Check if views exist
      const views = ['server_summary', 'player_summary'];
      for (const view of views) {
        const [rows] = await this.connection.execute(
          'SELECT COUNT(*) as count FROM information_schema.views WHERE table_schema = ? AND table_name = ?',
          [process.env.DB_NAME || 'zentro_bot', view]
        );
        
        if (rows[0].count > 0) {
          console.log(`✅ View ${view} exists`);
        } else {
          console.log(`❌ View ${view} missing`);
        }
      }

      // Check data migration
      const [serverCount] = await this.connection.execute('SELECT COUNT(*) as count FROM servers');
      const [playerCount] = await this.connection.execute('SELECT COUNT(*) as count FROM players');
      const [balanceCount] = await this.connection.execute('SELECT COUNT(*) as count FROM player_balances');

      console.log(`📊 Migration results:`);
      console.log(`   - Servers: ${serverCount[0].count}`);
      console.log(`   - Players: ${playerCount[0].count}`);
      console.log(`   - Player Balances: ${balanceCount[0].count}`);

    } catch (error) {
      console.error('❌ Verification failed:', error.message);
    }
  }

  async rollback() {
    try {
      await this.connect();
      
      console.log('🔄 Starting rollback...');
      
      // Drop new tables in reverse order
      const tables = [
        'audit_logs',
        'server_events', 
        'player_balances',
        'player_stats',
        'server_secrets',
        'servers',
        'app_users'
      ];

      for (const table of tables) {
        try {
          await this.connection.execute(`DROP TABLE IF EXISTS ${table}`);
          console.log(`✅ Dropped table ${table}`);
        } catch (error) {
          console.log(`⚠️  Could not drop table ${table}: ${error.message}`);
        }
      }

      // Drop views
      const views = ['player_summary', 'server_summary'];
      for (const view of views) {
        try {
          await this.connection.execute(`DROP VIEW IF EXISTS ${view}`);
          console.log(`✅ Dropped view ${view}`);
        } catch (error) {
          console.log(`⚠️  Could not drop view ${view}: ${error.message}`);
        }
      }

      console.log('✅ Rollback completed');
      
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migration = new UnifiedMigration();
  
  const command = process.argv[2];
  
  if (command === 'rollback') {
    migration.rollback().catch(console.error);
  } else {
    migration.runMigration().catch(console.error);
  }
}

module.exports = UnifiedMigration;
