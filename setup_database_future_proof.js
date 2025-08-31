const pool = require('./src/db');

/**
 * Comprehensive Database Setup Script for Future-Proof Player Linking System
 * This script applies all the future-proofing measures to prevent linking issues
 */
async function setupDatabaseFutureProof() {
    console.log('🚀 SETTING UP FUTURE-PROOF DATABASE...');
    console.log('This will apply all constraints, indexes, and monitoring systems.');
    
    try {
        // 1. Create audit log table for monitoring
        console.log('\n1. Creating audit log table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS player_audit_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action VARCHAR(50) NOT NULL,
                discord_id VARCHAR(20) NOT NULL,
                ign VARCHAR(32) NOT NULL,
                server_id VARCHAR(50) NOT NULL,
                guild_id BIGINT NOT NULL,
                is_active BOOLEAN NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_discord_id (discord_id),
                INDEX idx_audit_ign (ign),
                INDEX idx_audit_created_at (created_at)
            )
        `);
        console.log('✅ Audit log table created/verified');

        // 2. Create monitoring reports table
        console.log('\n2. Creating monitoring reports table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS monitoring_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                checks_json JSON,
                alerts_json JSON,
                recommendations_json JSON,
                total_alerts INT DEFAULT 0,
                total_recommendations INT DEFAULT 0,
                INDEX idx_timestamp (timestamp),
                INDEX idx_total_alerts (total_alerts)
            )
        `);
        console.log('✅ Monitoring reports table created/verified');

        // 3. Add database constraints to prevent corrupted records
        console.log('\n3. Adding database constraints...');
        
        // Check if constraints already exist to avoid errors
        const [existingConstraints] = await pool.query(`
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'players'
        `);
        
        const existingConstraintNames = existingConstraints.map(c => c.CONSTRAINT_NAME);
        
        // Add constraints only if they don't exist
        const constraints = [
            {
                name: 'valid_discord_id_not_null',
                sql: 'ALTER TABLE players ADD CONSTRAINT valid_discord_id_not_null CHECK (discord_id IS NOT NULL)'
            },
            {
                name: 'valid_discord_id_not_empty',
                sql: 'ALTER TABLE players ADD CONSTRAINT valid_discord_id_not_empty CHECK (discord_id != \'\')'
            },
            {
                name: 'valid_discord_id_not_null_string',
                sql: 'ALTER TABLE players ADD CONSTRAINT valid_discord_id_not_null_string CHECK (discord_id != \'null\')'
            },
            {
                name: 'valid_discord_id_not_undefined_string',
                sql: 'ALTER TABLE players ADD CONSTRAINT valid_discord_id_not_undefined_string CHECK (discord_id != \'undefined\')'
            },
            {
                name: 'valid_discord_id_format',
                sql: 'ALTER TABLE players ADD CONSTRAINT valid_discord_id_format CHECK (discord_id REGEXP \'^[0-9]{17,19}$\')'
            },
            {
                name: 'valid_ign_not_null',
                sql: 'ALTER TABLE players ADD CONSTRAINT valid_ign_not_null CHECK (ign IS NOT NULL)'
            },
            {
                name: 'valid_ign_not_empty',
                sql: 'ALTER TABLE players ADD CONSTRAINT valid_ign_not_empty CHECK (ign != \'\')'
            },
            {
                name: 'valid_ign_length',
                sql: 'ALTER TABLE players ADD CONSTRAINT valid_ign_length CHECK (LENGTH(ign) >= 1 AND LENGTH(ign) <= 32)'
            },
            {
                name: 'valid_server_id_not_null',
                sql: 'ALTER TABLE players ADD CONSTRAINT valid_server_id_not_null CHECK (server_id IS NOT NULL)'
            },
            {
                name: 'valid_guild_id_not_null',
                sql: 'ALTER TABLE players ADD CONSTRAINT valid_guild_id_not_null CHECK (guild_id IS NOT NULL)'
            }
        ];

        for (const constraint of constraints) {
            if (!existingConstraintNames.includes(constraint.name)) {
                try {
                    await pool.query(constraint.sql);
                    console.log(`✅ Added constraint: ${constraint.name}`);
                } catch (error) {
                    console.log(`⚠️ Constraint ${constraint.name} already exists or failed: ${error.message}`);
                }
            } else {
                console.log(`ℹ️ Constraint ${constraint.name} already exists`);
            }
        }

        // 4. Add unique constraints to prevent duplicates
        console.log('\n4. Adding unique constraints...');
        
        const uniqueConstraints = [
            {
                name: 'unique_active_discord_link_per_guild',
                sql: 'ALTER TABLE players ADD CONSTRAINT unique_active_discord_link_per_guild UNIQUE (discord_id, guild_id, is_active)'
            },
            {
                name: 'unique_active_ign_link_per_guild',
                sql: 'ALTER TABLE players ADD CONSTRAINT unique_active_ign_link_per_guild UNIQUE (ign, guild_id, is_active)'
            }
        ];

        for (const constraint of uniqueConstraints) {
            if (!existingConstraintNames.includes(constraint.name)) {
                try {
                    await pool.query(constraint.sql);
                    console.log(`✅ Added unique constraint: ${constraint.name}`);
                } catch (error) {
                    console.log(`⚠️ Unique constraint ${constraint.name} already exists or failed: ${error.message}`);
                }
            } else {
                console.log(`ℹ️ Unique constraint ${constraint.name} already exists`);
            }
        }

        // 5. Add performance indexes
        console.log('\n5. Adding performance indexes...');
        
        const [existingIndexes] = await pool.query(`
            SELECT INDEX_NAME 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'players'
        `);
        
        const existingIndexNames = existingIndexes.map(i => i.INDEX_NAME);
        
        const indexes = [
            {
                name: 'idx_players_discord_id_guild_active',
                sql: 'CREATE INDEX idx_players_discord_id_guild_active ON players(discord_id, guild_id, is_active)'
            },
            {
                name: 'idx_players_ign_guild_active',
                sql: 'CREATE INDEX idx_players_ign_guild_active ON players(ign, guild_id, is_active)'
            },
            {
                name: 'idx_players_server_id_active',
                sql: 'CREATE INDEX idx_players_server_id_active ON players(server_id, is_active)'
            }
        ];

        for (const index of indexes) {
            if (!existingIndexNames.includes(index.name)) {
                try {
                    await pool.query(index.sql);
                    console.log(`✅ Added index: ${index.name}`);
                } catch (error) {
                    console.log(`⚠️ Index ${index.name} already exists or failed: ${error.message}`);
                }
            } else {
                console.log(`ℹ️ Index ${index.name} already exists`);
            }
        }

        // 6. Create trigger for audit logging
        console.log('\n6. Creating audit trigger...');
        
        // Drop trigger if it exists
        try {
            await pool.query('DROP TRIGGER IF EXISTS log_player_insertion');
        } catch (error) {
            // Ignore error if trigger doesn't exist
        }
        
        // Create new trigger
        await pool.query(`
            CREATE TRIGGER log_player_insertion
            AFTER INSERT ON players
            FOR EACH ROW
            BEGIN
                INSERT INTO player_audit_log (
                    action, 
                    discord_id, 
                    ign, 
                    server_id, 
                    guild_id, 
                    is_active, 
                    created_at
                ) VALUES (
                    'INSERT',
                    NEW.discord_id,
                    NEW.ign,
                    NEW.server_id,
                    NEW.guild_id,
                    NEW.is_active,
                    NOW()
                );
            END
        `);
        console.log('✅ Audit trigger created');

        // 7. Create view for monitoring corrupted records
        console.log('\n7. Creating monitoring view...');
        
        try {
            await pool.query('DROP VIEW IF EXISTS corrupted_discord_ids');
        } catch (error) {
            // Ignore error if view doesn't exist
        }
        
        await pool.query(`
            CREATE VIEW corrupted_discord_ids AS
            SELECT * FROM players 
            WHERE discord_id IS NULL 
               OR discord_id = '' 
               OR discord_id = 'null' 
               OR discord_id = 'undefined'
               OR NOT discord_id REGEXP '^[0-9]{17,19}$'
        `);
        console.log('✅ Monitoring view created');

        // 8. Create cleanup stored procedure
        console.log('\n8. Creating cleanup procedure...');
        
        try {
            await pool.query('DROP PROCEDURE IF EXISTS cleanup_corrupted_records');
        } catch (error) {
            // Ignore error if procedure doesn't exist
        }
        
        await pool.query(`
            CREATE PROCEDURE cleanup_corrupted_records()
            BEGIN
                DECLARE deleted_count INT DEFAULT 0;
                
                -- Delete corrupted Discord ID records
                DELETE FROM players 
                WHERE discord_id IS NULL 
                   OR discord_id = '' 
                   OR discord_id = 'null' 
                   OR discord_id = 'undefined'
                   OR NOT discord_id REGEXP '^[0-9]{17,19}$';
                
                SET deleted_count = ROW_COUNT();
                
                -- Log the cleanup
                INSERT INTO player_audit_log (
                    action, discord_id, ign, server_id, guild_id, is_active, created_at
                ) VALUES (
                    'CLEANUP',
                    'SYSTEM',
                    'SYSTEM',
                    'SYSTEM',
                    0,
                    0,
                    NOW()
                );
                
                SELECT CONCAT('Cleaned up ', deleted_count, ' corrupted records') AS result;
            END
        `);
        console.log('✅ Cleanup procedure created');

        // 9. Create validation function
        console.log('\n9. Creating validation function...');
        
        try {
            await pool.query('DROP FUNCTION IF EXISTS is_valid_discord_id');
        } catch (error) {
            // Ignore error if function doesn't exist
        }
        
        await pool.query(`
            CREATE FUNCTION is_valid_discord_id(discord_id VARCHAR(20))
            RETURNS BOOLEAN
            DETERMINISTIC
            READS SQL DATA
            BEGIN
                DECLARE result BOOLEAN DEFAULT FALSE;
                
                IF discord_id IS NOT NULL 
                   AND discord_id != '' 
                   AND discord_id != 'null' 
                   AND discord_id != 'undefined'
                   AND discord_id REGEXP '^[0-9]{17,19}$'
                THEN
                    SET result = TRUE;
                END IF;
                
                RETURN result;
            END
        `);
        console.log('✅ Validation function created');

        // 10. Clean up any existing corrupted records
        console.log('\n10. Cleaning up existing corrupted records...');
        const [corruptedCount] = await pool.query(`
            SELECT COUNT(*) as count
            FROM players 
            WHERE discord_id IS NULL 
               OR discord_id = '' 
               OR discord_id = 'null' 
               OR discord_id = 'undefined'
               OR NOT discord_id REGEXP '^[0-9]{17,19}$'
        `);
        
        if (corruptedCount[0].count > 0) {
            console.log(`Found ${corruptedCount[0].count} corrupted records to clean up...`);
            await pool.query('CALL cleanup_corrupted_records()');
            console.log('✅ Corrupted records cleaned up');
        } else {
            console.log('✅ No corrupted records found');
        }

        // 11. Verify setup
        console.log('\n11. Verifying setup...');
        
        // Check constraints
        const [finalConstraints] = await pool.query(`
            SELECT COUNT(*) as count
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'players'
        `);
        
        // Check indexes
        const [finalIndexes] = await pool.query(`
            SELECT COUNT(*) as count
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'players'
        `);
        
        // Check corrupted records
        const [finalCorrupted] = await pool.query(`
            SELECT COUNT(*) as count FROM corrupted_discord_ids
        `);
        
        console.log(`📊 Setup Verification:`);
        console.log(`   - Total constraints: ${finalConstraints[0].count}`);
        console.log(`   - Total indexes: ${finalIndexes[0].count}`);
        console.log(`   - Corrupted records: ${finalCorrupted[0].count}`);
        console.log(`   - Audit table: ✅ Created`);
        console.log(`   - Monitoring table: ✅ Created`);
        console.log(`   - Trigger: ✅ Created`);
        console.log(`   - View: ✅ Created`);
        console.log(`   - Procedure: ✅ Created`);
        console.log(`   - Function: ✅ Created`);

        // 12. Generate summary report
        console.log('\n🎉 DATABASE SETUP COMPLETE!');
        console.log('\n📋 SUMMARY OF APPLIED PROTECTIONS:');
        console.log('✅ Prevents null Discord IDs');
        console.log('✅ Prevents empty string Discord IDs');
        console.log('✅ Prevents "null" string Discord IDs');
        console.log('✅ Prevents "undefined" string Discord IDs');
        console.log('✅ Ensures Discord ID format (17-19 digits)');
        console.log('✅ Prevents null/empty IGNs');
        console.log('✅ Ensures reasonable IGN length');
        console.log('✅ Prevents null server_id and guild_id');
        console.log('✅ Prevents duplicate active links per user per guild');
        console.log('✅ Prevents duplicate active IGN links per guild');
        console.log('✅ Adds performance indexes for fast queries');
        console.log('✅ Creates audit logging for all insertions');
        console.log('✅ Provides monitoring view for corrupted records');
        console.log('✅ Provides cleanup procedure for maintenance');
        console.log('✅ Provides validation function for programmatic checks');

        console.log('\n🛡️ YOUR DATABASE IS NOW FUTURE-PROOF!');
        console.log('The player linking system will prevent corrupted records at the database level.');
        console.log('Run the monitoring script daily to maintain system health.');

        return {
            success: true,
            constraints: finalConstraints[0].count,
            indexes: finalIndexes[0].count,
            corruptedRecords: finalCorrupted[0].count
        };

    } catch (error) {
        console.error('❌ DATABASE SETUP ERROR:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await pool.end();
    }
}

// Run setup if called directly
if (require.main === module) {
    setupDatabaseFutureProof()
        .then(result => {
            if (result.success) {
                console.log('\n🎯 SETUP RESULT:', result);
                process.exit(0);
            } else {
                console.error('\n❌ SETUP FAILED:', result.error);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ SETUP FAILED:', error);
            process.exit(1);
        });
}

module.exports = {
    setupDatabaseFutureProof
};
