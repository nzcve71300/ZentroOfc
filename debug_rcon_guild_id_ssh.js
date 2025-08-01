const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔍 SSH: Debugging RCON guild_id usage...');

// Use the same database configuration as the bot
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zentro_bot',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function debugRconGuildId() {
  const pool = await mysql.createPool(dbConfig);
  
  try {
    // Test cases
    const testCases = [
      { guildId: '1391149977434329230', serverName: 'Rise 3x' },
      { guildId: '1342235198175182921', serverName: 'EMPEROR 3X' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 Testing RCON queries for: ${testCase.serverName} in guild ${testCase.guildId}`);
      console.log(`${'='.repeat(60)}`);
      
      // Test 1: Direct guild_id usage (wrong pattern)
      console.log(`\n🔍 Test 1: Direct guild_id usage (WRONG pattern):`);
      const [wrongResult] = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
        [testCase.guildId, testCase.serverName]
      );
      
      if (wrongResult.length === 0) {
        console.log('❌ No results with direct guild_id usage (this is expected to fail)');
      } else {
        console.log(`⚠️  Found ${wrongResult.length} results with direct guild_id usage (this shouldn't happen)`);
      }
      
      // Test 2: Correct pattern with subquery
      console.log(`\n🔍 Test 2: Correct pattern with subquery:`);
      const [correctResult] = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [testCase.guildId, testCase.serverName]
      );
      
      if (correctResult.length === 0) {
        console.log('❌ No results with correct pattern (this is the issue!)');
      } else {
        console.log(`✅ Found ${correctResult.length} results with correct pattern`);
        console.log(`✅ Server ID: ${correctResult[0].id}`);
      }
      
      // Test 3: Check if there are any servers with the Discord guild_id as guild_id
      console.log(`\n🔍 Test 3: Check for servers with Discord guild_id as guild_id:`);
      const [discordGuildResult] = await pool.query(
        'SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = ?',
        [testCase.guildId]
      );
      
      if (discordGuildResult.length === 0) {
        console.log('✅ No servers found with Discord guild_id as guild_id (good)');
      } else {
        console.log(`⚠️  Found ${discordGuildResult.length} servers with Discord guild_id as guild_id:`);
        discordGuildResult.forEach(server => {
          console.log(`  - ${server.nickname} (guild_id: ${server.guild_id})`);
        });
      }
      
      // Test 4: Check what guild_id the server actually has
      console.log(`\n🔍 Test 4: Check server's actual guild_id:`);
      const [serverInfo] = await pool.query(
        'SELECT id, nickname, guild_id FROM rust_servers WHERE nickname = ?',
        [testCase.serverName]
      );
      
      if (serverInfo.length === 0) {
        console.log('❌ Server not found by nickname');
      } else {
        console.log(`📋 Servers with nickname "${testCase.serverName}":`);
        serverInfo.forEach(server => {
          console.log(`  - ID: ${server.id}, Guild ID: ${server.guild_id}`);
          
          // Check what guild this guild_id belongs to
          const [guildInfo] = await pool.query(
            'SELECT id, discord_id FROM guilds WHERE id = ?',
            [server.guild_id]
          );
          
          if (guildInfo.length > 0) {
            console.log(`    → Guild Discord ID: ${guildInfo[0].discord_id}`);
          } else {
            console.log(`    → Guild not found in guilds table!`);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugRconGuildId().catch(console.error); 