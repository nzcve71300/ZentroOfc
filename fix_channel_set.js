const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnoseChannelSetIssue() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('🔍 Diagnosing channel-set command issue...\n');

    // Check the problematic server_id
    const problematicServerId = '1753872071391';
    
    console.log(`1. Checking if server_id ${problematicServerId} exists in rust_servers:`);
    const [serverCheck] = await connection.execute(
      'SELECT * FROM rust_servers WHERE id = ?',
      [problematicServerId]
    );
    
    if (serverCheck.length === 0) {
      console.log('❌ Server ID does NOT exist in rust_servers table');
      console.log('This is the root cause of the foreign key constraint error');
    } else {
      console.log('✅ Server ID exists in rust_servers table');
      console.log('Server details:', serverCheck[0]);
    }

    console.log('\n2. Checking all servers in rust_servers:');
    const [allServers] = await connection.execute('SELECT id, nickname, guild_id FROM rust_servers');
    console.log('Available servers:');
    allServers.forEach(server => {
      console.log(`  - ID: ${server.id}, Name: ${server.nickname}, Guild: ${server.guild_id}`);
    });

    console.log('\n3. Checking channel_settings table structure:');
    const [channelSettings] = await connection.execute('DESCRIBE channel_settings');
    console.log('Channel settings columns:');
    channelSettings.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Key ? `(${col.Key})` : ''}`);
    });

    console.log('\n4. Checking existing channel_settings:');
    const [existingSettings] = await connection.execute('SELECT * FROM channel_settings');
    console.log('Existing channel settings:');
    existingSettings.forEach(setting => {
      console.log(`  - Server: ${setting.server_id}, Type: ${setting.channel_type}, Channel: ${setting.channel_id}`);
    });

    console.log('\n5. Checking guilds table:');
    const [guilds] = await connection.execute('SELECT * FROM guilds');
    console.log('Available guilds:');
    guilds.forEach(guild => {
      console.log(`  - ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
    });

    console.log('\n🔧 RECOMMENDED FIXES:');
    console.log('1. The channel-set command is using an invalid server_id');
    console.log('2. The command should use the unified player system to get the correct server_id');
    console.log('3. The server_id should be obtained from the rust_servers table, not hardcoded');
    console.log('4. The command should validate that the server exists before trying to insert');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the diagnosis
diagnoseChannelSetIssue(); 