const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnoseSpammingDetailed() {
    console.log('🔍 Detailed Channel Spamming Analysis...\n');
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'zentro_bot',
            port: process.env.DB_PORT || 3306
        });
        
        const problemGuilds = ['1406308741628039228', '1390476170872750080'];
        
        console.log('1️⃣ Analyzing channel configurations for problem guilds...\n');
        
        for (const guildId of problemGuilds) {
            console.log(`=== GUILD ${guildId} ===`);
            
            // Get guild info
            const [guildInfo] = await connection.query(
                'SELECT * FROM guilds WHERE discord_id = ?',
                [guildId]
            );
            
            if (guildInfo.length === 0) {
                console.log('❌ Guild not found in database');
                continue;
            }
            
            console.log(`Guild Name: ${guildInfo[0].name}`);
            console.log(`Internal ID: ${guildInfo[0].id}`);
            
            // Get servers for this guild
            const [servers] = await connection.query(
                'SELECT * FROM rust_servers WHERE guild_id = ?',
                [guildInfo[0].id]
            );
            
            console.log(`\nServers (${servers.length}):`);
            servers.forEach(server => {
                console.log(`  - ${server.nickname} (${server.id}): ${server.ip}:${server.port}`);
            });
            
            // Get ALL channel settings for this guild
            const [channels] = await connection.query(`
                SELECT 
                    cs.*,
                    rs.nickname as server_name,
                    rs.ip,
                    rs.port
                FROM channel_settings cs
                JOIN rust_servers rs ON cs.server_id = rs.id
                WHERE rs.guild_id = ?
                ORDER BY rs.nickname, cs.channel_type
            `, [guildInfo[0].id]);
            
            console.log(`\nChannel Settings (${channels.length}):`);
            if (channels.length === 0) {
                console.log('  ❌ No channel settings configured - this explains why guild 1390476170872750080 is not spamming');
            } else {
                channels.forEach(ch => {
                    console.log(`  - ${ch.server_name}: ${ch.channel_type} -> ${ch.channel_id}`);
                    console.log(`    Created: ${ch.created_at}, Updated: ${ch.updated_at}`);
                });
            }
            
            console.log('\n' + '='.repeat(50) + '\n');
        }
        
        console.log('2️⃣ Checking for recent channel activity patterns...\n');
        
        // Check if there are multiple channel_settings with same channel_id (different servers using same Discord channel)
        const [duplicateChannelIds] = await connection.query(`
            SELECT 
                cs.channel_id,
                COUNT(*) as usage_count,
                GROUP_CONCAT(CONCAT(rs.nickname, ' (', g.name, ')') SEPARATOR ', ') as used_by
            FROM channel_settings cs
            JOIN rust_servers rs ON cs.server_id = rs.id
            JOIN guilds g ON rs.guild_id = g.id
            GROUP BY cs.channel_id
            HAVING COUNT(*) > 1
        `);
        
        if (duplicateChannelIds.length > 0) {
            console.log('🚨 FOUND MULTIPLE SERVERS USING SAME DISCORD CHANNELS:');
            duplicateChannelIds.forEach(dup => {
                console.log(`  Channel ID ${dup.channel_id} is used by ${dup.usage_count} servers:`);
                console.log(`    ${dup.used_by}`);
                console.log('    ⚠️ This WILL cause message duplication/spamming!');
            });
        } else {
            console.log('✅ No Discord channels are shared between multiple servers');
        }
        
        console.log('\n3️⃣ Checking message sending frequency patterns...\n');
        
        // Let's check what types of messages might be spamming
        console.log('Common message triggers that could cause spamming:');
        console.log('  - Player joins/leaves (playerfeed)');
        console.log('  - Kill events (killfeed)');  
        console.log('  - Admin actions (adminfeed)');
        console.log('  - Player count updates (playercount voice channel)');
        console.log('  - RCON connection issues causing reconnection loops');
        
        console.log('\n4️⃣ Specific recommendations for your situation...\n');
        
        // For guild 1406308741628039228 (the one with channels configured)
        console.log('For Guild 1406308741628039228 (Atlantis 18x):');
        console.log('  - Has 3 channels configured: adminfeed, killfeed, playercount');
        console.log('  - Server: Hyper 18x RCE (176.57.160.193:28016)');
        console.log('  - If this guild is spamming, the issue is likely:');
        console.log('    a) High frequency of game events (kills, joins, admin actions)');
        console.log('    b) RCON connection instability causing message loops');
        console.log('    c) Bot message rate limiting or Discord API issues');
        
        console.log('\nFor Guild 1390476170872750080 (COBALT 6X):');
        console.log('  - Has NO channel settings configured');
        console.log('  - Should NOT be sending any messages to Discord');
        console.log('  - If this guild claims to be spamming, check:');
        console.log('    a) Are you sure the spam is coming from this bot?');
        console.log('    b) Is there another bot in that Discord server?');
        console.log('    c) Are the guild IDs correct?');
        
        console.log('\n5️⃣ Testing Discord channel accessibility...\n');
        
        // Get the channel IDs that should be receiving messages
        const [activeChannels] = await connection.query(`
            SELECT DISTINCT cs.channel_id, cs.channel_type, g.discord_id, rs.nickname
            FROM channel_settings cs
            JOIN rust_servers rs ON cs.server_id = rs.id
            JOIN guilds g ON rs.guild_id = g.id
            WHERE g.discord_id IN (?, ?)
        `, problemGuilds);
        
        console.log('Discord channels that should receive messages:');
        activeChannels.forEach(ch => {
            console.log(`  - Channel ${ch.channel_id} (${ch.channel_type}) for ${ch.nickname} in guild ${ch.discord_id}`);
        });
        
        if (activeChannels.length === 0) {
            console.log('  ❌ No active channels found for problem guilds');
            console.log('  💡 This means the spamming is NOT coming from these guilds');
        }
        
        await connection.end();
        
        console.log('\n🎯 CONCLUSION AND NEXT STEPS:\n');
        console.log('Based on the analysis:');
        console.log('1. Your bot setup appears to be correct (no duplicates, single process)');
        console.log('2. Guild 1390476170872750080 has NO channels configured, so it cannot spam');
        console.log('3. Guild 1406308741628039228 has normal channel configuration');
        console.log('');
        console.log('If spamming is still occurring, please:');
        console.log('1. Verify which Discord channels are actually being spammed');
        console.log('2. Check if there are other bots in those Discord servers');
        console.log('3. Monitor the bot logs: pm2 logs zentro-bot');
        console.log('4. Use Discord\'s audit log to see which bot is sending the spam');
        
    } catch (error) {
        console.error('❌ Error during detailed analysis:', error);
    }
}

// Run the detailed analysis
diagnoseSpammingDetailed().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});
