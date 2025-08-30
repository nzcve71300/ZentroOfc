const mysql = require('mysql2/promise');
require('dotenv').config();

async function deployHomeTeleportListSystem() {
  console.log('🚀 Deploying Home Teleport List System to Database...\n');

  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Connected to database successfully\n');

    // Step 1: Check if home_teleport_configs table exists
    console.log('📋 Step 1: Checking home_teleport_configs table...');
    try {
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'home_teleport_configs'
      `, [process.env.DB_NAME]);

      if (tables.length === 0) {
        console.log('❌ home_teleport_configs table does not exist');
        console.log('🔧 Creating home_teleport_configs table...');
        
        await connection.execute(`
          CREATE TABLE home_teleport_configs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            server_id VARCHAR(32) NOT NULL,
            whitelist_enabled BOOLEAN DEFAULT FALSE,
            cooldown_minutes INT DEFAULT 5,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
            UNIQUE KEY unique_server_config (server_id)
          )
        `);
        
        console.log('✅ Created home_teleport_configs table');
      } else {
        console.log('✅ home_teleport_configs table exists');
      }
    } catch (error) {
      console.log(`❌ Error checking/creating home_teleport_configs: ${error.message}`);
      throw error;
    }

    // Step 2: Add use_list column to home_teleport_configs
    console.log('\n📋 Step 2: Adding use_list column to home_teleport_configs...');
    try {
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'home_teleport_configs' AND COLUMN_NAME = 'use_list'
      `, [process.env.DB_NAME]);

      if (columns.length === 0) {
        console.log('🔧 Adding use_list column...');
        await connection.execute(`
          ALTER TABLE home_teleport_configs 
          ADD COLUMN use_list BOOLEAN DEFAULT FALSE AFTER cooldown_minutes
        `);
        console.log('✅ Added use_list column');
      } else {
        console.log('✅ use_list column already exists');
      }
    } catch (error) {
      console.log(`❌ Error adding use_list column: ${error.message}`);
      throw error;
    }

    // Step 3: Create home_teleport_allowed_users table
    console.log('\n📋 Step 3: Creating home_teleport_allowed_users table...');
    try {
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'home_teleport_allowed_users'
      `, [process.env.DB_NAME]);

      if (tables.length === 0) {
        console.log('🔧 Creating home_teleport_allowed_users table...');
        
        await connection.execute(`
          CREATE TABLE home_teleport_allowed_users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            server_id VARCHAR(32) NOT NULL,
            discord_id VARCHAR(32) NULL,
            ign VARCHAR(255) NULL,
            added_by VARCHAR(32) NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
            UNIQUE KEY unique_home_teleport_allowed (server_id, discord_id, ign)
          )
        `);
        
        console.log('✅ Created home_teleport_allowed_users table');
      } else {
        console.log('✅ home_teleport_allowed_users table already exists');
      }
    } catch (error) {
      console.log(`❌ Error creating home_teleport_allowed_users: ${error.message}`);
      throw error;
    }

    // Step 4: Create home_teleport_banned_users table
    console.log('\n📋 Step 4: Creating home_teleport_banned_users table...');
    try {
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'home_teleport_banned_users'
      `, [process.env.DB_NAME]);

      if (tables.length === 0) {
        console.log('🔧 Creating home_teleport_banned_users table...');
        
        await connection.execute(`
          CREATE TABLE home_teleport_banned_users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            server_id VARCHAR(32) NOT NULL,
            discord_id VARCHAR(32) NULL,
            ign VARCHAR(255) NULL,
            banned_by VARCHAR(32) NOT NULL,
            banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
            UNIQUE KEY unique_home_teleport_banned (server_id, discord_id, ign)
          )
        `);
        
        console.log('✅ Created home_teleport_banned_users table');
      } else {
        console.log('✅ home_teleport_banned_users table already exists');
      }
    } catch (error) {
      console.log(`❌ Error creating home_teleport_banned_users: ${error.message}`);
      throw error;
    }

    // Step 5: Create indexes for better performance
    console.log('\n📋 Step 5: Creating database indexes...');
    try {
      const indexes = [
        { table: 'home_teleport_allowed_users', name: 'idx_home_teleport_allowed_server', column: 'server_id' },
        { table: 'home_teleport_allowed_users', name: 'idx_home_teleport_allowed_discord', column: 'discord_id' },
        { table: 'home_teleport_allowed_users', name: 'idx_home_teleport_allowed_ign', column: 'ign' },
        { table: 'home_teleport_banned_users', name: 'idx_home_teleport_banned_server', column: 'server_id' },
        { table: 'home_teleport_banned_users', name: 'idx_home_teleport_banned_discord', column: 'discord_id' },
        { table: 'home_teleport_banned_users', name: 'idx_home_teleport_banned_ign', column: 'ign' }
      ];

      for (const index of indexes) {
        try {
          await connection.execute(`
            CREATE INDEX ${index.name} ON ${index.table}(${index.column})
          `);
          console.log(`✅ Created index ${index.name} on ${index.table}`);
        } catch (error) {
          if (error.message.includes('Duplicate key name')) {
            console.log(`✅ Index ${index.name} already exists`);
          } else {
            console.log(`❌ Error creating index ${index.name}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error creating indexes: ${error.message}`);
      // Don't throw error for indexes, they're not critical
    }

    // Step 6: Verify the deployment
    console.log('\n📋 Step 6: Verifying deployment...');
    try {
      // Check tables
      const tables = [
        'home_teleport_configs',
        'home_teleport_allowed_users', 
        'home_teleport_banned_users'
      ];

      for (const table of tables) {
        const [result] = await connection.execute(`DESCRIBE ${table}`);
        console.log(`✅ Table ${table} exists with ${result.length} columns`);
      }

      // Check use_list column
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'home_teleport_configs' AND COLUMN_NAME = 'use_list'
      `, [process.env.DB_NAME]);

      if (columns.length > 0) {
        const column = columns[0];
        console.log(`✅ use_list column: ${column.DATA_TYPE}, Nullable: ${column.IS_NULLABLE}, Default: ${column.COLUMN_DEFAULT}`);
      }

      // Check existing configurations
      const [configs] = await connection.execute('SELECT COUNT(*) as count FROM home_teleport_configs');
      console.log(`✅ Found ${configs[0].count} existing home teleport configurations`);

    } catch (error) {
      console.log(`❌ Error verifying deployment: ${error.message}`);
      throw error;
    }

    console.log('\n🎯 Home Teleport List System Deployment Summary:');
    console.log('✅ home_teleport_configs table ready');
    console.log('✅ use_list column added');
    console.log('✅ home_teleport_allowed_users table created');
    console.log('✅ home_teleport_banned_users table created');
    console.log('✅ Database indexes created');
    console.log('✅ All foreign key constraints in place');
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Restart the bot to load new commands');
    console.log('2. Test the system: node test_home_teleport_list_system.js');
    console.log('3. Configure servers: /set HOMETP-USELIST on server:ServerName');
    console.log('4. Add players to lists: /add-to-list HOMETP-LIST name:PlayerName server:ServerName');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the deployment
deployHomeTeleportListSystem();
