const pool = require('./src/db');

async function fixEmperorRecycler() {
    console.log('🔧 Fixing Emperor 3x Recycler Configuration...');
    console.log('=============================================\n');

    try {
        // The guild ID for Emperor 3x from the logs
        const emperorGuildId = '1342235198175182921';
        
        console.log(`📋 Creating recycler config for guild ID: ${emperorGuildId}`);
        
        // Create the recycler configuration
        await pool.execute(`
            INSERT INTO recycler_configs (server_id, enabled, use_list, cooldown_minutes) 
            VALUES (?, true, false, 5)
            ON DUPLICATE KEY UPDATE 
            enabled = VALUES(enabled),
            use_list = VALUES(use_list),
            cooldown_minutes = VALUES(cooldown_minutes),
            updated_at = CURRENT_TIMESTAMP
        `, [emperorGuildId]);
        
        console.log('✅ Successfully created/updated Emperor 3x recycler config!');
        console.log('');
        
        // Verify the configuration
        const [configs] = await pool.execute(`
            SELECT * FROM recycler_configs WHERE server_id = ?
        `, [emperorGuildId]);
        
        if (configs.length > 0) {
            const config = configs[0];
            console.log('📊 Configuration Details:');
            console.log(`   - Guild ID: ${config.server_id}`);
            console.log(`   - Enabled: ${config.enabled}`);
            console.log(`   - Use List: ${config.use_list}`);
            console.log(`   - Cooldown: ${config.cooldown_minutes} minutes`);
            console.log(`   - Updated: ${config.updated_at}`);
        }
        console.log('');
        
        console.log('🔄 Next Steps:');
        console.log('1. Restart the bot: pm2 restart zentro-bot');
        console.log('2. Test in-game with the orders emote (d11_quick_chat_orders_slot_2)');
        console.log('');
        console.log('🎯 The recycler system should now work for Emperor 3x!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixEmperorRecycler();
