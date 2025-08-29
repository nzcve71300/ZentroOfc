const pool = require('./src/db');

async function debugRustServers() {
    console.log('🔍 Checking Rust Servers Table...');
    console.log('================================\n');

    try {
        // 1. Check all rust_servers
        console.log('📋 All rust_servers:');
        const [servers] = await pool.execute(`
            SELECT id, nickname, guild_id, ip, port FROM rust_servers ORDER BY nickname
        `);

        if (servers.length === 0) {
            console.log('❌ No servers found in rust_servers table!');
            return;
        } else {
            console.log('📊 All Rust Servers:');
            servers.forEach(server => {
                console.log(`   - ${server.nickname} (ID: ${server.id}, Guild ID: ${server.guild_id}, IP: ${server.ip}:${server.port})`);
            });
        }
        console.log('');

        // 2. Find Emperor 3x specifically
        console.log('📋 Finding Emperor 3x...');
        const [emperorServers] = await pool.execute(`
            SELECT id, nickname, guild_id, ip, port FROM rust_servers 
            WHERE nickname LIKE '%Emperor%' OR nickname LIKE '%emperor%'
        `);

        if (emperorServers.length === 0) {
            console.log('❌ No Emperor server found in rust_servers table!');
        } else {
            console.log('📊 Emperor servers found:');
            emperorServers.forEach(server => {
                console.log(`   - ${server.nickname} (ID: ${server.id}, Guild ID: ${server.guild_id})`);
            });
        }
        console.log('');

        // 3. Check recycler configs with rust_servers.id
        console.log('📋 Checking recycler configs with rust_servers.id...');
        const [recyclerConfigs] = await pool.execute(`
            SELECT rc.server_id, rc.enabled, rc.use_list, rc.cooldown_minutes, rs.nickname
            FROM recycler_configs rc
            LEFT JOIN rust_servers rs ON rc.server_id = rs.id
            ORDER BY rc.server_id
        `);

        if (recyclerConfigs.length === 0) {
            console.log('❌ No recycler configurations found!');
        } else {
            console.log('📊 Recycler Configurations:');
            recyclerConfigs.forEach(config => {
                const status = config.enabled ? '✅ ENABLED' : '❌ DISABLED';
                const serverName = config.nickname || 'Unknown Server';
                console.log(`   ${config.server_id} (${serverName}): ${status} (List: ${config.use_list ? 'ON' : 'OFF'}, Cooldown: ${config.cooldown_minutes}m)`);
            });
        }
        console.log('');

        // 4. Find the correct server ID for Emperor 3x
        if (emperorServers.length > 0) {
            const emperorServer = emperorServers[0];
            console.log(`📋 Emperor 3x server ID: ${emperorServer.id}`);
            console.log(`📋 Emperor 3x guild ID: ${emperorServer.guild_id}`);
            console.log('');
            
            // 5. Check if there's a recycler config for this server ID
            const [configs] = await pool.execute(`
                SELECT * FROM recycler_configs WHERE server_id = ?
            `, [emperorServer.id]);
            
            if (configs.length === 0) {
                console.log(`❌ No recycler config found for server ID: ${emperorServer.id}`);
                console.log('💡 This is why the recycler system is disabled!');
                console.log('');
                console.log('🔧 Creating recycler config for the correct server ID...');
                
                try {
                    await pool.execute(`
                        INSERT INTO recycler_configs (server_id, enabled, use_list, cooldown_minutes) 
                        VALUES (?, true, false, 5)
                        ON DUPLICATE KEY UPDATE 
                        enabled = VALUES(enabled),
                        use_list = VALUES(use_list),
                        cooldown_minutes = VALUES(cooldown_minutes),
                        updated_at = CURRENT_TIMESTAMP
                    `, [emperorServer.id]);
                    console.log(`✅ Successfully created recycler config for server ID: ${emperorServer.id}`);
                } catch (error) {
                    console.log('❌ Failed to create config:', error.message);
                }
            } else {
                const config = configs[0];
                console.log(`✅ Found recycler config for server ID ${emperorServer.id}:`);
                console.log(`   - Enabled: ${config.enabled}`);
                console.log(`   - Use List: ${config.use_list}`);
                console.log(`   - Cooldown: ${config.cooldown_minutes} minutes`);
            }
        }
        console.log('');

        // 6. Next steps
        console.log('📋 Next Steps:');
        console.log('🔄 Restart the bot: pm2 restart zentro-bot');
        console.log('🎮 Test in-game with the orders emote (d11_quick_chat_orders_slot_2)');
        console.log('');
        console.log('💡 The recycler system uses rust_servers.id, not guild_id!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

debugRustServers();
