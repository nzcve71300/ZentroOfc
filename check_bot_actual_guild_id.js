const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkBotActualGuildId() {
    console.log('🔍 Checking what guild ID the bot is actually using...');
    
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
        // First, get the server info
        const [servers] = await pool.execute('SELECT * FROM rust_servers');
        console.log(`\n📡 Found ${servers.length} servers in database:`, servers);
        
        if (servers.length === 0) {
            console.log('❌ No servers found!');
            return;
        }
        
        // For each server, simulate the bot's guild ID lookup
        for (const server of servers) {
            console.log(`\n🔍 Checking server: ${server.nickname}`);
            console.log(`   Server guild_id: ${server.guild_id}`);
            
            // This is the exact query the bot uses
            const [guildResult] = await pool.execute('SELECT discord_id FROM guilds WHERE id = ?', [server.guild_id]);
            
            if (guildResult.length === 0) {
                console.log(`❌ No guild found for guild_id: ${server.guild_id}`);
            } else {
                const botGuildId = guildResult[0].discord_id;
                console.log(`✅ Bot is using guild_id: ${botGuildId}`);
                
                // Test if this guild ID works for server lookup
                const [serverTest] = await pool.execute(
                    'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
                    [botGuildId, server.nickname]
                );
                
                if (serverTest.length === 0) {
                    console.log(`❌ Server lookup fails with bot's guild_id: ${botGuildId}`);
                } else {
                    console.log(`✅ Server lookup works with bot's guild_id: ${botGuildId}`);
                }
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkBotActualGuildId(); 