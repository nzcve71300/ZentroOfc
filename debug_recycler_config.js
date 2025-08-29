const pool = require('./src/db');

async function debugRecyclerConfig() {
    console.log('🔍 Debugging Recycler Configuration for Emperor 3x...');
    console.log('==================================================\n');

    try {
        // 1. Check if recycler_configs table exists
        console.log('📋 Step 1: Checking recycler_configs table...');
        const [tables] = await pool.execute(`
            SHOW TABLES LIKE 'recycler_configs'
        `);
        
        if (tables.length === 0) {
            console.log('❌ recycler_configs table does not exist!');
            return;
        }
        console.log('✅ recycler_configs table exists\n');

        // 2. Check Emperor 3x configuration specifically
        console.log('📋 Step 2: Checking Emperor 3x recycler configuration...');
        const [configs] = await pool.execute(`
            SELECT * FROM recycler_configs WHERE server_id = 'Emperor 3x'
        `);

        if (configs.length === 0) {
            console.log('❌ No recycler configuration found for Emperor 3x!');
            console.log('💡 This means the /set command failed to create the config');
        } else {
            const config = configs[0];
            console.log('✅ Found configuration:');
            console.log(`   - ID: ${config.id}`);
            console.log(`   - Server: ${config.server_id}`);
            console.log(`   - Enabled: ${config.enabled}`);
            console.log(`   - Use List: ${config.use_list}`);
            console.log(`   - Cooldown: ${config.cooldown_minutes} minutes`);
            console.log(`   - Created: ${config.created_at}`);
            console.log(`   - Updated: ${config.updated_at}`);
        }
        console.log('');

        // 3. Check all recycler configs
        console.log('📋 Step 3: All recycler configurations...');
        const [allConfigs] = await pool.execute(`
            SELECT server_id, enabled, use_list, cooldown_minutes, updated_at 
            FROM recycler_configs 
            ORDER BY server_id
        `);

        if (allConfigs.length === 0) {
            console.log('❌ No recycler configurations found in database!');
        } else {
            console.log('📊 All Recycler Configurations:');
            allConfigs.forEach(config => {
                const status = config.enabled ? '✅ ENABLED' : '❌ DISABLED';
                console.log(`   ${config.server_id}: ${status} (List: ${config.use_list ? 'ON' : 'OFF'}, Cooldown: ${config.cooldown_minutes}m)`);
            });
        }
        console.log('');

        // 4. Check if Emperor 3x exists in servers table
        console.log('📋 Step 4: Checking if Emperor 3x exists in servers table...');
        const [servers] = await pool.execute(`
            SELECT server_name FROM servers WHERE server_name = 'Emperor 3x'
        `);

        if (servers.length === 0) {
            console.log('❌ Emperor 3x not found in servers table!');
        } else {
            console.log('✅ Emperor 3x found in servers table');
        }
        console.log('');

        // 5. Try to manually create the config
        console.log('📋 Step 5: Attempting to create Emperor 3x recycler config...');
        try {
            await pool.execute(`
                INSERT INTO recycler_configs (server_id, enabled, use_list, cooldown_minutes) 
                VALUES ('Emperor 3x', true, false, 5)
                ON DUPLICATE KEY UPDATE 
                enabled = VALUES(enabled),
                use_list = VALUES(use_list),
                cooldown_minutes = VALUES(cooldown_minutes),
                updated_at = CURRENT_TIMESTAMP
            `);
            console.log('✅ Successfully created/updated Emperor 3x recycler config');
        } catch (error) {
            console.log('❌ Failed to create config:', error.message);
        }
        console.log('');

        // 6. Verify the config was created
        console.log('📋 Step 6: Verifying updated configuration...');
        const [updatedConfigs] = await pool.execute(`
            SELECT * FROM recycler_configs WHERE server_id = 'Emperor 3x'
        `);

        if (updatedConfigs.length > 0) {
            const config = updatedConfigs[0];
            console.log('✅ Updated configuration:');
            console.log(`   - Enabled: ${config.enabled}`);
            console.log(`   - Use List: ${config.use_list}`);
            console.log(`   - Cooldown: ${config.cooldown_minutes} minutes`);
        }
        console.log('');

        // 7. Next steps
        console.log('📋 Step 7: Next Steps...');
        console.log('🔄 Restart the bot to pick up the new configuration:');
        console.log('   pm2 restart zentro-bot');
        console.log('');
        console.log('🎮 Test in-game with the orders emote (d11_quick_chat_orders_slot_2)');
        console.log('');
        console.log('📝 If it still doesn\'t work, check the logs for:');
        console.log('   [RECYCLER] Recycler system is disabled for server: Emperor 3x');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

debugRecyclerConfig();
