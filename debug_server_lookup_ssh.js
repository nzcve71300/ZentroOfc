const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔍 SSH: Debugging server lookup issues...');

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

async function debugServerLookup() {
  const pool = await mysql.createPool(dbConfig);
  
  try {
    // Test cases
    const testCases = [
      { guildId: '1391149977434329230', serverName: 'Rise 3x' },
      { guildId: '1342235198175182921', serverName: 'EMPEROR 3X' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 Testing: ${testCase.serverName} in guild ${testCase.guildId}`);
      console.log(`${'='.repeat(60)}`);
      
      // Test guild lookup
      console.log(`\n🔍 Testing guild lookup for Discord ID: ${testCase.guildId}`);
      const [guildResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [testCase.guildId]);
      
      if (guildResult.length === 0) {
        console.log('❌ Guild not found in database!');
        console.log('💡 This means the guild needs to be added to the guilds table.');
        continue;
      }
      
      const guildId = guildResult[0].id;
      console.log(`✅ Guild found! Database guild_id: ${guildId}`);
      
      console.log(`\n🔍 Testing server lookup for: ${testCase.serverName} in guild_id: ${guildId}`);
      const [serverResult] = await pool.query(
        'SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
        [guildId, testCase.serverName]
      );
      
      if (serverResult.length === 0) {
        console.log('❌ Server not found!');
        console.log(`\n🔍 Let's check what servers exist for this guild:`);
        const [allServers] = await pool.query(
          'SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = ?',
          [guildId]
        );
        
        if (allServers.length === 0) {
          console.log('❌ No servers found for this guild!');
        } else {
          console.log('📋 Servers in this guild:');
          allServers.forEach(server => {
            console.log(`  - ${server.nickname} (ID: ${server.id})`);
          });
        }
        
        console.log(`\n💡 The server "${testCase.serverName}" needs to be added to the rust_servers table for guild_id: ${guildId}`);
      } else {
        console.log(`✅ Server found! ID: ${serverResult[0].id}`);
        console.log(`✅ Server nickname: ${serverResult[0].nickname}`);
        console.log(`✅ Guild ID: ${serverResult[0].guild_id}`);
      }
      
      // Test the exact query that's failing
      console.log(`\n🔍 Testing the exact query that's failing:`);
      const [exactResult] = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [testCase.guildId, testCase.serverName]
      );
      
      if (exactResult.length === 0) {
        console.log('❌ Exact query returns no results - this is the issue!');
      } else {
        console.log(`✅ Exact query works! Server ID: ${exactResult[0].id}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugServerLookup().catch(console.error); 