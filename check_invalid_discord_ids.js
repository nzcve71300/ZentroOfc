const { Client, GatewayIntentBits } = require('discord.js');
const pool = require('./src/db');
require('dotenv').config();

console.log('🔍 CHECKING FOR INVALID DISCORD IDs');
console.log('===================================\n');

async function checkInvalidDiscordIds() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences
    ],
    partials: ['GuildMember']
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected to Discord');
    
    await new Promise(resolve => {
      client.once('ready', () => {
        console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
        console.log(`📋 Cached ${client.guilds.cache.size} guilds\n`);
        resolve();
      });
    });

    // Get all active linked players from database
    const [linkedPlayers] = await pool.query(`
      SELECT DISTINCT 
        p.discord_id,
        p.ign,
        g.discord_id as guild_discord_id,
        g.name as guild_name
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id IS NOT NULL 
      AND p.is_active = true
      ORDER BY g.name, p.ign
    `);

    console.log(`📋 Found ${linkedPlayers.length} active linked players\n`);

    let validUsers = [];
    let invalidUsers = [];
    let totalChecked = 0;

    // Check each Discord ID
    for (const player of linkedPlayers) {
      totalChecked++;
      console.log(`🔍 Checking ${player.ign} (${player.discord_id}) - ${Math.round((totalChecked/linkedPlayers.length)*100)}%`);
      
      try {
        // Try to fetch user info from Discord API
        const user = await client.users.fetch(player.discord_id);
        if (user) {
          validUsers.push({
            ...player,
            username: user.tag
          });
          console.log(`  ✅ Valid user: ${user.tag}`);
        }
      } catch (error) {
        if (error.code === 10013) {
          console.log(`  ❌ Invalid Discord ID: ${player.discord_id} (Unknown User)`);
          invalidUsers.push({
            ...player,
            error: 'Unknown User (10013)'
          });
        } else {
          console.log(`  ❌ Error checking ${player.discord_id}: ${error.message}`);
          invalidUsers.push({
            ...player,
            error: error.message
          });
        }
      }
    }

    console.log('\n📊 VALIDATION SUMMARY');
    console.log('=====================');
    console.log(`Total checked: ${totalChecked}`);
    console.log(`Valid users: ${validUsers.length}`);
    console.log(`Invalid users: ${invalidUsers.length}`);

    if (invalidUsers.length > 0) {
      console.log('\n❌ INVALID DISCORD IDs FOUND:');
      console.log('=============================');
      invalidUsers.forEach(user => {
        console.log(`  ${user.ign} (${user.discord_id}) - ${user.guild_name} - ${user.error}`);
      });

      console.log('\n💡 RECOMMENDATIONS:');
      console.log('===================');
      console.log('1. These users likely deleted their Discord accounts or left the servers');
      console.log('2. You can either:');
      console.log('   a) Remove their discord_id (set to NULL) to allow them to relink');
      console.log('   b) Deactivate their accounts (set is_active = false)');
      console.log('   c) Leave them as-is if you want to keep the data');
      
      console.log('\n🔧 To clean up invalid IDs, run:');
      console.log('   UPDATE players SET discord_id = NULL WHERE discord_id IN (');
      invalidUsers.forEach((user, index) => {
        console.log(`     '${user.discord_id}'${index < invalidUsers.length - 1 ? ',' : ''}`);
      });
      console.log('   );');
    } else {
      console.log('\n✅ All Discord IDs are valid!');
    }

    console.log('\n🎯 VALID USERS (can receive ZentroLinked role):');
    console.log('===============================================');
    validUsers.forEach(user => {
      console.log(`  ${user.ign} (${user.username}) - ${user.guild_name}`);
    });

  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

checkInvalidDiscordIds();
