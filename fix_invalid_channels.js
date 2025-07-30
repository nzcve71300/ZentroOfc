const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixInvalidChannels() {
  let connection;
  
  try {
    console.log('🔧 Fixing invalid channel configurations...\n');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('1. Checking current channel settings...');
    
    // Get all channel settings
    const [channelSettings] = await connection.execute(`
      SELECT cs.*, rs.nickname, g.discord_id, g.name as guild_name
      FROM channel_settings cs
      JOIN rust_servers rs ON cs.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
    `);

    if (channelSettings.length === 0) {
      console.log('❌ No channel settings found!');
      console.log('   → Use /channel-set to configure channels');
      return;
    }

    console.log('✅ Found channel settings:');
    channelSettings.forEach(setting => {
      console.log(`   - ${setting.guild_name}: ${setting.nickname} -> ${setting.channel_type} (${setting.channel_id})`);
    });

    console.log('\n2. Identifying potentially invalid channel IDs...');
    console.log('   The error shows channel ID 1396872848748052500 is invalid.');
    console.log('   This suggests the channel may have been deleted or the ID is incorrect.');
    
    // Find the problematic channel setting
    const problematicSetting = channelSettings.find(cs => cs.channel_id === '1396872848748052500');
    
    if (problematicSetting) {
      console.log(`\n⚠️  Found problematic setting:`);
      console.log(`   - Guild: ${problematicSetting.guild_name}`);
      console.log(`   - Server: ${problematicSetting.nickname}`);
      console.log(`   - Type: ${problematicSetting.channel_type}`);
      console.log(`   - Channel ID: ${problematicSetting.channel_id}`);
      
      console.log('\n3. Recommendations:');
      console.log('   Option 1: Delete the invalid channel setting');
      console.log('   Option 2: Update it with a valid channel ID');
      console.log('   Option 3: Reconfigure using /channel-set');
      
      console.log('\n4. To fix this:');
      console.log('   1. Go to your Discord server');
      console.log('   2. Find the correct channel for this type');
      console.log('   3. Right-click the channel and "Copy ID"');
      console.log('   4. Use /channel-set to reconfigure');
      console.log('   5. Or delete this setting and recreate it');
      
      // Ask if user wants to delete the problematic setting
      console.log('\n5. SQL to delete the problematic setting:');
      console.log(`   DELETE FROM channel_settings WHERE channel_id = '1396872848748052500';`);
      
      console.log('\n6. Or update with a new channel ID:');
      console.log(`   UPDATE channel_settings SET channel_id = 'NEW_CHANNEL_ID' WHERE channel_id = '1396872848748052500';`);
      
    } else {
      console.log('\n✅ No problematic channel ID found in database.');
      console.log('   The error might be from a different source.');
    }

    console.log('\n7. All channel settings in database:');
    channelSettings.forEach(cs => {
      console.log(`   - ${cs.channel_type}: ${cs.channel_id} (${cs.guild_name} -> ${cs.nickname})`);
    });

    console.log('\n8. Next steps:');
    console.log('   1. Check if these channel IDs exist in Discord');
    console.log('   2. Use /channel-set to reconfigure any invalid channels');
    console.log('   3. Test with /test-message after fixing');
    console.log('   4. Check bot permissions in each channel');

  } catch (error) {
    console.error('❌ Error during channel fix:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixInvalidChannels(); 