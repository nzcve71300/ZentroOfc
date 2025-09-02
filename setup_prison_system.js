const pool = require('./src/db');

async function setupPrisonSystem() {
  try {
    console.log('🔧 Setting up Prison System');
    console.log('============================\n');

    // Create prison system tables
    console.log('1. Creating prison system tables...');
    
    // Create prison_configs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prison_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_server_config (server_id)
      )
    `);
    console.log('✅ prison_configs table created/verified');

    // Create prison_positions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prison_positions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        cell_number INT NOT NULL,
        x_pos DECIMAL(10,2) NOT NULL,
        y_pos DECIMAL(10,2) NOT NULL,
        z_pos DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_server_cell (server_id, cell_number)
      )
    `);
    console.log('✅ prison_positions table created/verified');

    // Create prisoners table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prisoners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        discord_id VARCHAR(32) NULL,
        cell_number INT NOT NULL,
        sentence_type ENUM('temporary', 'life') NOT NULL,
        sentence_minutes INT NULL,
        release_time TIMESTAMP NULL,
        sentenced_by VARCHAR(255) NOT NULL,
        sentenced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        released_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_active_prisoner (server_id, player_name, is_active)
      )
    `);
    console.log('✅ prisoners table created/verified');

    // Create indexes for better performance
    console.log('2. Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_prison_configs_server ON prison_configs(server_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_prison_positions_server ON prison_positions(server_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_prison_positions_cell ON prison_positions(cell_number)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_prisoners_server ON prisoners(server_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_prisoners_player ON prisoners(player_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_prisoners_active ON prisoners(is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_prisoners_release_time ON prisoners(release_time)');
    console.log('✅ All indexes created/verified');

    // Initialize prison configs for all existing servers
    console.log('3. Initializing prison configs for existing servers...');
    const [servers] = await pool.query('SELECT id FROM rust_servers');
    
    for (const server of servers) {
      try {
        await pool.query(
          'INSERT IGNORE INTO prison_configs (server_id, enabled) VALUES (?, false)',
          [server.id]
        );
      } catch (error) {
        console.log(`⚠️ Could not initialize prison config for server ${server.id}: ${error.message}`);
      }
    }
    console.log(`✅ Initialized prison configs for ${servers.length} servers`);

    // Check for any existing prisoners
    console.log('4. Checking for existing prisoners...');
    const [prisoners] = await pool.query('SELECT COUNT(*) as count FROM prisoners WHERE is_active = TRUE');
    console.log(`📊 Found ${prisoners[0].count} active prisoners in database`);

    console.log('\n✅ Prison System setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Use `/set Prison-System on` to enable the prison system for each server');
    console.log('2. Use `/manage-positions` to set up prison cell coordinates (Prison-Cell-1 through Prison-Cell-6)');
    console.log('3. Use `/temp-prison` to imprison players temporarily');
    console.log('4. Use `/life-sentence` to imprison players permanently');
    console.log('5. Use `/release` to release players from prison');
    console.log('6. Use `/view-prisoners` to see all currently imprisoned players');

  } catch (error) {
    console.error('❌ Error setting up prison system:', error);
  } finally {
    await pool.end();
  }
}

setupPrisonSystem();
