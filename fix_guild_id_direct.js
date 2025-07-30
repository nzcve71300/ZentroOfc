const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixGuildIdDirect() {
    console.log('🔧 Directly fixing guild discord_id...');
    
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
        const correctGuildId = '1391149977434329230';
        
        console.log(`\n🔧 Updating guild ID 2 to discord_id: ${correctGuildId}`);
        
        // Update the guild discord_id
        await pool.execute(
            'UPDATE guilds SET discord_id = ? WHERE id = 2',
            [correctGuildId]
        );
        
        console.log('✅ Guild discord_id updated!');
        
        // Verify the fix
        const [verify] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('📋 Updated guild data:', verify);
        
        if (verify[0].discord_id === correctGuildId) {
            console.log('✅ Fix verified! Guild discord_id is now correct.');
        } else {
            console.log('❌ Fix failed! Guild discord_id is still wrong.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixGuildIdDirect(); 