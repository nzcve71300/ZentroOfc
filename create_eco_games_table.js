const mysql = require('mysql2/promise');
require('dotenv').config();

async function createEcoGamesTable() {
  console.log('🎮 Creating eco_games table...');
  
  let pool;
  try {
    // Connect to database
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    console.log('✅ Database connected');
    
    // Create eco_games table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eco_games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        setup VARCHAR(50) NOT NULL,
        option VARCHAR(100) NOT NULL,
        option_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_config (server_id, setup, option),
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      )
    `);
    
    console.log('✅ eco_games table created successfully');
    
    // Insert default configurations for existing servers
    const [servers] = await pool.query('SELECT id FROM rust_servers');
    
    for (const server of servers) {
      // Default blackjack config
      await pool.query(`
        INSERT IGNORE INTO eco_games (server_id, setup, option, option_value) 
        VALUES (?, 'blackjack', 'min_max_bet', '1,10000')
      `, [server.id]);
      
      // Default slots config
      await pool.query(`
        INSERT IGNORE INTO eco_games (server_id, setup, option, option_value) 
        VALUES (?, 'slots', 'min_max_bet', '1,10000')
      `, [server.id]);
      
      // Default daily amount
      await pool.query(`
        INSERT IGNORE INTO eco_games (server_id, setup, option, option_value) 
        VALUES (?, 'daily', 'reward_amount', '100')
      `, [server.id]);
    }
    
    console.log(`✅ Default configurations added for ${servers.length} servers`);
    console.log('🎮 eco_games table setup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

createEcoGamesTable(); 