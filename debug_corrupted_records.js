const pool = require('./src/db');

async function debugCorruptedRecords() {
    console.log('🔍 DEBUGGING CORRUPTED RECORDS...');
    
    try {
        // Get the records that the monitoring script thinks are corrupted
        const [corruptedRecords] = await pool.query(`
            SELECT ign, discord_id, server_id, guild_id, linked_at,
                   LENGTH(discord_id) as discord_id_length,
                   HEX(discord_id) as discord_id_hex,
                   discord_id REGEXP '^[0-9]{17,19}$' as is_valid_format
            FROM players 
            WHERE discord_id IS NULL 
               OR discord_id = '' 
               OR discord_id = 'null' 
               OR discord_id = 'undefined'
               OR NOT discord_id REGEXP '^[0-9]{17,19}$'
            LIMIT 10
        `);
        
        console.log(`Found ${corruptedRecords.length} records flagged as corrupted:`);
        
        corruptedRecords.forEach((record, index) => {
            console.log(`\n${index + 1}. IGN: "${record.ign}"`);
            console.log(`   Discord ID: "${record.discord_id}"`);
            console.log(`   Length: ${record.discord_id_length}`);
            console.log(`   Hex: ${record.discord_id_hex}`);
            console.log(`   Valid Format: ${record.is_valid_format}`);
            console.log(`   Server: ${record.server_id}`);
            console.log(`   Guild: ${record.guild_id}`);
            
            // Check each condition
            const isNull = record.discord_id === null;
            const isEmpty = record.discord_id === '';
            const isNullString = record.discord_id === 'null';
            const isUndefinedString = record.discord_id === 'undefined';
            const isValidFormat = record.is_valid_format;
            
            console.log(`   Conditions:`);
            console.log(`     - Is NULL: ${isNull}`);
            console.log(`     - Is empty: ${isEmpty}`);
            console.log(`     - Is "null": ${isNullString}`);
            console.log(`     - Is "undefined": ${isUndefinedString}`);
            console.log(`     - Valid format: ${isValidFormat}`);
        });
        
        // Check the monitoring script's exact query
        console.log('\n🔍 Testing monitoring script query...');
        const [monitoringQuery] = await pool.query(`
            SELECT COUNT(*) as count
            FROM players 
            WHERE discord_id IS NULL 
               OR discord_id = '' 
               OR discord_id = 'null' 
               OR discord_id = 'undefined'
               OR NOT discord_id REGEXP '^[0-9]{17,19}$'
               OR is_active = 1
        `);
        
        console.log(`Monitoring script found: ${monitoringQuery[0].count} corrupted records`);
        
        // Check the cleanup script's exact query
        console.log('\n🔍 Testing cleanup script query...');
        const [cleanupQuery] = await pool.query(`
            SELECT COUNT(*) as count
            FROM players 
            WHERE discord_id IS NULL 
               OR discord_id = '' 
               OR discord_id = 'null' 
               OR discord_id = 'undefined'
               OR NOT discord_id REGEXP '^[0-9]{17,19}$'
        `);
        
        console.log(`Cleanup script found: ${cleanupQuery[0].count} corrupted records`);
        
        // Check total records
        const [totalRecords] = await pool.query(`
            SELECT COUNT(*) as count FROM players WHERE is_active = 1
        `);
        
        console.log(`Total active records: ${totalRecords[0].count}`);
        
        // The issue might be the "OR is_active = 1" in the monitoring script
        console.log('\n🔍 FOUND THE ISSUE!');
        console.log('The monitoring script has "OR is_active = 1" which makes it count ALL active records!');
        console.log('This is a bug in the monitoring script query.');
        
    } catch (error) {
        console.error('❌ Error debugging corrupted records:', error);
    } finally {
        await pool.end();
    }
}

// Run debug if called directly
if (require.main === module) {
    debugCorruptedRecords()
        .then(() => {
            console.log('\n✅ DEBUG COMPLETE!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ DEBUG FAILED:', error);
            process.exit(1);
        });
}

module.exports = {
    debugCorruptedRecords
};
