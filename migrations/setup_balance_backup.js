const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupBalanceBackup() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔧 Setting up balance backup system...');

    // Create backup table for player balances
    console.log('📋 Creating player_balance_backup table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS player_balance_backup (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id INT NOT NULL,
        server_id VARCHAR(32) NOT NULL,
        discord_id BIGINT NOT NULL,
        ign VARCHAR(255) NOT NULL,
        normalized_ign VARCHAR(128) NOT NULL,
        balance INT NOT NULL DEFAULT 0,
        backed_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        restored_at TIMESTAMP NULL,
        INDEX idx_backup_guild_discord (guild_id, discord_id),
        INDEX idx_backup_server_ign (server_id, normalized_ign),
        INDEX idx_backup_restored (restored_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);

    // Add comment to explain the table purpose
    await connection.execute(`
      ALTER TABLE player_balance_backup 
      COMMENT = 'Backup table for player balances before unlinking - allows balance restoration when re-linking'
    `);

    console.log('✅ Balance backup table created successfully');

    // Verify the table was created
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'player_balance_backup'
    `);
    
    if (tables.length > 0) {
      console.log('✅ Table verification successful');
      
      // Show table structure
      const [structure] = await connection.execute(`
        DESCRIBE player_balance_backup
      `);
      console.log('📋 Table structure:', structure);
    } else {
      throw new Error('Failed to create or verify the backup table');
    }

    console.log('🎉 Balance backup system setup completed successfully!');

  } catch (error) {
    console.error('❌ Error setting up balance backup system:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the migration
if (require.main === module) {
  setupBalanceBackup()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = setupBalanceBackup;
