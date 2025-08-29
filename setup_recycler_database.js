const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔧 Setting up Recycler System Database...');
console.log('========================================\n');

async function setupRecyclerDatabase() {
  let connection;
  
  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });
    
    console.log('✅ Database connection established\n');

    // 1. Create recycler_configs table
    console.log('📋 Step 1: Creating recycler_configs table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS recycler_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        use_list BOOLEAN DEFAULT FALSE,
        cooldown_minutes INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server (server_id)
      )
    `);
    console.log('✅ recycler_configs table created/verified');

    // 2. Create recycler_allowed_users table
    console.log('\n📋 Step 2: Creating recycler_allowed_users table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS recycler_allowed_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        discord_id VARCHAR(255),
        ign VARCHAR(255),
        added_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_server (server_id, discord_id, ign)
      )
    `);
    console.log('✅ recycler_allowed_users table created/verified');

    // 3. Create recycler_cooldowns table
    console.log('\n📋 Step 3: Creating recycler_cooldowns table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS recycler_cooldowns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_player_server (server_id, player_name)
      )
    `);
    console.log('✅ recycler_cooldowns table created/verified');

    // 4. Create indexes for better performance
    console.log('\n📋 Step 4: Creating database indexes...');
    
    // Check if indexes exist before creating
    const [existingIndexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'recycler_configs' 
      AND INDEX_NAME LIKE 'idx_recycler_%'
    `);
    
    const existingIndexNames = existingIndexes.map(idx => idx.INDEX_NAME);
    
    if (!existingIndexNames.includes('idx_recycler_configs_server')) {
      await connection.execute('CREATE INDEX idx_recycler_configs_server ON recycler_configs(server_id)');
      console.log('✅ Created index: idx_recycler_configs_server');
    } else {
      console.log('ℹ️ Index already exists: idx_recycler_configs_server');
    }
    
    if (!existingIndexNames.includes('idx_recycler_allowed_server')) {
      await connection.execute('CREATE INDEX idx_recycler_allowed_server ON recycler_allowed_users(server_id)');
      console.log('✅ Created index: idx_recycler_allowed_server');
    } else {
      console.log('ℹ️ Index already exists: idx_recycler_allowed_server');
    }
    
    if (!existingIndexNames.includes('idx_recycler_cooldowns_server')) {
      await connection.execute('CREATE INDEX idx_recycler_cooldowns_server ON recycler_cooldowns(server_id)');
      console.log('✅ Created index: idx_recycler_cooldowns_server');
    } else {
      console.log('ℹ️ Index already exists: idx_recycler_cooldowns_server');
    }
    
    if (!existingIndexNames.includes('idx_recycler_cooldowns_player')) {
      await connection.execute('CREATE INDEX idx_recycler_cooldowns_player ON recycler_cooldowns(player_name)');
      console.log('✅ Created index: idx_recycler_cooldowns_player');
    } else {
      console.log('ℹ️ Index already exists: idx_recycler_cooldowns_player');
    }

    // 5. Verify tables were created
    console.log('\n📋 Step 5: Verifying tables...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME LIKE 'recycler_%'
      ORDER BY TABLE_NAME
    `);

    console.log('✅ Found recycler tables:');
    tables.forEach(table => {
      console.log(`   • ${table.TABLE_NAME}`);
    });

    // 6. Show table structures
    console.log('\n📋 Step 6: Table structures...');
    
    console.log('\n📊 recycler_configs structure:');
    const [configColumns] = await connection.execute('DESCRIBE recycler_configs');
    configColumns.forEach(col => {
      console.log(`   • ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Default ? `[default: ${col.Default}]` : ''}`);
    });
    
    console.log('\n📊 recycler_allowed_users structure:');
    const [allowedColumns] = await connection.execute('DESCRIBE recycler_allowed_users');
    allowedColumns.forEach(col => {
      console.log(`   • ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Default ? `[default: ${col.Default}]` : ''}`);
    });
    
    console.log('\n📊 recycler_cooldowns structure:');
    const [cooldownColumns] = await connection.execute('DESCRIBE recycler_cooldowns');
    cooldownColumns.forEach(col => {
      console.log(`   • ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Default ? `[default: ${col.Default}]` : ''}`);
    });

    // 7. Show configuration commands
    console.log('\n📋 Step 7: Configuration Commands...');
    console.log('⚙️ Enable recycler system:');
    console.log('   /set RECYCLER-USE on <server>');
    console.log('   /set RECYCLER-USELIST on <server>');
    console.log('   /set RECYCLER-TIME 10 <server>');
    console.log('');
    console.log('👥 Add players to recycler list:');
    console.log('   /add-to-list RECYCLERLIST <player> <server>');
    console.log('');
    console.log('🎮 In-game usage:');
    console.log('   Use emote: d11_quick_chat_orders_slot_2 (📋 orders emote)');
    console.log('   Works in: LOCAL, TEAM, or SERVER chat');

    console.log('\n🎉 Recycler Database Setup Complete!');
    console.log('====================================');
    console.log('✅ All tables created successfully');
    console.log('✅ Indexes created for performance');
    console.log('✅ Ready for recycler system configuration');
    console.log('');
    console.log('🔄 Next steps:');
    console.log('   1. Restart your bot: pm2 restart zentro-bot');
    console.log('   2. Configure servers: /set RECYCLER-USE on <server>');
    console.log('   3. Add allowed players: /add-to-list RECYCLERLIST <player> <server>');
    console.log('   4. Test in-game: Use the orders emote');

  } catch (error) {
    console.error('❌ Error setting up recycler database:', error);
    console.error('Error details:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Database access denied. Check your .env file:');
      console.log('   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Could not connect to database. Check if MySQL is running.');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n📡 Database connection closed');
    }
  }
}

// Run the setup
setupRecyclerDatabase().then(() => {
  console.log('\n✅ Setup completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Setup failed:', error);
  process.exit(1);
});
