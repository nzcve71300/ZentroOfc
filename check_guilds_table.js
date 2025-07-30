const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkGuildsTable() {
    console.log('🔍 Checking guilds table...');
    
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
        // Check all guilds
        console.log(`\n📋 All guilds in database:`);
        const [allGuilds] = await pool.execute('SELECT id, discord_id, name FROM guilds');
        console.log(allGuilds);

        // Check the specific guild we're working with
        console.log(`\n🔍 Checking guild with name 'RISE 3X':`);
        const [riseGuild] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE name = ?', ['RISE 3X']);
        console.log(riseGuild);

        // Check what servers are associated with guild ID 2
        console.log(`\n🔍 Servers associated with guild ID 2:`);
        const [servers] = await pool.execute('SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = 2');
        console.log(servers);

        // Check what discord_id is being used for guild ID 2
        console.log(`\n🔍 Discord ID for guild ID 2:`);
        const [guildDiscord] = await pool.execute('SELECT discord_id FROM guilds WHERE id = 2');
        console.log(guildDiscord);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkGuildsTable(); 