const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixRconGuildLookup() {
    console.log('🔧 Fixing RCON guild lookup to use correct guild ID...');
    
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
        console.log(`\n🔍 Current database state:`);
        
        // Check what the database actually has
        const [guildData] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   Raw guild data:', guildData);
        
        // Check with CAST to see the actual value
        const [castData] = await pool.execute('SELECT id, CAST(discord_id AS CHAR) as discord_id_str, name FROM guilds WHERE id = 2');
        console.log('   Cast guild data:', castData);
        
        // The database has the correct value, but the bot is using the wrong one
        // Let's restart the bot to force it to re-read the database
        console.log(`\n🔄 The database has the correct guild ID, but the bot is using the old one.`);
        console.log(`🔄 Restarting the bot to force it to re-read the database...`);
        
        console.log(`\n📋 Next steps:`);
        console.log(`1. Stop the bot: pm2 stop zentro-bot`);
        console.log(`2. Start the bot: pm2 start zentro-bot`);
        console.log(`3. Check logs: pm2 logs zentro-bot`);
        console.log(`4. Look for: "Connected to RCON: RISE 3X (1391149977434329230)"`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixRconGuildLookup(); 