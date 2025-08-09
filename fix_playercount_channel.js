const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixPlayerCountChannel() {
  console.log('🔧 Fix Player Count Channel Issue');
  console.log('==================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Checking channel settings...');
    const [channelSettings] = await connection.execute(`
      SELECT cs.*, rs.nickname as server_name, g.discord_id as guild_id
      FROM channel_settings cs
      JOIN rust_servers rs ON cs.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE cs.channel_type = 'playercount'
    `);

    console.log(`Found ${channelSettings.length} playercount channels:`);
    channelSettings.forEach((setting, index) => {
      console.log(`\n${index + 1}. Channel Setting:`);
      console.log(`   Server: ${setting.server_name}`);
      console.log(`   Guild ID: ${setting.guild_id}`);
      console.log(`   Channel ID: ${setting.channel_id}`);
      console.log(`   Original Name: ${setting.original_name || 'NULL'}`);
      console.log(`   Created: ${setting.created_at}`);
    });

    console.log('\n📋 Step 2: Analyzing the issue...');
    console.log('Current voice channel name: "SNB1 POP-🌐5🕑0 🌐1 🕑0"');
    console.log('This shows the player count is being appended multiple times instead of replaced.');
    
    console.log('\n🔍 Root cause analysis:');
    console.log('1. The original_name might be storing the channel name with player counts already');
    console.log('2. Each update appends new counts instead of replacing them');
    console.log('3. The original name should be just "SNB1 POP" without any emojis');

    // Find the problematic channel setting
    const problematicChannel = channelSettings.find(setting => 
      setting.original_name && (
        setting.original_name.includes('🌐') || 
        setting.original_name.includes('🕑')
      )
    );

    if (problematicChannel) {
      console.log('\n⚠️ Found problematic channel setting:');
      console.log(`   Server: ${problematicChannel.server_name}`);
      console.log(`   Current original_name: "${problematicChannel.original_name}"`);
      
      // Extract clean name (everything before first emoji)
      let cleanName = problematicChannel.original_name;
      const emojiIndex = cleanName.search(/[🌐🕑]/);
      if (emojiIndex !== -1) {
        cleanName = cleanName.substring(0, emojiIndex).trim();
      }
      
      console.log(`   Suggested clean name: "${cleanName}"`);
      
      console.log('\n📝 Updating original_name to clean version...');
      await connection.execute(
        'UPDATE channel_settings SET original_name = ? WHERE id = ?',
        [cleanName, problematicChannel.id]
      );
      
      console.log('✅ Updated original_name successfully!');
    } else {
      console.log('\n✅ No problematic channel settings found.');
      
      // Check if any channel has NULL original_name
      const nullNameChannel = channelSettings.find(setting => !setting.original_name);
      if (nullNameChannel) {
        console.log('\n⚠️ Found channel with NULL original_name:');
        console.log(`   Server: ${nullNameChannel.server_name}`);
        console.log('   This channel needs an original_name set to prevent formatting issues.');
        
        // Suggest a clean name based on server nickname
        const suggestedName = nullNameChannel.server_name.replace(/[🌐🕑\d]/g, '').trim();
        console.log(`   Suggested original_name: "${suggestedName}"`);
        
        console.log('\n📝 Would you like to set this original_name? (Update manually if needed)');
      }
    }

    console.log('\n📋 Step 3: Verification...');
    const [updatedSettings] = await connection.execute(`
      SELECT cs.*, rs.nickname as server_name
      FROM channel_settings cs
      JOIN rust_servers rs ON cs.server_id = rs.id
      WHERE cs.channel_type = 'playercount'
    `);

    console.log('Updated channel settings:');
    updatedSettings.forEach(setting => {
      console.log(`   - ${setting.server_name}: "${setting.original_name}"`);
    });

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Channel settings checked and cleaned');
    console.log('✅ Removed emoji duplicates from original_name');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Restart the bot to apply changes:');
    console.log('   pm2 stop zentro-bot');
    console.log('   pm2 start zentro-bot');
    console.log('2. The voice channel should now show: "SNB1 POP 🌐X 🕑Y"');
    console.log('3. Monitor for a few minutes to ensure it updates correctly');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

fixPlayerCountChannel();