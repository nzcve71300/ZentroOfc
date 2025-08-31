const pool = require('./src/db');

async function cleanupCorruptedRecords() {
    console.log('🧹 CLEANING UP CORRUPTED DISCORD ID RECORDS...');
    
    try {
        // First, check how many corrupted records exist
        const [corruptedCount] = await pool.query(`
            SELECT COUNT(*) as count
            FROM players 
            WHERE discord_id IS NULL 
               OR discord_id = '' 
               OR discord_id = 'null' 
               OR discord_id = 'undefined'
               OR NOT discord_id REGEXP '^[0-9]{17,19}$'
        `);
        
        console.log(`Found ${corruptedCount[0].count} corrupted records to clean up...`);
        
        if (corruptedCount[0].count === 0) {
            console.log('✅ No corrupted records found!');
            return;
        }
        
        // Show some examples of corrupted records
        const [corruptedExamples] = await pool.query(`
            SELECT ign, discord_id, server_id, guild_id, linked_at
            FROM players 
            WHERE discord_id IS NULL 
               OR discord_id = '' 
               OR discord_id = 'null' 
               OR discord_id = 'undefined'
               OR NOT discord_id REGEXP '^[0-9]{17,19}$'
            LIMIT 10
        `);
        
        console.log('\nExamples of corrupted records:');
        corruptedExamples.forEach((record, index) => {
            console.log(`${index + 1}. IGN: "${record.ign}" -> Discord ID: "${record.discord_id}"`);
            console.log(`   Server: ${record.server_id}, Guild: ${record.guild_id}`);
            console.log(`   Linked: ${record.linked_at}`);
        });
        
        // Delete the corrupted records
        const [deleteResult] = await pool.query(`
            DELETE FROM players 
            WHERE discord_id IS NULL 
               OR discord_id = '' 
               OR discord_id = 'null' 
               OR discord_id = 'undefined'
               OR NOT discord_id REGEXP '^[0-9]{17,19}$'
        `);
        
        console.log(`\n✅ SUCCESSFULLY DELETED ${deleteResult.affectedRows} corrupted records!`);
        
        // Verify cleanup
        const [remainingCorrupted] = await pool.query(`
            SELECT COUNT(*) as count
            FROM players 
            WHERE discord_id IS NULL 
               OR discord_id = '' 
               OR discord_id = 'null' 
               OR discord_id = 'undefined'
               OR NOT discord_id REGEXP '^[0-9]{17,19}$'
        `);
        
        console.log(`Remaining corrupted records: ${remainingCorrupted[0].count}`);
        
        if (remainingCorrupted[0].count === 0) {
            console.log('🎉 ALL CORRUPTED RECORDS CLEANED UP!');
        } else {
            console.log('⚠️ Some corrupted records still remain');
        }
        
        // Check total active records
        const [totalActive] = await pool.query(`
            SELECT COUNT(*) as count FROM players WHERE is_active = 1
        `);
        
        console.log(`Total active records remaining: ${totalActive[0].count}`);
        
    } catch (error) {
        console.error('❌ Error cleaning up corrupted records:', error);
    } finally {
        await pool.end();
    }
}

// Run cleanup if called directly
if (require.main === module) {
    cleanupCorruptedRecords()
        .then(() => {
            console.log('\n✅ CLEANUP COMPLETE!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ CLEANUP FAILED:', error);
            process.exit(1);
        });
}

module.exports = {
    cleanupCorruptedRecords
};
