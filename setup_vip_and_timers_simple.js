const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupVipAndTimers() {
  console.log('🔧 Setup VIP and Timers (Simple)');
  console.log('==================================\n');

  try {
    console.log('📋 Database connection config:');
    console.log('Host:', process.env.DB_HOST);
    console.log('User:', process.env.DB_USER);
    console.log('Database:', process.env.DB_NAME);
    console.log('Port:', process.env.DB_PORT || 3306);
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Creating kit_cooldowns table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kit_cooldowns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        kit_name VARCHAR(50) NOT NULL,
        player_name VARCHAR(100) NOT NULL,
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_server_kit_player (server_id, kit_name, player_name),
        INDEX idx_claimed_at (claimed_at)
      )
    `);
    console.log('✅ kit_cooldowns table created!');

    console.log('\n📋 Step 2: Checking current autokits...');
    const [autokits] = await connection.execute('SELECT * FROM autokits');
    console.log(`Found ${autokits.length} autokit configurations`);
    
    for (const kit of autokits) {
      console.log(`- ${kit.kit_name} (cooldown: ${kit.cooldown} minutes)`);
    }

    console.log('\n📋 Step 3: Updating cooldowns...');
    // Set cooldowns for different kit types
    await connection.execute(
      'UPDATE autokits SET cooldown = ? WHERE kit_name LIKE ?',
      [30, 'FREEkit%'] // 30 minutes for free kits
    );
    
    await connection.execute(
      'UPDATE autokits SET cooldown = ? WHERE kit_name = ?',
      [60, 'VIPkit'] // 60 minutes for VIP kit
    );
    
    await connection.execute(
      'UPDATE autokits SET cooldown = ? WHERE kit_name LIKE ?',
      [120, 'ELITEkit%'] // 120 minutes for elite kits
    );
    console.log('✅ Cooldowns updated!');

    console.log('\n📋 Step 4: Checking kit_auth entries...');
    const [authEntries] = await connection.execute('SELECT * FROM kit_auth');
    console.log(`Found ${authEntries.length} kit authorization entries`);
    
    for (const entry of authEntries) {
      console.log(`- Discord ID: ${entry.discord_id}, Kitlist: ${entry.kitlist}`);
    }

    console.log('\n✅ Final verification:');
    const [finalAutokits] = await connection.execute(`
      SELECT ak.*, rs.nickname as server_name 
      FROM autokits ak 
      JOIN rust_servers rs ON ak.server_id = rs.id
      ORDER BY rs.nickname, ak.kit_name
    `);
    
    for (const kit of finalAutokits) {
      console.log(`Server: ${kit.server_name} - Kit: ${kit.kit_name} - Cooldown: ${kit.cooldown} minutes`);
    }

    await connection.end();
    console.log('\n✅ Setup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

setupVipAndTimers(); 