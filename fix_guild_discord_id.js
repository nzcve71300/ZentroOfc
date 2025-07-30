const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixGuildDiscordId() {
    console.log('🔧 Fixing guild discord_id in database...');
    
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
        const guildId = '1391149977434329230'; // The correct guild ID
        const serverName = 'RISE 3X';

        console.log(`\n📋 Fix Parameters:`);
        console.log(`   Correct Guild ID: ${guildId}`);
        console.log(`   Server Name: ${serverName}`);

        // Step 1: Check current guild data
        console.log(`\n🔍 Step 1: Checking current guild data...`);
        const [currentGuild] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE name = ?', [serverName]);
        console.log(`   Current guild data:`, currentGuild);

        if (currentGuild.length === 0) {
            console.log('❌ Guild not found in database!');
            return;
        }

        const guild = currentGuild[0];
        console.log(`   Current discord_id: ${guild.discord_id}`);
        console.log(`   Expected discord_id: ${guildId}`);

        if (guild.discord_id === guildId) {
            console.log('✅ Guild discord_id is already correct!');
            return;
        }

        // Step 2: Update the guild discord_id
        console.log(`\n🔧 Step 2: Updating guild discord_id...`);
        await pool.execute(
            'UPDATE guilds SET discord_id = ? WHERE id = ?',
            [guildId, guild.id]
        );
        console.log(`✅ Updated guild discord_id from ${guild.discord_id} to ${guildId}`);

        // Step 3: Verify the fix
        console.log(`\n🔍 Step 3: Verifying the fix...`);
        const [verifyGuild] = await pool.execute('SELECT id, discord_id, name FROM guilds WHERE id = ?', [guild.id]);
        console.log(`   Updated guild data:`, verifyGuild);

        // Step 4: Test the server lookup
        console.log(`\n🔍 Step 4: Testing server lookup...`);
        const [serverResult] = await pool.execute(
            'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
            [guildId, serverName]
        );
        console.log(`   Server lookup result:`, serverResult);

        if (serverResult.length > 0) {
            console.log('✅ Server lookup now works!');
        } else {
            console.log('❌ Server lookup still failing!');
        }

        console.log('\n🎉 Guild discord_id fix completed!');
        console.log('🔄 Please restart your bot with: pm2 restart zentro-bot');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixGuildDiscordId(); 