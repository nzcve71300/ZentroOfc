const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixSpecificGuildDuplicates() {
    const targetGuildIds = ['1406308741628039228', '1390476170872750080'];
    
    console.log('🔧 Starting duplicate cleanup for specific guild IDs...\n');
    
    // Create database connection
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'zentro_bot',
        port: process.env.DB_PORT || 3306
    });
    
    try {
        // STEP 1: Remove duplicate channel_settings (most likely cause of spamming)
        console.log('Step 1: Removing duplicate channel_settings...');
        
        for (const guildDiscordId of targetGuildIds) {
            const [result1] = await connection.query(`
                DELETE cs1 FROM channel_settings cs1
                INNER JOIN channel_settings cs2 
                INNER JOIN rust_servers rs1 ON cs1.server_id = rs1.id
                INNER JOIN rust_servers rs2 ON cs2.server_id = rs2.id
                INNER JOIN guilds g1 ON rs1.guild_id = g1.id
                INNER JOIN guilds g2 ON rs2.guild_id = g2.id
                WHERE cs1.id > cs2.id 
                AND cs1.server_id = cs2.server_id 
                AND cs1.channel_type = cs2.channel_type
                AND g1.discord_id = ?
                AND g2.discord_id = ?
            `, [guildDiscordId, guildDiscordId]);
            
            console.log(`   - Removed ${result1.affectedRows} duplicate channel_settings for guild ${guildDiscordId}`);
        }
        
        // STEP 2: Remove duplicate guild entries
        console.log('\nStep 2: Removing duplicate guild entries...');
        const [result2] = await connection.query(`
            DELETE g1 FROM guilds g1
            INNER JOIN guilds g2 
            WHERE g1.id > g2.id 
            AND g1.discord_id = g2.discord_id
            AND g1.discord_id IN (?, ?)
        `, targetGuildIds);
        
        console.log(`   - Removed ${result2.affectedRows} duplicate guild entries`);
        
        // STEP 3: Remove duplicate player entries
        console.log('\nStep 3: Removing duplicate player entries...');
        const [result3] = await connection.query(`
            DELETE p1 FROM players p1
            INNER JOIN players p2 
            INNER JOIN guilds g ON p1.guild_id = g.id
            WHERE p1.id > p2.id 
            AND p1.guild_id = p2.guild_id
            AND p1.server_id = p2.server_id 
            AND p1.discord_id = p2.discord_id 
            AND LOWER(p1.ign) = LOWER(p2.ign)
            AND p1.is_active = true 
            AND p2.is_active = true
            AND g.discord_id IN (?, ?)
        `, targetGuildIds);
        
        console.log(`   - Removed ${result3.affectedRows} duplicate player entries`);
        
        // STEP 4: Clean up orphaned economy records
        console.log('\nStep 4: Cleaning up orphaned economy records...');
        const [result4] = await connection.query(`
            DELETE e FROM economy e
            LEFT JOIN players p ON e.player_id = p.id
            WHERE p.id IS NULL
        `);
        
        console.log(`   - Removed ${result4.affectedRows} orphaned economy records`);
        
        // STEP 5: Verification
        console.log('\n🔍 VERIFICATION: Checking for remaining duplicates...\n');
        
        // Check for remaining duplicate channel settings
        const [channelDuplicates] = await connection.query(`
            SELECT cs.server_id, rs.nickname, cs.channel_type, COUNT(*) as count
            FROM channel_settings cs 
            JOIN rust_servers rs ON cs.server_id = rs.id 
            JOIN guilds g ON rs.guild_id = g.id 
            WHERE g.discord_id IN (?, ?)
            GROUP BY cs.server_id, cs.channel_type 
            HAVING COUNT(*) > 1
        `, targetGuildIds);
        
        if (channelDuplicates.length > 0) {
            console.log('❌ Remaining duplicate channel settings found:');
            channelDuplicates.forEach(row => {
                console.log(`   - Server: ${row.nickname} (${row.server_id}), Type: ${row.channel_type}, Count: ${row.count}`);
            });
        } else {
            console.log('✅ No remaining duplicate channel settings');
        }
        
        // Check for remaining duplicate guilds
        const [guildDuplicates] = await connection.query(`
            SELECT discord_id, COUNT(*) as count
            FROM guilds 
            WHERE discord_id IN (?, ?)
            GROUP BY discord_id 
            HAVING COUNT(*) > 1
        `, targetGuildIds);
        
        if (guildDuplicates.length > 0) {
            console.log('❌ Remaining duplicate guilds found:');
            guildDuplicates.forEach(row => {
                console.log(`   - Discord ID: ${row.discord_id}, Count: ${row.count}`);
            });
        } else {
            console.log('✅ No remaining duplicate guilds');
        }
        
        // Final count of channel settings for these guilds
        console.log('\n📊 Final channel settings summary:');
        const [finalCount] = await connection.query(`
            SELECT g.discord_id, g.name, COUNT(cs.id) as channel_count
            FROM guilds g
            JOIN rust_servers rs ON g.id = rs.guild_id
            LEFT JOIN channel_settings cs ON rs.id = cs.server_id
            WHERE g.discord_id IN (?, ?)
            GROUP BY g.discord_id, g.name
        `, targetGuildIds);
        
        finalCount.forEach(row => {
            console.log(`   - Guild ${row.discord_id} (${row.name}): ${row.channel_count} channel settings`);
        });
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    } finally {
        await connection.end();
    }
    
    console.log('\n✅ Duplicate cleanup completed successfully!');
    console.log('\n🔄 You should restart your bot to ensure the changes take effect and stop the channel spamming.');
}

// Run the fix
fixSpecificGuildDuplicates().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});
