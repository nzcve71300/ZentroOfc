const mysql = require('mysql2/promise');
require('dotenv').config();

async function nukeAndRecreate() {
    console.log('💥 NUKING AND RECREATING GUILD...');
    
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        const correctGuildId = '1391149977434329230';
        
        console.log('\n🔍 Current state:');
        const [currentGuilds] = await pool.execute('SELECT * FROM guilds');
        console.log('Guilds:', currentGuilds);
        
        const [currentServers] = await pool.execute('SELECT * FROM rust_servers');
        console.log('Servers:', currentServers);
        
        console.log('\n💥 DELETING PROBLEMATIC GUILD...');
        
        // Delete the server first (foreign key constraint)
        const [deleteServerResult] = await pool.execute('DELETE FROM rust_servers WHERE guild_id = 2');
        console.log(`Deleted ${deleteServerResult.affectedRows} servers`);
        
        // Delete the guild
        const [deleteGuildResult] = await pool.execute('DELETE FROM guilds WHERE id = 2');
        console.log(`Deleted ${deleteGuildResult.affectedRows} guilds`);
        
        console.log('\n🔄 RECREATING GUILD WITH CORRECT ID...');
        
        // Recreate guild with correct discord_id
        const [insertGuildResult] = await pool.execute(
            'INSERT INTO guilds (id, discord_id, name) VALUES (?, ?, ?)',
            [2, correctGuildId, 'Zentro Guild']
        );
        console.log(`Created guild with ID: ${insertGuildResult.insertId}`);
        
        // Recreate server
        const [insertServerResult] = await pool.execute(
            'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password) VALUES (?, ?, ?, ?, ?, ?)',
            ['1753903193841_vjvln23oi', 2, 'RISE 3X', '149.102.132.219', 30216, 'JPMGiS0u']
        );
        console.log(`Created server with ID: ${insertServerResult.insertId}`);
        
        console.log('\n✅ FINAL STATE:');
        const [finalGuilds] = await pool.execute('SELECT * FROM guilds');
        console.log('Guilds:', finalGuilds);
        
        const [finalServers] = await pool.execute('SELECT * FROM rust_servers');
        console.log('Servers:', finalServers);
        
        // Test bot lookup
        console.log('\n🧪 TESTING BOT LOOKUP:');
        const [guildResult] = await pool.execute('SELECT discord_id FROM guilds WHERE id = 2');
        if (guildResult.length > 0) {
            const botGuildId = guildResult[0].discord_id;
            console.log(`Bot will use guild_id: ${botGuildId}`);
            
            const [serverTest] = await pool.execute(
                'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
                [botGuildId, 'RISE 3X']
            );
            
            if (serverTest.length > 0) {
                console.log('✅ SERVER LOOKUP WORKS!');
            } else {
                console.log('❌ Server lookup still fails');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

nukeAndRecreate(); 