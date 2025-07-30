const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkBigIntPrecision() {
    console.log('🔍 Checking BIGINT precision issue...');
    
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
        const oldGuildId = '1391149977434329300';
        const newGuildId = '1391149977434329230';
        
        console.log(`\n📋 Testing BIGINT precision:`);
        console.log(`   Old Guild ID: ${oldGuildId}`);
        console.log(`   New Guild ID: ${newGuildId}`);
        
        // Check if they're numerically equal
        console.log(`\n🔍 Numerical comparison:`);
        const oldNum = BigInt(oldGuildId);
        const newNum = BigInt(newGuildId);
        console.log(`   Old as BigInt: ${oldNum}`);
        console.log(`   New as BigInt: ${newNum}`);
        console.log(`   Equal?: ${oldNum === newNum}`);
        console.log(`   Difference: ${newNum - oldNum}`);
        
        // Test direct database comparison
        console.log(`\n🔍 Database comparison test:`);
        const [comparison] = await pool.execute(`
            SELECT 
                discord_id,
                CAST(discord_id AS CHAR) as as_char,
                CAST(discord_id AS UNSIGNED) as as_unsigned,
                discord_id = ? as equals_new,
                discord_id = ? as equals_old
            FROM guilds WHERE id = 2
        `, [newGuildId, oldGuildId]);
        console.log('   Database comparison:', comparison);
        
        // Try to insert a test value
        console.log(`\n🔧 Testing with a completely different value:`);
        const testGuildId = '9999999999999999999';
        
        const [testUpdate] = await pool.execute(
            'UPDATE guilds SET discord_id = ? WHERE id = 2',
            [testGuildId]
        );
        console.log('   Test update result:', testUpdate);
        
        const [testResult] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   Test result:', testResult);
        
        // Now try the real update
        console.log(`\n🔧 Now trying the real update:`);
        const [realUpdate] = await pool.execute(
            'UPDATE guilds SET discord_id = ? WHERE id = 2',
            [newGuildId]
        );
        console.log('   Real update result:', realUpdate);
        
        const [finalResult] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   Final result:', finalResult);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkBigIntPrecision(); 