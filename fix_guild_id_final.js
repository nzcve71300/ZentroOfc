const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixGuildIdFinal() {
    console.log('🔧 FINAL FIX: Updating guild discord_id...');
    
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        const correctGuildId = '1391149977434329230';
        
        console.log('\n🔍 Current guild data:');
        const [currentGuilds] = await pool.execute('SELECT * FROM guilds');
        console.log(currentGuilds);
        
        console.log(`\n🔧 Updating guild ID 2 discord_id to: ${correctGuildId}`);
        
        const [result] = await pool.execute(
            'UPDATE guilds SET discord_id = ? WHERE id = 2',
            [correctGuildId]
        );
        
        console.log(`Updated ${result.affectedRows} rows`);
        
        console.log('\n✅ Updated guild data:');
        const [updatedGuilds] = await pool.execute('SELECT * FROM guilds');
        console.log(updatedGuilds);
        
        // Test bot lookup
        console.log('\n🧪 Testing bot lookup:');
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

fixGuildIdFinal(); 