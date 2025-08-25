const mysql = require('mysql2/promise');
require('dotenv').config();

async function deployBountySystem() {
  console.log('🎯 Deploying Bounty System');
  console.log('==========================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Creating bounty_configs table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bounty_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        reward_amount INT DEFAULT 100,
        kills_required INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_bounty (server_id),
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ bounty_configs table created!');

    console.log('\n📋 Step 2: Creating bounty_tracking table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bounty_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        player_name VARCHAR(100) NOT NULL,
        player_id INT,
        kill_streak INT DEFAULT 0,
        is_active_bounty BOOLEAN DEFAULT FALSE,
        bounty_created_at TIMESTAMP NULL,
        bounty_claimed_at TIMESTAMP NULL,
        claimed_by VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_player (server_id, player_name),
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ bounty_tracking table created!');

    console.log('\n📋 Step 3: Creating indexes for performance...');
    await connection.execute(`
      CREATE INDEX IF NOT EXISTS idx_bounty_tracking_server_active 
      ON bounty_tracking(server_id, is_active_bounty)
    `);
    await connection.execute(`
      CREATE INDEX IF NOT EXISTS idx_bounty_tracking_player_name 
      ON bounty_tracking(player_name)
    `);
    console.log('✅ Indexes created!');

    console.log('\n📋 Step 4: Initializing bounty configs for existing servers...');
    const [servers] = await connection.execute('SELECT id FROM rust_servers');
    
    for (const server of servers) {
      // Check if bounty config already exists
      const [existingConfig] = await connection.execute(
        'SELECT id FROM bounty_configs WHERE server_id = ?',
        [server.id]
      );
      
      if (existingConfig.length === 0) {
        // Create default bounty config
        await connection.execute(
          'INSERT INTO bounty_configs (server_id, enabled, reward_amount, kills_required) VALUES (?, ?, ?, ?)',
          [server.id, false, 100, 5] // Default: disabled, 100 currency reward, 5 kills required
        );
        console.log(`✅ Created default bounty config for server ID: ${server.id}`);
      }
    }

    console.log('\n📋 Step 5: Verifying setup...');
    const [bountyConfigs] = await connection.execute('SELECT COUNT(*) as count FROM bounty_configs');
    const [bountyTracking] = await connection.execute('SELECT COUNT(*) as count FROM bounty_tracking');
    
    console.log(`✅ Bounty configs: ${bountyConfigs[0].count} servers configured`);
    console.log(`✅ Bounty tracking: ${bountyTracking[0].count} player records`);

    await connection.end();

    console.log('\n🎉 Bounty System Deployment Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Configure bounty system per server:');
    console.log('   - /eco-configs server: [ServerName] setup: Bounty System On/Off option: on');
    console.log('   - /eco-configs server: [ServerName] setup: Bounty Rewards option: [Amount]');
    console.log('3. Test the system by getting 5 kills without dying');
    console.log('4. Monitor bounty announcements and rewards');

    console.log('\n💡 Features:');
    console.log('• Players get marked as bounty after 5 kills without dying');
    console.log('• Bounty announcement with Deep Gold (#FFD700) and Dark Crimson (#8B0000) colors');
    console.log('• Text size 35-40 for visibility');
    console.log('• Only one active bounty per server at a time');
    console.log('• Discord linking required for currency rewards');
    console.log('• Automatic kill streak tracking and reset on death');

  } catch (error) {
    console.error('❌ Error deploying bounty system:', error.message);
  }
}

deployBountySystem();
