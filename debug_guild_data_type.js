const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugGuildDataType() {
    console.log('🔍 Debugging guild discord_id data type...');
    
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
        // Check the table structure
        console.log(`\n📋 Guilds table structure:`);
        const [structure] = await pool.execute('DESCRIBE guilds');
        console.log(structure);
        
        // Check the current value with different queries
        console.log(`\n🔍 Current guild data with different queries:`);
        
        const [result1] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   Query 1 (normal):', result1);
        
        const [result2] = await pool.execute('SELECT id, CAST(discord_id AS CHAR) as discord_id, name FROM guilds WHERE id = 2');
        console.log('   Query 2 (as CHAR):', result2);
        
        const [result3] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   Query 3 (raw):', result3);
        
        // Try to update with explicit type casting
        console.log(`\n🔧 Trying update with explicit type casting...`);
        const correctGuildId = '1391149977434329230';
        
        const [updateResult] = await pool.execute(
            'UPDATE guilds SET discord_id = CAST(? AS BIGINT) WHERE id = 2',
            [correctGuildId]
        );
        console.log('   Update result:', updateResult);
        
        // Check after update
        const [after] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   After update:', after);
        
        // Try direct comparison
        console.log(`\n🔍 Direct comparison:`);
        console.log(`   Expected: ${correctGuildId} (type: ${typeof correctGuildId})`);
        console.log(`   Actual: ${after[0].discord_id} (type: ${typeof after[0].discord_id})`);
        console.log(`   Equal?: ${after[0].discord_id === correctGuildId}`);
        console.log(`   String equal?: ${String(after[0].discord_id) === correctGuildId}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

debugGuildDataType(); 