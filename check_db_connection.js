const mysql = require('mysql2/promise');

async function checkConnection() {
  let connection;
  
  try {
    console.log('🔍 Checking database connection...');
    
    // Try default MariaDB settings
    const config = {
      host: 'localhost',
      user: 'zentro_user',
      password: 'zentro_password',
      database: 'zentro_bot',
      port: 3306
    };
    
    console.log('📋 Using default config:', {
      host: config.host,
      user: config.user,
      database: config.database,
      port: config.port
    });
    
    connection = await mysql.createConnection(config);
    console.log('✅ Database connection successful');
    
    // Check tables
    console.log('\n📋 Checking tables...');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`📊 Found ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });
    
    // Check if event_configs exists
    const eventConfigsExists = tables.some(table => Object.values(table)[0] === 'event_configs');
    console.log(`\n📋 event_configs table: ${eventConfigsExists ? '✅ EXISTS' : '❌ MISSING'}`);
    
    // Check if channel_settings exists
    const channelSettingsExists = tables.some(table => Object.values(table)[0] === 'channel_settings');
    console.log(`📋 channel_settings table: ${channelSettingsExists ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (!eventConfigsExists || !channelSettingsExists) {
      console.log('\n💡 Missing tables detected. This explains why events and channels are not working.');
    }
    
    // Check for invalid channel IDs
    if (channelSettingsExists) {
      console.log('\n🔍 Checking for invalid channel IDs...');
      const [invalidChannels] = await connection.execute(`
        SELECT cs.*, rs.nickname 
        FROM channel_settings cs 
        JOIN rust_servers rs ON cs.server_id = rs.id 
        WHERE cs.channel_id = '1400098668123783200'
      `);
      
      if (invalidChannels.length > 0) {
        console.log(`❌ Found ${invalidChannels.length} invalid channel IDs`);
        invalidChannels.forEach(channel => {
          console.log(`  - Server: ${channel.nickname}, Type: ${channel.channel_type}, Channel ID: ${channel.channel_id}`);
        });
      } else {
        console.log('✅ No invalid channel IDs found');
      }
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n💡 Possible solutions:');
    console.log('1. Make sure MariaDB is running');
    console.log('2. Check if the database exists: zentro_bot');
    console.log('3. Check if the user exists: zentro_user');
    console.log('4. Check the password: zentro_password');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkConnection(); 