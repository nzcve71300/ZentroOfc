const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugChannelLoading() {
  console.log('🔍 Debugging Channel Configuration Loading\n');
  
  let connection;
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✅ Database connected');
    
    // Check what's in the database
    console.log('\n📋 Database contents:');
    const [settings] = await connection.execute('SELECT * FROM channel_settings ORDER BY channel_type');
    console.log(`Found ${settings.length} channel settings:`);
    settings.forEach(setting => {
      console.log(`   - ${setting.channel_type}: ${setting.channel_id} (Server: ${setting.server_id})`);
    });
    
    // Test the query that the bot uses
    console.log('\n🔍 Testing bot query logic:');
    
    // Simulate the bot's channel lookup
    const serverId = '1753872071391_i24dewly';
    const channelTypes = ['adminfeed', 'playercount', 'playerfeed', 'notefeed'];
    
    for (const channelType of channelTypes) {
      console.log(`\nLooking for ${channelType}:`);
      
      const [result] = await connection.execute(
        'SELECT * FROM channel_settings WHERE server_id = ? AND channel_type = ?',
        [serverId, channelType]
      );
      
      if (result.length > 0) {
        console.log(`   ✅ Found: ${result[0].channel_id}`);
      } else {
        console.log(`   ❌ Not found`);
      }
    }
    
    // Check if there are any issues with the server_id
    console.log('\n🔍 Checking server_id variations:');
    const [allServers] = await connection.execute('SELECT DISTINCT server_id FROM channel_settings');
    console.log('All server_ids in database:');
    allServers.forEach(server => {
      console.log(`   - "${server.server_id}"`);
    });
    
    // Test exact match
    console.log(`\nTesting exact match for server_id: "${serverId}"`);
    const [exactMatch] = await connection.execute(
      'SELECT * FROM channel_settings WHERE server_id = ?',
      [serverId]
    );
    console.log(`Found ${exactMatch.length} settings for this server`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

debugChannelLoading(); 