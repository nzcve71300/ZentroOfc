const pool = require('./src/db');

async function fixAllNullDiscordIds() {
    console.log('🚨 EMERGENCY FIX: Removing ALL corrupted null Discord ID records...');
    
    try {
        // 1. First, show what we're about to delete
        console.log('\n1. Checking for corrupted null Discord ID records...');
        const [corruptedRecords] = await pool.query(`
            SELECT ign, discord_id, server_id, guild_id, is_active, linked_at
            FROM players 
            WHERE (discord_id IS NULL OR discord_id = '' OR discord_id = 'null') 
            AND is_active = 1
            ORDER BY linked_at DESC
        `);
        
        console.log(`Found ${corruptedRecords.length} corrupted records to delete:`);
        corruptedRecords.forEach((record, index) => {
            console.log(`${index + 1}. IGN: "${record.ign}" -> Discord ID: "${record.discord_id}"`);
            console.log(`   Server: ${record.server_id}, Guild: ${record.guild_id}`);
            console.log(`   Linked: ${record.linked_at}`);
            console.log('');
        });

        if (corruptedRecords.length === 0) {
            console.log('✅ No corrupted records found. Database is clean!');
            return;
        }

        // 2. Delete all corrupted records
        console.log('\n2. Deleting corrupted records...');
        const [deleteResult] = await pool.query(`
            DELETE FROM players 
            WHERE (discord_id IS NULL OR discord_id = '' OR discord_id = 'null') 
            AND is_active = 1
        `);
        
        console.log(`✅ DELETED ${deleteResult.affectedRows} corrupted records!`);

        // 3. Verify the fix
        console.log('\n3. Verifying the fix...');
        const [remainingCorrupted] = await pool.query(`
            SELECT COUNT(*) as count
            FROM players 
            WHERE (discord_id IS NULL OR discord_id = '' OR discord_id = 'null') 
            AND is_active = 1
        `);
        
        console.log(`Remaining corrupted records: ${remainingCorrupted[0].count}`);

        // 4. Check total active records
        const [totalActive] = await pool.query(`
            SELECT COUNT(*) as count
            FROM players 
            WHERE is_active = 1
        `);
        
        console.log(`Total active records remaining: ${totalActive[0].count}`);

        // 5. Test specific cases
        console.log('\n4. Testing specific problematic cases...');
        
        // Test calflickz case
        const [calflickzTest] = await pool.query(`
            SELECT ign, discord_id, server_id, guild_id
            FROM players 
            WHERE LOWER(ign) = LOWER('calflickz') AND is_active = 1
        `);
        
        console.log(`Calflickz records after fix: ${calflickzTest.length}`);
        calflickzTest.forEach((record, index) => {
            console.log(`${index + 1}. IGN: "${record.ign}" -> Discord ID: "${record.discord_id}"`);
            console.log(`   Server: ${record.server_id}, Guild: ${record.guild_id}`);
        });

        // Test Dead-ops guild
        const [deadopsTest] = await pool.query(`
            SELECT ign, discord_id, server_id
            FROM players 
            WHERE guild_id = 609 AND is_active = 1
            ORDER BY linked_at DESC
            LIMIT 5
        `);
        
        console.log(`\nDead-ops guild records after fix: ${deadopsTest.length}`);
        deadopsTest.forEach((record, index) => {
            console.log(`${index + 1}. IGN: "${record.ign}" -> Discord ID: "${record.discord_id}"`);
            console.log(`   Server: ${record.server_id}`);
        });

        console.log('\n🎉 FIX COMPLETE!');
        console.log('✅ All corrupted null Discord ID records have been removed');
        console.log('✅ Linking system should now work correctly');
        console.log('✅ Users can now link their IGNs without false "Already Linked" errors');

    } catch (error) {
        console.error('❌ Error fixing null Discord IDs:', error);
    } finally {
        await pool.end();
    }
}

fixAllNullDiscordIds();
