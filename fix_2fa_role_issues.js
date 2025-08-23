const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function diagnoseRoleIssues() {
  console.log('🔍 Diagnosing role creation issues...\n');
  
  try {
    await client.login(process.env.DISCORD_TOKEN);
    
    console.log(`✅ Bot logged in as: ${client.user.tag}\n`);
    
    // Check each guild for role creation issues
    for (const [guildId, guild] of client.guilds.cache) {
      console.log(`📋 Checking guild: ${guild.name} (ID: ${guild.id})`);
      
      // Check bot permissions
      const botMember = guild.members.cache.get(client.user.id);
      if (!botMember) {
        console.log(`   ❌ Bot not found in guild members`);
        continue;
      }
      
      const hasManageRoles = botMember.permissions.has('ManageRoles');
      console.log(`   🔑 Bot has Manage Roles permission: ${hasManageRoles ? '✅' : '❌'}`);
      
      // Check if Zentro Admin role exists
      const zentroAdminRole = guild.roles.cache.find(role => role.name === 'Zentro Admin');
      console.log(`   👑 Zentro Admin role exists: ${zentroAdminRole ? '✅' : '❌'}`);
      
      // Check if ZentroLinked role exists
      const zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
      console.log(`   🔗 ZentroLinked role exists: ${zentroLinkedRole ? '✅' : '❌'}`);
      
      // Check server verification level
      const verificationLevel = guild.verificationLevel;
      console.log(`   🛡️  Server verification level: ${verificationLevel}`);
      
      // Determine if 2FA is likely required
      const requires2FA = verificationLevel >= 3; // HIGH or VERY_HIGH
      if (requires2FA) {
        console.log(`   ⚠️  2FA likely required for role management`);
        console.log(`   💡 Solution: Enable 2FA on bot account or lower verification level`);
      }
      
      console.log('');
    }
    
    console.log('📝 Summary of issues and solutions:');
    console.log('=====================================');
    console.log('');
    console.log('🔐 2FA Issues:');
    console.log('   - Error code 60003 means "Two factor is required for this operation"');
    console.log('   - This happens when server has HIGH/VERY_HIGH verification level');
    console.log('   - Bot account needs 2FA enabled to create roles');
    console.log('');
    console.log('🔑 Permission Issues:');
    console.log('   - Error code 50013 means "Missing Permissions"');
    console.log('   - Bot needs "Manage Roles" permission in the server');
    console.log('');
    console.log('🛠️  Solutions:');
    console.log('   1. Enable 2FA on the bot account (recommended)');
    console.log('   2. Lower server verification level (server owner only)');
    console.log('   3. Ensure bot has "Manage Roles" permission');
    console.log('');
    console.log('📋 Steps to enable 2FA on bot:');
    console.log('   1. Go to Discord Developer Portal');
    console.log('   2. Find your bot application');
    console.log('   3. Enable 2FA on the bot account');
    console.log('   4. Generate new bot token with 2FA');
    console.log('   5. Update .env file with new token');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await client.destroy();
  }
}

// Run the diagnosis
diagnoseRoleIssues();

