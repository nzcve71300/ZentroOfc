const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function checkNotefeedConfig() {
  let connection;
  
  try {
    console.log('🔍 Checking notefeed configuration...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected');
    
    // Check all channel settings
    console.log('\n📋 All channel settings:');
    const [allSettings] = await connection.execute(
      'SELECT cs.*, rs.nickname, g.discord_id FROM channel_settings cs JOIN rust_servers rs ON cs.server_id = rs.id JOIN guilds g ON rs.guild_id = g.id ORDER BY rs.nickname, cs.channel_type'
    );
    
    allSettings.forEach(setting => {
      console.log(`   - ${setting.nickname}: ${setting.channel_type} -> ${setting.channel_id}`);
    });
    
    // Check specifically for notefeed
    console.log('\n📋 Notefeed settings:');
    const [notefeedSettings] = await connection.execute(
      'SELECT cs.*, rs.nickname, g.discord_id FROM channel_settings cs JOIN rust_servers rs ON cs.server_id = rs.id JOIN guilds g ON rs.guild_id = g.id WHERE cs.channel_type = "notefeed"'
    );
    
    if (notefeedSettings.length === 0) {
      console.log('❌ No notefeed channel configured!');
      console.log('\n💡 To fix this, use the /channel-set command in Discord:');
      console.log('   - Server: Select your server');
      console.log('   - Channel: Select the channel where you want notefeed messages');
      console.log('   - Channel Type: Choose "Note feed (Text Channel)"');
    } else {
      notefeedSettings.forEach(setting => {
        console.log(`   ✅ ${setting.nickname}: notefeed -> ${setting.channel_id}`);
      });
    }
    
    // Check if any servers are missing notefeed
    console.log('\n📋 Servers missing notefeed configuration:');
    const [serversWithoutNotefeed] = await connection.execute(
      `SELECT rs.nickname, rs.id, g.discord_id 
       FROM rust_servers rs 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE NOT EXISTS (
         SELECT 1 FROM channel_settings cs 
         WHERE cs.server_id = rs.id AND cs.channel_type = 'notefeed'
       )`
    );
    
    if (serversWithoutNotefeed.length === 0) {
      console.log('   ✅ All servers have notefeed configuration');
    } else {
      serversWithoutNotefeed.forEach(server => {
        console.log(`   ❌ ${server.nickname} (${server.id}) - missing notefeed`);
      });
    }
    
    console.log('\n✅ Configuration check completed');
    
  } catch (error) {
    console.error('❌ Error checking configuration:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
checkNotefeedConfig(); 