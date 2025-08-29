const pool = require('./src/db');

async function enableEmperorRecycler() {
    console.log('🔧 Enabling Emperor 3x Recycler System...');
    console.log('========================================\n');

    try {
        // The correct server ID for Emperor 3x
        const emperorServerId = '1754071898933_jg45hm1wj';
        
        console.log(`📋 Enabling recycler for server ID: ${emperorServerId}`);
        
        // Enable the recycler configuration
        await pool.execute(`
            UPDATE recycler_configs 
            SET enabled = true, updated_at = CURRENT_TIMESTAMP
            WHERE server_id = ?
        `, [emperorServerId]);
        
        console.log('✅ Successfully enabled Emperor 3x recycler system!');
        console.log('');
        
        // Verify the configuration
        const [configs] = await pool.execute(`
            SELECT * FROM recycler_configs WHERE server_id = ?
        `, [emperorServerId]);
        
        if (configs.length > 0) {
            const config = configs[0];
            console.log('📊 Updated Configuration:');
            console.log(`   - Server ID: ${config.server_id}`);
            console.log(`   - Enabled: ${config.enabled} (${config.enabled ? 'TRUE' : 'FALSE'})`);
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

enableEmperorRecycler();
