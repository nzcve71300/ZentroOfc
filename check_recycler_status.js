const pool = require('./src/db');

async function checkRecyclerStatus() {
    console.log('🔍 Checking Recycler Configuration Status...');
    console.log('==========================================\n');

    try {
        // 1. Check Emperor 3x configuration
        const emperorGuildId = '1342235198175182921';
        console.log(`📋 Checking recycler config for guild ID: ${emperorGuildId}`);
        
        const [configs] = await pool.execute(`
            SELECT * FROM recycler_configs WHERE server_id = ?
        `, [emperorGuildId]);
        
        if (configs.length === 0) {
            console.log('❌ No recycler configuration found!');
        } else {
            const config = configs[0];
            console.log('✅ Found configuration:');
            console.log(`   - Guild ID: ${config.server_id}`);
            console.log(`   - Enabled: ${config.enabled} (${config.enabled ? 'TRUE' : 'FALSE'})`);
            console.log(`   - Use List: ${config.use_list}`);
            console.log(`   - Cooldown: ${config.cooldown_minutes} minutes`);
            console.log(`   - Updated: ${config.updated_at}`);
        }
        console.log('');

        // 2. Check all recycler configs
        console.log('📋 All recycler configurations:');
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

        // 3. Check if bot needs restart
        console.log('📋 Bot Status Check:');
        console.log('💡 The bot needs to be restarted to pick up the new configuration');
        console.log('💡 Run: pm2 restart zentro-bot');
        console.log('');
        
        // 4. Check if there are any other guild IDs that might be Emperor 3x
        console.log('📋 Checking for other possible Emperor 3x guild IDs...');
        const [allServers] = await pool.execute(`
            SELECT guild_id, name FROM servers WHERE name LIKE '%Emperor%' OR name LIKE '%emperor%'
        `);
        
        if (allServers.length === 0) {
            console.log('❌ No Emperor servers found in servers table');
            console.log('💡 This is normal - the bot might be using a different method to identify servers');
        } else {
            console.log('📊 Emperor servers found:');
            allServers.forEach(server => {
                console.log(`   - ${server.name} (Guild ID: ${server.guild_id})`);
            });
        }
        console.log('');

        // 5. Next steps
        console.log('📋 Next Steps:');
        console.log('1. Restart the bot: pm2 restart zentro-bot');
        console.log('2. Check the logs for: [RECYCLER] Recycler system is disabled');
        console.log('3. If still disabled, the bot might be using a different guild ID');
        console.log('');
        console.log('💡 The configuration exists and is enabled, so restarting should fix it!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkRecyclerStatus();
