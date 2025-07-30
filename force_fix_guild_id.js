const mysql = require('mysql2/promise');
require('dotenv').config();

async function forceFixGuildId() {
    console.log('🔧 Force fixing guild discord_id...');
    
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
        
        console.log(`\n🔧 Current state before fix:`);
        const [before] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   Before:', before);
        
        console.log(`\n🔧 Force updating guild ID 2 to discord_id: ${correctGuildId}`);
        
        // Force the update with explicit transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Update the guild discord_id
            const [result] = await connection.execute(
                'UPDATE guilds SET discord_id = ? WHERE id = 2',
                [correctGuildId]
            );
            
            console.log('   Update result:', result);
            
            // Commit the transaction
            await connection.commit();
            console.log('✅ Transaction committed!');
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
        // Verify the fix
        console.log(`\n🔍 Verifying the fix...`);
        const [after] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   After:', after);
        
        if (after[0].discord_id === correctGuildId) {
            console.log('✅ Fix verified! Guild discord_id is now correct.');
        } else {
            console.log('❌ Fix failed! Guild discord_id is still wrong.');
            console.log(`   Expected: ${correctGuildId}`);
            console.log(`   Actual: ${after[0].discord_id}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

forceFixGuildId(); 