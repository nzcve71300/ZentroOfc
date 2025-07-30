const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkServers() {
    console.log('🔍 Checking servers in database...');
    
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
        // Check all servers
        console.log(`\n📋 All servers in database:`);
        const [allServers] = await pool.execute('SELECT * FROM rust_servers');
        console.log(allServers);
        
        // Check servers for guild ID 2
        console.log(`\n🔍 Servers for guild ID 2:`);
        const [guildServers] = await pool.execute('SELECT * FROM rust_servers WHERE guild_id = 2');
        console.log(guildServers);
        
        // Check if there are any servers at all
        console.log(`\n📊 Server count:`);
        const [count] = await pool.execute('SELECT COUNT(*) as total FROM rust_servers');
        console.log(`   Total servers: ${count[0].total}`);
        
        // Check guilds
        console.log(`\n📋 All guilds:`);
        const [guilds] = await pool.execute('SELECT * FROM guilds');
        console.log(guilds);
        
        // Check if the bot's query is working
        console.log(`\n🔍 Testing the bot's exact query:`);
        const [botQuery] = await pool.execute('SELECT * FROM rust_servers');
        console.log(`   Bot query result: ${botQuery.length} servers found`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkServers(); 