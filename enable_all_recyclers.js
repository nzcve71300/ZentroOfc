const pool = require('./src/db');

async function enableAllRecyclers() {
    console.log('🔧 Enabling Recycler System for All Servers...');
    console.log('============================================\n');

    try {
        // Get all rust_servers
        const [servers] = await pool.execute(`
            SELECT id, nickname FROM rust_servers ORDER BY nickname
        `);

        console.log(`📋 Found ${servers.length} servers to configure`);
        console.log('');

        let enabledCount = 0;
        let createdCount = 0;

        for (const server of servers) {
            console.log(`📋 Processing ${server.nickname} (ID: ${server.id})`);
            
            // Check if recycler config exists
            const [existingConfig] = await pool.execute(`
                SELECT enabled FROM recycler_configs WHERE server_id = ?
            `, [server.id]);

            if (existingConfig.length === 0) {
                // Create new config
                await pool.execute(`
                    INSERT INTO recycler_configs (server_id, enabled, use_list, cooldown_minutes) 
                    VALUES (?, true, false, 5)
                `, [server.id]);
                console.log(`   ✅ Created and enabled recycler config`);
                createdCount++;
            } else {
                // Update existing config to enabled
                await pool.execute(`
                    UPDATE recycler_configs 
                    SET enabled = true, updated_at = CURRENT_TIMESTAMP
                    WHERE server_id = ?
                `, [server.id]);
                console.log(`   ✅ Enabled existing recycler config`);
                enabledCount++;
            }
        }

        console.log('');
        console.log('📊 Summary:');
        console.log(`   - Created new configs: ${createdCount}`);
        console.log(`   - Enabled existing configs: ${enabledCount}`);
        console.log(`   - Total servers configured: ${createdCount + enabledCount}`);
        console.log('');

        console.log('🔄 Next Steps:');
        console.log('1. Restart the bot: pm2 restart zentro-bot');
        console.log('2. Test /set commands: /set RECYCLER-USE on <server>');
        console.log('3. Test recycler spawning in-game');
        console.log('');
        console.log('🎯 All servers now have recycler configs enabled!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

enableAllRecyclers();
