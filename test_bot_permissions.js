const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

console.log('🔍 TESTING BOT PERMISSIONS FOR ROLE MANAGEMENT');
console.log('==============================================\n');

async function testBotPermissions() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences
    ]
  });

  try {
    // Connect to Discord
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected to Discord');
    
    // Wait for the client to be ready
    await new Promise(resolve => {
      client.once('ready', () => {
        console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
        console.log(`📋 Cached ${client.guilds.cache.size} guilds\n`);
        resolve();
      });
    });

    // Test each guild
    for (const [guildId, guild] of client.guilds.cache) {
      console.log(`🏠 Testing guild: ${guild.name} (${guildId})`);
      
      // Check if bot is a member
      const botMember = guild.members.cache.get(client.user.id);
      if (!botMember) {
        console.log(`  ❌ Bot is not a member of this guild`);
        continue;
      }

      // Check permissions
      const permissions = botMember.permissions;
      const requiredPermissions = [
        PermissionsBitField.Flags.ManageRoles,
        PermissionsBitField.Flags.ManageNicknames
      ];

      console.log(`  👤 Bot permissions:`);
      console.log(`     Manage Roles: ${permissions.has(PermissionsBitField.Flags.ManageRoles) ? '✅' : '❌'}`);
      console.log(`     Manage Nicknames: ${permissions.has(PermissionsBitField.Flags.ManageNicknames) ? '✅' : '❌'}`);
      
      // Check bot's highest role position
      const botHighestRole = botMember.roles.highest;
      console.log(`  🏆 Bot's highest role: ${botHighestRole.name} (position: ${botHighestRole.position})`);
      
      // Check if ZentroLinked role already exists
      const existingRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
      if (existingRole) {
        console.log(`  🔗 ZentroLinked role exists: ${existingRole.name} (position: ${existingRole.position})`);
        console.log(`     Can manage this role: ${botHighestRole.position > existingRole.position ? '✅' : '❌'}`);
      } else {
        console.log(`  🔗 ZentroLinked role: Does not exist (will be created)`);
      }
      
      console.log('');
    }

    console.log('✅ Permission test completed!');
    console.log('\n💡 If you see ❌ for Manage Roles or Manage Nicknames, the bot needs these permissions.');
    console.log('💡 If the bot cannot manage the ZentroLinked role, it may be positioned too high in the role hierarchy.');

  } catch (error) {
    console.error('❌ Permission test failed:', error);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

// Run the test
testBotPermissions();
