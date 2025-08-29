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

        // 2. Check servers table structure
        console.log('📋 Step 2: Checking servers table structure...');
        const [columns] = await pool.execute(`
            DESCRIBE servers
        `);
        console.log('📊 Servers table columns:');
        columns.forEach(col => {
            console.log(`   - ${col.Field}: ${col.Type}`);
        });
        console.log('');

        // 3. Find Emperor 3x in servers table
        console.log('📋 Step 3: Finding Emperor 3x in servers table...');
        const [servers] = await pool.execute(`
            SELECT * FROM servers WHERE name = 'Emperor 3x' OR server_name = 'Emperor 3x' OR display_name = 'Emperor 3x'
        `);

        if (servers.length === 0) {
            console.log('❌ Emperor 3x not found in servers table!');
            console.log('💡 Let\'s check all servers:');
            const [allServers] = await pool.execute(`SELECT * FROM servers LIMIT 5`);
            console.log('📊 Sample servers:');
            allServers.forEach(server => {
                console.log(`   - ${JSON.stringify(server)}`);
            });
        } else {
            const server = servers[0];
            console.log('✅ Found Emperor 3x:');
            console.log(`   - Guild ID: ${server.guild_id || server.id}`);
            console.log(`   - Name: ${server.name || server.server_name || server.display_name}`);
            console.log(`   - Full record: ${JSON.stringify(server)}`);
        }
        console.log('');

        // 4. Check all recycler configs
        console.log('📋 Step 4: All recycler configurations...');
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

        // 5. Find the correct guild ID for Emperor 3x
        console.log('📋 Step 5: Finding correct guild ID for Emperor 3x...');
        const [emperorServer] = await pool.execute(`
            SELECT guild_id, name, server_name, display_name FROM servers 
            WHERE name LIKE '%Emperor%' OR server_name LIKE '%Emperor%' OR display_name LIKE '%Emperor%'
        `);

        if (emperorServer.length === 0) {
            console.log('❌ Could not find Emperor server in database!');
        } else {
            const server = emperorServer[0];
            const guildId = server.guild_id || server.id;
            console.log(`✅ Found Emperor server: ${guildId}`);
            console.log(`   - Guild ID: ${guildId}`);
            console.log(`   - Name: ${server.name || server.server_name || server.display_name}`);
            console.log('');

            // 6. Check if this guild ID has a recycler config
            console.log('📋 Step 6: Checking recycler config for this guild ID...');
            const [configs] = await pool.execute(`
                SELECT * FROM recycler_configs WHERE server_id = ?
            `, [guildId]);

            if (configs.length === 0) {
                console.log(`❌ No recycler configuration found for guild ID: ${guildId}`);
                console.log('💡 This is why the /set command didn\'t work - it needs the guild ID, not server name');
            } else {
                const config = configs[0];
                console.log(`✅ Found configuration for guild ID ${guildId}:`);
                console.log(`   - Enabled: ${config.enabled}`);
                console.log(`   - Use List: ${config.use_list}`);
                console.log(`   - Cooldown: ${config.cooldown_minutes} minutes`);
            }
            console.log('');

            // 7. Create the correct config
            console.log('📋 Step 7: Creating correct recycler config...');
            try {
                await pool.execute(`
                    INSERT INTO recycler_configs (server_id, enabled, use_list, cooldown_minutes) 
                    VALUES (?, true, false, 5)
                    ON DUPLICATE KEY UPDATE 
                    enabled = VALUES(enabled),
                    use_list = VALUES(use_list),
                    cooldown_minutes = VALUES(cooldown_minutes),
                    updated_at = CURRENT_TIMESTAMP
                `, [guildId]);
                console.log(`✅ Successfully created/updated recycler config for guild ID: ${guildId}`);
            } catch (error) {
                console.log('❌ Failed to create config:', error.message);
            }
        }
        console.log('');

        // 8. Next steps
        console.log('📋 Step 8: Next Steps...');
        console.log('🔄 Restart the bot to pick up the new configuration:');
        console.log('   pm2 restart zentro-bot');
        console.log('');
        console.log('🎮 Test in-game with the orders emote (d11_quick_chat_orders_slot_2)');
        console.log('');
        console.log('💡 The issue was that recycler configs use guild IDs, not server names!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

debugRecyclerConfig();
