const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSpecificGuildDuplicates() {
    const targetGuildIds = ['1406308741628039228', '1390476170872750080'];
    
    console.log('🔍 Checking for duplicate entries for specific guild IDs...\n');
    
    // Create database connection
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'zentro_bot',
        port: process.env.DB_PORT || 3306
    });
    
    try {
        for (const guildDiscordId of targetGuildIds) {
            console.log(`\n=== CHECKING GUILD ID: ${guildDiscordId} ===`);
            
            // 1. Check guilds table
            console.log('\n1. Checking guilds table:');
            const [guildsResult] = await connection.query(
                'SELECT id, discord_id, name FROM guilds WHERE discord_id = ?',
                [guildDiscordId]
            );
            console.log(`   Found ${guildsResult.length} entries in guilds table:`);
            guildsResult.forEach(row => {
                console.log(`   - ID: ${row.id}, Discord ID: ${row.discord_id}, Name: ${row.name}`);
            });
            
            if (guildsResult.length === 0) {
                console.log(`   ❌ No guild found for Discord ID ${guildDiscordId}`);
                continue;
            }
            
            const guildIds = guildsResult.map(g => g.id);
            
            // 2. Check rust_servers table
            console.log('\n2. Checking rust_servers table:');
            const [serversResult] = await connection.query(
                'SELECT id, guild_id, nickname, ip, port FROM rust_servers WHERE guild_id IN (?)',
                [guildIds]
            );
            console.log(`   Found ${serversResult.length} servers:`);
            serversResult.forEach(row => {
                console.log(`   - Server ID: ${row.id}, Guild ID: ${row.guild_id}, Nickname: ${row.nickname}, IP: ${row.ip}:${row.port}`);
            });
            
            // 3. Check channel_settings table (this is likely where the spamming issue is)
            console.log('\n3. Checking channel_settings table:');
            const serverIds = serversResult.map(s => s.id);
            if (serverIds.length > 0) {
                const [channelResult] = await connection.query(
                    'SELECT cs.*, rs.nickname as server_nickname FROM channel_settings cs JOIN rust_servers rs ON cs.server_id = rs.id WHERE cs.server_id IN (?)',
                    [serverIds]
                );
                console.log(`   Found ${channelResult.length} channel settings:`);
                channelResult.forEach(row => {
                    console.log(`   - Server: ${row.server_nickname} (${row.server_id}), Type: ${row.channel_type}, Channel ID: ${row.channel_id}`);
                });
                
                // Check for duplicate channel settings (same channel type for same server)
                const duplicateChannels = {};
                channelResult.forEach(row => {
                    const key = `${row.server_id}_${row.channel_type}`;
                    if (!duplicateChannels[key]) {
                        duplicateChannels[key] = [];
                    }
                    duplicateChannels[key].push(row);
                });
                
                console.log('\n   🚨 DUPLICATE CHANNEL SETTINGS FOUND:');
                let foundDuplicates = false;
                Object.entries(duplicateChannels).forEach(([key, entries]) => {
                    if (entries.length > 1) {
                        foundDuplicates = true;
                        console.log(`   - ${entries[0].server_nickname} (${entries[0].server_id}) - ${entries[0].channel_type}:`);
                        entries.forEach((entry, index) => {
                            console.log(`     ${index + 1}. ID: ${entry.id}, Channel: ${entry.channel_id}, Created: ${entry.created_at}, Updated: ${entry.updated_at}`);
                        });
                    }
                });
                
                if (!foundDuplicates) {
                    console.log('   ✅ No duplicate channel settings found for this guild');
                }
            }
            
            // 4. Check for multiple guild entries for the same discord_id
            console.log('\n4. Checking for multiple guild entries with same discord_id:');
            const [duplicateGuildsResult] = await connection.query(
                'SELECT discord_id, COUNT(*) as count, GROUP_CONCAT(id) as guild_ids, GROUP_CONCAT(name) as names FROM guilds WHERE discord_id = ? GROUP BY discord_id HAVING COUNT(*) > 1',
                [guildDiscordId]
            );
            if (duplicateGuildsResult.length > 0) {
                console.log(`   🚨 FOUND ${duplicateGuildsResult.length} DUPLICATE GUILD ENTRIES:`);
                duplicateGuildsResult.forEach(row => {
                    console.log(`   - Discord ID: ${row.discord_id}, Count: ${row.count}, Guild IDs: [${row.guild_ids}], Names: [${row.names}]`);
                });
            } else {
                console.log('   ✅ No duplicate guild entries found');
            }
        }
        
        // 5. Summary check
        console.log('\n\n=== OVERALL SUMMARY ===');
        const [summary] = await connection.query(`
            SELECT 'guilds' as table_name, COUNT(*) as total_records FROM guilds
            UNION ALL
            SELECT 'rust_servers' as table_name, COUNT(*) as total_records FROM rust_servers
            UNION ALL
            SELECT 'channel_settings' as table_name, COUNT(*) as total_records FROM channel_settings
            UNION ALL
            SELECT 'players' as table_name, COUNT(*) as total_records FROM players
        `);
        
        console.log('Table sizes:');
        summary.forEach(row => {
            console.log(`- ${row.table_name}: ${row.total_records} records`);
        });
        
    } catch (error) {
        console.error('❌ Error during check:', error);
    } finally {
        await connection.end();
    }
    
    console.log('\n✅ Duplicate check complete!');
}

// Run the check
checkSpecificGuildDuplicates().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});
