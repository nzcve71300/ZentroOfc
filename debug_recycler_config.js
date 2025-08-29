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

        // 2. Check all servers in database
        console.log('📋 Step 2: All servers in database...');
        const [allServers] = await pool.execute(`
            SELECT id, name, guild_id, ip, port FROM servers ORDER BY name
        `);

        if (allServers.length === 0) {
            console.log('❌ No servers found in database!');
            return;
        } else {
            console.log('📊 All Servers:');
            allServers.forEach(server => {
                console.log(`   - ${server.name} (Guild ID: ${server.guild_id}, IP: ${server.ip}:${server.port})`);
            });
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

        // 4. Find Emperor 3x by matching guild IDs
        console.log('📋 Step 4: Finding Emperor 3x guild ID...');
        console.log('💡 Looking for Emperor 3x in the logs, the guild ID should be: 1342235198175182921');
        console.log('💡 This matches one of the recycler configs above');
        console.log('');

        // 5. Check if the guild ID from logs has a config
        const expectedGuildId = '1342235198175182921';
        console.log(`📋 Step 5: Checking recycler config for guild ID: ${expectedGuildId}`);
        const [configs] = await pool.execute(`
            SELECT * FROM recycler_configs WHERE server_id = ?
        `, [expectedGuildId]);

        if (configs.length === 0) {
            console.log(`❌ No recycler configuration found for guild ID: ${expectedGuildId}`);
            console.log('💡 Creating one now...');
        } else {
            const config = configs[0];
            console.log(`✅ Found configuration for guild ID ${expectedGuildId}:`);
            console.log(`   - Enabled: ${config.enabled}`);
            console.log(`   - Use List: ${config.use_list}`);
            console.log(`   - Cooldown: ${config.cooldown_minutes} minutes`);
        }
        console.log('');

        // 6. Create the correct config
        console.log('📋 Step 6: Creating correct recycler config...');
        try {
            await pool.execute(`
                INSERT INTO recycler_configs (server_id, enabled, use_list, cooldown_minutes) 
                VALUES (?, true, false, 5)
                ON DUPLICATE KEY UPDATE 
                enabled = VALUES(enabled),
                use_list = VALUES(use_list),
                cooldown_minutes = VALUES(cooldown_minutes),
                updated_at = CURRENT_TIMESTAMP
            `, [expectedGuildId]);
            console.log(`✅ Successfully created/updated recycler config for guild ID: ${expectedGuildId}`);
        } catch (error) {
            console.log('❌ Failed to create config:', error.message);
        }
        console.log('');

        // 7. Verify the config was created
        console.log('📋 Step 7: Verifying updated configuration...');
        const [updatedConfigs] = await pool.execute(`
            SELECT * FROM recycler_configs WHERE server_id = ?
        `, [expectedGuildId]);

        if (updatedConfigs.length > 0) {
            const config = updatedConfigs[0];
            console.log(`✅ Updated configuration for ${expectedGuildId}:`);
            console.log(`   - Enabled: ${config.enabled}`);
            console.log(`   - Use List: ${config.use_list}`);
            console.log(`   - Cooldown: ${config.cooldown_minutes} minutes`);
        }
        console.log('');

        // 8. Next steps
        console.log('📋 Step 8: Next Steps...');
        console.log('🔄 Restart the bot to pick up the new configuration:');
        console.log('   pm2 restart zentro-bot');
        console.log('');
        console.log('🎮 Test in-game with the orders emote (d11_quick_chat_orders_slot_2)');
        console.log('');
        console.log('💡 The guild ID 1342235198175182921 corresponds to Emperor 3x based on the logs!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

debugRecyclerConfig();
