const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkBotGuildId() {
    console.log('🔍 Checking what guild ID the bot is using...');
    
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
        // Test the exact query that handleKitClaim uses
        const guildId = '1391149977434329230'; // The correct guild ID
        const serverName = 'RISE 3X';
        
        console.log(`\n🔍 Testing handleKitClaim query:`);
        console.log(`   Guild ID: ${guildId}`);
        console.log(`   Server Name: ${serverName}`);
        
        // Test the exact query from handleKitClaim
        const [serverResult] = await pool.execute(
            'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
            [guildId, serverName]
        );
        
        console.log(`   Query result:`, serverResult);
        
        if (serverResult.length === 0) {
            console.log('❌ Query returned no results!');
            
            // Debug step by step
            console.log(`\n🔍 Debugging step by step:`);
            
            // Step 1: Check guild lookup
            const [guildResult] = await pool.execute('SELECT id FROM guilds WHERE discord_id = ?', [guildId]);
            console.log(`   Guild lookup:`, guildResult);
            
            if (guildResult.length === 0) {
                console.log('❌ Guild not found with discord_id:', guildId);
                
                // Check what guilds exist
                const [allGuilds] = await pool.execute('SELECT id, discord_id, name FROM guilds');
                console.log(`   All guilds:`, allGuilds);
            } else {
                const guildId_db = guildResult[0].id;
                console.log(`✅ Guild found with ID: ${guildId_db}`);
                
                // Step 2: Check server lookup
                const [serverCheck] = await pool.execute(
                    'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
                    [guildId_db, serverName]
                );
                console.log(`   Server lookup:`, serverCheck);
                
                if (serverCheck.length === 0) {
                    console.log('❌ Server not found for guild_id:', guildId_db, 'and nickname:', serverName);
                    
                    // Check what servers exist
                    const [allServers] = await pool.execute('SELECT * FROM rust_servers');
                    console.log(`   All servers:`, allServers);
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

checkBotGuildId(); 