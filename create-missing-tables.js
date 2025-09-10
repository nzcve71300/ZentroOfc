const pool = require('./src/db/index');

async function createMissingTables() {
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    console.log('✅ Connected to database');
    
    // Create app_users table
    console.log('🔄 Creating app_users table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS app_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        discord_id VARCHAR(32) UNIQUE,
        ign VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        password_hash VARCHAR(255),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_discord_id (discord_id),
        INDEX idx_ign (ign),
        INDEX idx_email (email)
      )
    `);
    console.log('✅ app_users table created');
    
    // Create player_balances table
    console.log('🔄 Creating player_balances table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS player_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        server_id INT NOT NULL,
        balance DECIMAL(15,2) DEFAULT 0.00,
        total_spent DECIMAL(15,2) DEFAULT 0.00,
        last_transaction_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_player_server (player_id, server_id),
        INDEX idx_player_id (player_id),
        INDEX idx_server_id (server_id)
      )
    `);
    console.log('✅ player_balances table created');
    
    // Create server_events table
    console.log('🔄 Creating server_events table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS server_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT NOT NULL,
        player_id INT,
        event_type VARCHAR(100) NOT NULL,
        event_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
        INDEX idx_server_id (server_id),
        INDEX idx_player_id (player_id),
        INDEX idx_event_type (event_type),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('✅ server_events table created');
    
    // Create audit_logs table
    console.log('🔄 Creating audit_logs table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(32),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_resource_type (resource_type),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('✅ audit_logs table created');
    
    // Create views
    console.log('🔄 Creating views...');
    
    // Server stats view (using existing rust_servers table for now)
    await connection.execute(`
      CREATE OR REPLACE VIEW server_stats AS
      SELECT 
        rs.id,
        rs.guild_id,
        rs.nickname as display_name,
        'Unknown' as region,
        COUNT(p.id) as player_count,
        rs.created_at
      FROM rust_servers rs
      LEFT JOIN players p ON rs.id = p.server_id AND p.is_active = TRUE
      GROUP BY rs.id, rs.guild_id, rs.nickname, rs.created_at
    `);
    console.log('✅ server_stats view created');
    
    // Player with balance view
    await connection.execute(`
      CREATE OR REPLACE VIEW player_with_balance AS
      SELECT 
        p.id,
        p.server_id,
        p.discord_id,
        p.ign,
        p.steam_id,
        COALESCE(pb.balance, 0) as balance,
        pb.total_spent,
        pb.last_transaction_at,
        p.is_active,
        p.created_at
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id AND p.server_id = pb.server_id
    `);
    console.log('✅ player_with_balance view created');
    
    console.log('🎉 All missing tables and views created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
      console.log('✅ Connection released');
    }
  }
}

// Run if this file is executed directly
if (require.main === module) {
  createMissingTables().catch(console.error);
}

module.exports = createMissingTables;
