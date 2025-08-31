const pool = require('./src/db');

async function debugCalflickzIssue() {
    console.log('🔍 Debugging calflickz Linking Issue...');
    
    try {
        // 1. Check if calflickz exists in the database
        console.log('\n1. Checking if calflickz exists in the database...');
        const [calflickzRecords] = await pool.query(`
            SELECT discord_id, server_id, guild_id, is_active, linked_at, 
                   LENGTH(discord_id) as discord_id_length,
                   HEX(discord_id) as discord_id_hex
            FROM players 
            WHERE ign = ? AND is_active = 1
        `, ['calflickz']);
        
        console.log(`Found ${calflickzRecords.length} records for IGN "calflickz":`);
        calflickzRecords.forEach((record, index) => {
            console.log(`${index + 1}. Discord ID: "${record.discord_id}" (Length: ${record.discord_id_length})`);
            console.log(`   Server: ${record.server_id}`);
            console.log(`   Guild: ${record.guild_id}`);
            console.log(`   Active: ${record.is_active}`);
            console.log(`   Linked: ${record.linked_at}`);
            console.log(`   Discord ID (hex): ${record.discord_id_hex}`);
            console.log('');
        });

        // 2. Check for Dead-ops server
        console.log('\n2. Checking Dead-ops server information...');
        const [deadopsServer] = await pool.query(`
            SELECT id, guild_id, nickname, ip, port
            FROM rust_servers 
            WHERE nickname LIKE '%Dead-ops%' OR nickname LIKE '%Deadops%'
        `);
        
        console.log(`Found ${deadopsServer.length} Dead-ops servers:`);
        deadopsServer.forEach((server, index) => {
            console.log(`${index + 1}. ID: ${server.id}, Guild: ${server.guild_id}`);
            console.log(`   Name: ${server.nickname}`);
            console.log(`   IP: ${server.ip}:${server.port}`);
            console.log('');
        });

        // 3. Check all active links in Dead-ops guild
        if (deadopsServer.length > 0) {
            const guildId = deadopsServer[0].guild_id;
            console.log(`\n3. Checking all active links in Dead-ops guild (${guildId})...`);
            const [guildLinks] = await pool.query(`
                SELECT ign, discord_id, server_id, linked_at
                FROM players 
                WHERE guild_id = ? AND is_active = 1
                ORDER BY linked_at DESC
            `, [guildId]);
            
            console.log(`Found ${guildLinks.length} active links in Dead-ops guild:`);
            guildLinks.forEach((link, index) => {
                console.log(`${index + 1}. IGN: "${link.ign}" -> Discord ID: "${link.discord_id}"`);
                console.log(`   Server: ${link.server_id}, Linked: ${link.linked_at}`);
                console.log('');
            });
        }

        // 4. Check for any corrupted records
        console.log('\n4. Checking for corrupted records...');
        const [corruptedRecords] = await pool.query(`
            SELECT ign, discord_id, server_id, guild_id, is_active
            FROM players 
            WHERE (discord_id IS NULL OR discord_id = '' OR discord_id = 'null') 
            AND is_active = 1
        `);
        
        console.log(`Found ${corruptedRecords.length} corrupted records:`);
        corruptedRecords.forEach((record, index) => {
            console.log(`${index + 1}. IGN: "${record.ign}" -> Discord ID: "${record.discord_id}"`);
            console.log(`   Server: ${record.server_id}, Guild: ${record.guild_id}`);
            console.log('');
        });

        // 5. Test the exact linking scenario
        console.log('\n5. Testing the exact linking scenario...');
        console.log('Testing linking scenario:');
        console.log('- Guild: Dead-ops guild');
        console.log('- Target IGN: calflickz');
        console.log('- User trying to link: Unknown Discord ID');
        
        // Simulate the link command checks
        if (deadopsServer.length > 0) {
            const guildId = deadopsServer[0].guild_id;
            
            // CRITICAL CHECK 1: Check if this Discord user has active links in this guild
            console.log(`\nCRITICAL CHECK 1: Checking Discord user links in guild ${guildId}...`);
            console.log('(This would normally check the specific Discord ID trying to link)');
            
            // CRITICAL CHECK 2: Check if this IGN has active links in this guild
            console.log(`\nCRITICAL CHECK 2: Checking if IGN "calflickz" has active links in guild ${guildId}...`);
            const [ignLinks] = await pool.query(`
                SELECT discord_id, server_id, linked_at
                FROM players 
                WHERE ign = ? AND guild_id = ? AND is_active = 1
            `, ['calflickz', guildId]);
            
            console.log(`Found ${ignLinks.length} active links for "calflickz" in this guild:`);
            ignLinks.forEach((link, index) => {
                console.log(`${index + 1}. Discord ID: "${link.discord_id}" on ${link.server_id}`);
                console.log(`   Linked: ${link.linked_at}`);
                console.log('');
            });
        }

        // 6. Check for case sensitivity issues
        console.log('\n6. Checking for case sensitivity issues...');
        const [caseVariations] = await pool.query(`
            SELECT ign, discord_id, server_id, guild_id
            FROM players 
            WHERE LOWER(ign) = LOWER(?) AND is_active = 1
        `, ['calflickz']);
        
        console.log(`Found ${caseVariations.length} case variations for "calflickz":`);
        caseVariations.forEach((record, index) => {
            console.log(`${index + 1}. IGN: "${record.ign}" -> Discord ID: "${record.discord_id}"`);
            console.log(`   Server: ${record.server_id}, Guild: ${record.guild_id}`);
            console.log('');
        });

        console.log('\n🔍 ANALYSIS COMPLETE');
        console.log('Check the output above to identify the exact issue.');

    } catch (error) {
        console.error('❌ Error debugging calflickz issue:', error);
    } finally {
        await pool.end();
    }
}

debugCalflickzIssue();
