const mysql = require('mysql2/promise');
require('dotenv').config();

async function forceUpdateGuildId() {
    console.log('🔧 FORCE UPDATE - Removing unique constraint and updating guild discord_id...');
    
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
        
        // Step 1: Remove unique constraint
        console.log(`\n🔧 Step 1: Removing unique constraint from discord_id...`);
        try {
            await pool.execute('ALTER TABLE guilds DROP INDEX discord_id');
            console.log('✅ Unique constraint removed');
        } catch (error) {
            console.log('⚠️ Could not remove constraint (might not exist):', error.message);
        }
        
        // Step 2: Update the guild discord_id
        console.log(`\n🔧 Step 2: Updating guild discord_id to: ${correctGuildId}`);
        const [updateResult] = await pool.execute(
            'UPDATE guilds SET discord_id = ? WHERE id = 2',
            [correctGuildId]
        );
        console.log('   Update result:', updateResult);
        
        // Step 3: Re-add unique constraint
        console.log(`\n🔧 Step 3: Re-adding unique constraint...`);
        try {
            await pool.execute('ALTER TABLE guilds ADD UNIQUE (discord_id)');
            console.log('✅ Unique constraint re-added');
        } catch (error) {
            console.log('⚠️ Could not re-add constraint:', error.message);
        }
        
        // Step 4: Verify the fix
        console.log(`\n🔧 AFTER FIX:`);
        const [after] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = 2');
        console.log('   Updated guild data:', after);
        
        if (String(after[0].discord_id) === correctGuildId) {
            console.log('✅ SUCCESS! Guild discord_id is now correct.');
            console.log('🔄 Now restart your bot: pm2 restart zentro-bot');
        } else {
            console.log('❌ FAILED! Guild discord_id is still wrong.');
            console.log(`   Expected: ${correctGuildId}`);
            console.log(`   Actual: ${after[0].discord_id}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

forceUpdateGuildId(); 