const mysql = require('mysql2/promise');
require('dotenv').config();

async function finalFixGuildId() {
    console.log('🔧 FINAL FIX - Directly updating guild discord_id...');
    
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
        
        console.log(`\n🔧 BEFORE FIX:`);
        const [before] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   Current guild data:', before);
        
        console.log(`\n🔧 UPDATING guild ID 2 to discord_id: ${correctGuildId}`);
        
        // Use a direct query without parameters to avoid any type issues
        const [result] = await pool.execute(
            `UPDATE guilds SET discord_id = ${correctGuildId} WHERE id = 2`
        );
        
        console.log('   Update result:', result);
        
        console.log(`\n🔧 AFTER FIX:`);
        const [after] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   Updated guild data:', after);
        
        // Fix the comparison - use strict equality and convert to string
        const actualGuildId = String(after[0].discord_id);
        const expectedGuildId = String(correctGuildId);
        
        console.log(`   Expected: ${expectedGuildId}`);
        console.log(`   Actual: ${actualGuildId}`);
        
        if (actualGuildId === expectedGuildId) {
            console.log('✅ SUCCESS! Guild discord_id is now correct.');
            console.log('🔄 Now restart your bot: pm2 restart zentro-bot');
        } else {
            console.log('❌ FAILED! Guild discord_id is still wrong.');
            console.log('🔄 The database update did not work. Trying alternative method...');
            
            // Try alternative method - delete and reinsert
            console.log('\n🔧 Trying alternative method - delete and reinsert...');
            await pool.execute('DELETE FROM guilds WHERE id = 2');
            await pool.execute(
                'INSERT INTO guilds (id, discord_id, name) VALUES (2, ?, ?)',
                [correctGuildId, 'RISE 3X']
            );
            
            const [finalCheck] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
            console.log('   Final guild data:', finalCheck);
            
            if (String(finalCheck[0].discord_id) === correctGuildId) {
                console.log('✅ SUCCESS! Guild discord_id is now correct.');
                console.log('🔄 Now restart your bot: pm2 restart zentro-bot');
            } else {
                console.log('❌ FAILED! Database update is not working.');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

finalFixGuildId(); 