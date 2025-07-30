const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugKitClaim() {
    console.log('🔍 Debugging handleKitClaim function...');
    
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
        const guildId = '1391149977434329230';
        const serverName = 'RISE 3X';
        const kitKey = 'FREEkit1';
        const player = 'nzcve7130';

        console.log(`\n📋 Debug Parameters:`);
        console.log(`   Guild ID: ${guildId}`);
        console.log(`   Server Name: ${serverName}`);
        console.log(`   Kit Key: ${kitKey}`);
        console.log(`   Player: ${player}`);

        // Step 1: Simulate the exact server lookup from handleKitClaim
        console.log(`\n🔍 Step 1: Server lookup (exact query from handleKitClaim)...`);
        const [serverResult] = await pool.execute(
            'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
            [guildId, serverName]
        );
        
        console.log(`   Server result:`, serverResult);

        if (serverResult.length === 0) {
            console.log('❌ Server not found - this is the issue!');
            
            // Let's debug why
            console.log(`\n🔍 Debugging server lookup failure...`);
            
            // Check guild lookup
            const [guildResult] = await pool.execute('SELECT id FROM guilds WHERE discord_id = ?', [guildId]);
            console.log(`   Guild lookup:`, guildResult);
            
            if (guildResult.length === 0) {
                console.log('❌ Guild not found with discord_id:', guildId);
            } else {
                const guildId_db = guildResult[0].id;
                console.log(`✅ Guild found with ID: ${guildId_db}`);
                
                // Check server lookup with guild ID
                const [serverCheck] = await pool.execute(
                    'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
                    [guildId_db, serverName]
                );
                console.log(`   Server lookup with guild_id:`, serverCheck);
            }
            return;
        }

        const serverId = serverResult[0].id;
        console.log(`✅ Server found with ID: ${serverId}`);

        // Step 2: Check autokit configuration
        console.log(`\n🔍 Step 2: Autokit configuration...`);
        const [autokitResult] = await pool.execute(
            'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
            [serverId, kitKey]
        );

        console.log(`   Autokit result:`, autokitResult);

        if (autokitResult.length === 0) {
            console.log('❌ Autokit configuration not found!');
            return;
        }

        const kitConfig = autokitResult[0];
        console.log(`✅ Autokit found: enabled=${kitConfig.enabled}, cooldown=${kitConfig.cooldown}, game_name=${kitConfig.game_name}`);

        if (!kitConfig.enabled) {
            console.log('❌ Kit is disabled!');
            return;
        }

        console.log('✅ Kit is enabled and ready to use!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

debugKitClaim(); 