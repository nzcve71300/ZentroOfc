const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

class MySQLMigrate {
  constructor() {
    this.connection = null;
    this.migrations = [];
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
      console.log('✅ Connected to MySQL database for migration');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('✅ Disconnected from MySQL database');
    }
  }

  async createMigrationsTable() {
    try {
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          migration_name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_migration_name (migration_name)
        )
      `);
      console.log('✅ Migrations table created/verified');
    } catch (error) {
      console.error('❌ Failed to create migrations table:', error.message);
      throw error;
    }
  }

  async getExecutedMigrations() {
    try {
      const [rows] = await this.connection.execute(
        'SELECT migration_name FROM migrations ORDER BY executed_at'
      );
      return rows.map(row => row.migration_name);
    } catch (error) {
      console.error('❌ Failed to get executed migrations:', error.message);
      return [];
    }
  }

  async executeMigration(migrationName, sql) {
    try {
      console.log(`🔄 Executing migration: ${migrationName}`);
      
      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement) {
          try {
            await this.connection.execute(statement);
          } catch (error) {
            // Ignore errors for existing tables/columns
            if (!error.message.includes('already exists') && 
                !error.message.includes('Duplicate column name')) {
              console.error(`❌ Error executing statement: ${error.message}`);
              throw error;
            }
          }
        }
      }

      // Record migration as executed
      await this.connection.execute(
        'INSERT INTO migrations (migration_name) VALUES (?)',
        [migrationName]
      );

      console.log(`✅ Migration completed: ${migrationName}`);
    } catch (error) {
      console.error(`❌ Migration failed: ${migrationName}`, error.message);
      throw error;
    }
  }

  async runMigrations() {
    try {
      await this.connect();
      await this.createMigrationsTable();

      const executedMigrations = await this.getExecutedMigrations();
      console.log(`📋 Found ${executedMigrations.length} executed migrations`);

      // Define migrations
      const migrations = [
        {
          name: '001_create_subscription_tables',
          sql: `
            CREATE TABLE IF NOT EXISTS subscriptions (
              id INT AUTO_INCREMENT PRIMARY KEY,
              guild_id BIGINT UNSIGNED NOT NULL,
              user_id BIGINT UNSIGNED NOT NULL,
              subscription_type ENUM('premium', 'vip', 'elite') NOT NULL,
              start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              end_date TIMESTAMP NULL,
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_user_subscription (guild_id, user_id)
            )
          `
        },
        {
          name: '002_add_active_columns',
          sql: `
            ALTER TABLE night_skip_configs ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
            ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
            ALTER TABLE teleport_configs ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
            ALTER TABLE home_teleport_configs ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
            ALTER TABLE zorp_configs ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
            ALTER TABLE recycler_configs ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
            ALTER TABLE prison_configs ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
          `
        },
        {
          name: '003_create_config_tables',
          sql: `
            CREATE TABLE IF NOT EXISTS night_skip_configs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              server_id VARCHAR(32) NOT NULL,
              enabled BOOLEAN DEFAULT TRUE,
              active BOOLEAN DEFAULT TRUE,
              vote_threshold INT DEFAULT 3,
              cooldown_minutes INT DEFAULT 30,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_server_night_skip (server_id)
            );
            
            CREATE TABLE IF NOT EXISTS event_configs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              server_id VARCHAR(32) NOT NULL,
              event_type ENUM('bradley', 'helicopter', 'cargo', 'chinook') NOT NULL,
              enabled BOOLEAN DEFAULT TRUE,
              active BOOLEAN DEFAULT TRUE,
              notification_channel_id BIGINT UNSIGNED NULL,
              notification_message TEXT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_server_event (server_id, event_type)
            );
          `
        }
      ];

      // Execute pending migrations
      for (const migration of migrations) {
        if (!executedMigrations.includes(migration.name)) {
          await this.executeMigration(migration.name, migration.sql);
        } else {
          console.log(`⏭️  Skipping already executed migration: ${migration.name}`);
        }
      }

      console.log('🎉 All migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration process failed:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  async rollbackMigration(migrationName) {
    try {
      await this.connect();
      
      // Remove migration record
      await this.connection.execute(
        'DELETE FROM migrations WHERE migration_name = ?',
        [migrationName]
      );
      
      console.log(`✅ Rolled back migration: ${migrationName}`);
    } catch (error) {
      console.error(`❌ Failed to rollback migration: ${migrationName}`, error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  async getMigrationStatus() {
    try {
      await this.connect();
      const executedMigrations = await this.getExecutedMigrations();
      
      console.log('📋 Migration Status:');
      executedMigrations.forEach((migration, index) => {
        console.log(`   ${index + 1}. ${migration}`);
      });
      
      return executedMigrations;
    } catch (error) {
      console.error('❌ Failed to get migration status:', error.message);
      return [];
    } finally {
      await this.disconnect();
    }
  }
}

// Export the class and a convenience function
module.exports = MySQLMigrate;

// Convenience function for running migrations
async function runMigrations() {
  const migrator = new MySQLMigrate();
  await migrator.runMigrations();
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations().catch(console.error);
}
