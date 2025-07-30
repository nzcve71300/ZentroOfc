const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugDatabaseConstraints() {
    console.log('🔍 Debugging database constraints and permissions...');
    
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
        // Check table structure
        console.log(`\n📋 Guilds table structure:`);
        const [structure] = await pool.execute('DESCRIBE guilds');
        console.log(structure);
        
        // Check for triggers
        console.log(`\n📋 Checking for triggers on guilds table:`);
        const [triggers] = await pool.execute(`
            SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_STATEMENT 
            FROM information_schema.TRIGGERS 
            WHERE EVENT_OBJECT_TABLE = 'guilds'
        `);
        console.log(triggers);
        
        // Check for foreign key constraints
        console.log(`\n📋 Checking foreign key constraints:`);
        const [constraints] = await pool.execute(`
            SELECT 
                CONSTRAINT_NAME,
                TABLE_NAME,
                COLUMN_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'guilds' AND REFERENCED_TABLE_NAME IS NOT NULL
        `);
        console.log(constraints);
        
        // Try to update with different methods
        console.log(`\n🔧 Testing different update methods...`);
        
        const correctGuildId = '1391149977434329230';
        
        // Method 1: Direct SQL
        console.log('   Method 1: Direct SQL');
        try {
            const [result1] = await pool.execute(`UPDATE guilds SET discord_id = ${correctGuildId} WHERE id = 2`);
            console.log('   Result 1:', result1);
        } catch (error) {
            console.log('   Error 1:', error.message);
        }
        
        // Method 2: With parameters
        console.log('   Method 2: With parameters');
        try {
            const [result2] = await pool.execute('UPDATE guilds SET discord_id = ? WHERE id = ?', [correctGuildId, 2]);
            console.log('   Result 2:', result2);
        } catch (error) {
            console.log('   Error 2:', error.message);
        }
        
        // Method 3: Force update
        console.log('   Method 3: Force update');
        try {
            const [result3] = await pool.execute(`UPDATE guilds SET discord_id = ${correctGuildId} WHERE id = 2 AND discord_id != ${correctGuildId}`);
            console.log('   Result 3:', result3);
        } catch (error) {
            console.log('   Error 3:', error.message);
        }
        
        // Check final state
        const [final] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   Final state:', final);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

debugDatabaseConstraints(); 