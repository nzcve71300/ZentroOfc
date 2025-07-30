const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnoseServerLookup() {
    console.log('🔍 Diagnosing server lookup issue...');
    
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

        console.log(`\n📋 Test Parameters:`);
        console.log(`   Guild ID: ${guildId}`);
        console.log(`   Server Name: ${serverName}`);

        // Step 1: Check if guild exists
        console.log(`\n🔍 Step 1: Checking guild...`);
        const [guildResult] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE discord_id = ?', [guildId]);
        console.log(`   Guild result:`, guildResult);

        if (guildResult.length === 0) {
            console.log('❌ Guild not found!');
            return;
        }

        const guild = guildResult[0];
        console.log(`✅ Guild found: ${guild.name} (ID: ${guild.id})`);

        // Step 2: Check if server exists
        console.log(`\n🔍 Step 2: Checking server...`);
        const [serverResult] = await pool.execute(
            'SELECT id, nickname, guild_id, ip, port FROM rust_servers WHERE guild_id = ? AND nickname = ?',
            [guild.id, serverName]
        );
        console.log(`   Server result:`, serverResult);

        if (serverResult.length === 0) {
            console.log('❌ Server not found!');
            
            // Check what servers exist for this guild
            const [allServers] = await pool.execute(
                'SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = ?',
                [guild.id]
            );
            console.log(`\n📋 Available servers for this guild:`);
            allServers.forEach(server => {
                console.log(`   - ${server.nickname} (ID: ${server.id})`);
            });
            return;
        }

        const server = serverResult[0];
        console.log(`✅ Server found: ${server.nickname} (ID: ${server.id})`);

        // Step 3: Check autokit configuration
        console.log(`\n🔍 Step 3: Checking autokit configuration...`);
        const [autokitResult] = await pool.execute(
            'SELECT kit_name, enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
            [server.id, 'FREEkit1']
        );
        console.log(`   Autokit result:`, autokitResult);

        if (autokitResult.length === 0) {
            console.log('❌ Autokit configuration not found!');
            
            // Check what autokits exist for this server
            const [allAutokits] = await pool.execute(
                'SELECT kit_name, enabled, cooldown, game_name FROM autokits WHERE server_id = ?',
                [server.id]
            );
            console.log(`\n📋 Available autokits for this server:`);
            allAutokits.forEach(kit => {
                console.log(`   - ${kit.kit_name} (enabled: ${kit.enabled}, cooldown: ${kit.cooldown})`);
            });
            return;
        }

        const autokit = autokitResult[0];
        console.log(`✅ Autokit found: ${autokit.kit_name} (enabled: ${autokit.enabled}, cooldown: ${autokit.cooldown})`);

        // Step 4: Simulate the exact query from the code
        console.log(`\n🔍 Step 4: Simulating exact code query...`);
        const [exactQuery] = await pool.execute(
            'SELECT rs.*, g.discord_id as guild_discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.nickname = ? AND g.discord_id = ?',
            [serverName, guildId]
        );
        console.log(`   Exact query result:`, exactQuery);

        if (exactQuery.length === 0) {
            console.log('❌ Exact query returned no results!');
        } else {
            console.log('✅ Exact query found server!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

diagnoseServerLookup(); 