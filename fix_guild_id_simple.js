const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixGuildId() {
    console.log('🔧 Fixing guild discord_id...');
    
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        const correctGuildId = '1391149977434329230';
        
        console.log(`Updating guild ID 2 to discord_id: ${correctGuildId}`);
        
        const [result] = await pool.execute(
            'UPDATE guilds SET discord_id = ? WHERE id = 2',
            [correctGuildId]
        );
        
        console.log(`Updated ${result.affectedRows} rows`);
        
        // Verify the update
        const [guilds] = await pool.execute('SELECT * FROM guilds');
        console.log('Updated guilds:', guilds);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixGuildId(); 