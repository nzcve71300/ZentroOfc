const mysql = require('mysql2/promise');
require('dotenv').config();

async function testExactQuery() {
    console.log('🔍 Testing exact query from handleKitClaim function...');
    
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const guildId = '1391149977434329230';
        const serverName = 'RISE 3X';

        console.log(`\n📋 Test Parameters:`);
        console.log(`   Guild ID: ${guildId}`);
        console.log(`   Server Name: ${serverName}`);

        // Test the exact query from handleKitClaim
        console.log(`\n🔍 Testing exact query from handleKitClaim...`);
        const [serverResult] = await pool.execute(
            'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
            [guildId, serverName]
        );
        
        console.log(`   Query result:`, serverResult);

        if (serverResult.length === 0) {
            console.log('❌ Query returned no results!');
            
            // Let's debug step by step
            console.log(`\n🔍 Debugging step by step...`);
            
            // Step 1: Check guild lookup
            const [guildResult] = await pool.execute('SELECT id FROM guilds WHERE discord_id = ?', [guildId]);
            console.log(`   Guild lookup result:`, guildResult);
            
            if (guildResult.length === 0) {
                console.log('❌ Guild not found with discord_id:', guildId);
                
                // Check what guilds exist
                const [allGuilds] = await pool.execute('SELECT id, discord_id, name FROM guilds');
                console.log(`   All guilds in database:`, allGuilds);
            } else {
                const guildId_db = guildResult[0].id;
                console.log(`✅ Guild found with ID: ${guildId_db}`);
                
                // Step 2: Check server lookup
                const [serverCheck] = await pool.execute(
                    'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
                    [guildId_db, serverName]
                );
                console.log(`   Server lookup result:`, serverCheck);
                
                if (serverCheck.length === 0) {
                    console.log('❌ Server not found for guild_id:', guildId_db, 'and nickname:', serverName);
                    
                    // Check what servers exist for this guild
                    const [allServers] = await pool.execute(
                        'SELECT id, nickname FROM rust_servers WHERE guild_id = ?',
                        [guildId_db]
                    );
                    console.log(`   All servers for this guild:`, allServers);
                } else {
                    console.log('✅ Server found!');
                }
            }
        } else {
            console.log('✅ Query returned results!');
            console.log(`   Server ID: ${serverResult[0].id}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

testExactQuery(); 