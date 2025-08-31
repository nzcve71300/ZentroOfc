const pool = require('./src/db');

/**
 * Comprehensive Monitoring Script for Player Linking System
 * This script runs daily to monitor for corrupted records and system health
 */
async function monitorPlayerLinkingSystem() {
    console.log('🔍 PLAYER LINKING SYSTEM MONITOR - Starting daily health check...');
    
    const report = {
        timestamp: new Date().toISOString(),
        checks: {},
        alerts: [],
        recommendations: []
    };

    try {
        // 1. Check for corrupted Discord ID records
        console.log('\n1. Checking for corrupted Discord ID records...');
        const [corruptedRecords] = await pool.query(`
            SELECT COUNT(*) as count
            FROM players 
            WHERE discord_id IS NULL 
               OR discord_id = '' 
               OR discord_id = 'null' 
               OR discord_id = 'undefined'
               OR NOT discord_id REGEXP '^[0-9]{17,19}$'
               OR is_active = 1
        `);
        
        const corruptedCount = corruptedRecords[0].count;
        report.checks.corruptedDiscordIds = corruptedCount;
        
        if (corruptedCount > 0) {
            console.log(`🚨 ALERT: Found ${corruptedCount} corrupted Discord ID records!`);
            report.alerts.push(`Found ${corruptedCount} corrupted Discord ID records`);
            
            // Get details of corrupted records
            const [corruptedDetails] = await pool.query(`
                SELECT ign, discord_id, server_id, guild_id, linked_at
                FROM players 
                WHERE discord_id IS NULL 
                   OR discord_id = '' 
                   OR discord_id = 'null' 
                   OR discord_id = 'undefined'
                   OR NOT discord_id REGEXP '^[0-9]{17,19}$'
                   OR is_active = 1
                LIMIT 10
            `);
            
            console.log('Corrupted records found:');
            corruptedDetails.forEach((record, index) => {
                console.log(`${index + 1}. IGN: "${record.ign}" -> Discord ID: "${record.discord_id}"`);
                console.log(`   Server: ${record.server_id}, Guild: ${record.guild_id}`);
            });
            
            report.recommendations.push('Run cleanup script to remove corrupted records');
        } else {
            console.log('✅ No corrupted Discord ID records found');
        }

        // 2. Check for duplicate active links
        console.log('\n2. Checking for duplicate active links...');
        const [duplicateDiscordLinks] = await pool.query(`
            SELECT discord_id, guild_id, COUNT(*) as count
            FROM players 
            WHERE is_active = 1
            GROUP BY discord_id, guild_id
            HAVING COUNT(*) > 1
        `);
        
        const duplicateDiscordCount = duplicateDiscordLinks.length;
        report.checks.duplicateDiscordLinks = duplicateDiscordCount;
        
        if (duplicateDiscordCount > 0) {
            console.log(`🚨 ALERT: Found ${duplicateDiscordCount} Discord users with duplicate active links!`);
            report.alerts.push(`Found ${duplicateDiscordCount} Discord users with duplicate active links`);
            
            duplicateDiscordLinks.forEach((duplicate, index) => {
                console.log(`${index + 1}. Discord ID: ${duplicate.discord_id}, Guild: ${duplicate.guild_id}, Count: ${duplicate.count}`);
            });
            
            report.recommendations.push('Investigate and resolve duplicate Discord user links');
        } else {
            console.log('✅ No duplicate Discord user links found');
        }

        // 3. Check for duplicate IGN links
        console.log('\n3. Checking for duplicate IGN links...');
        const [duplicateIgnLinks] = await pool.query(`
            SELECT ign, guild_id, COUNT(*) as count
            FROM players 
            WHERE is_active = 1
            GROUP BY ign, guild_id
            HAVING COUNT(*) > 1
        `);
        
        const duplicateIgnCount = duplicateIgnLinks.length;
        report.checks.duplicateIgnLinks = duplicateIgnCount;
        
        if (duplicateIgnCount > 0) {
            console.log(`🚨 ALERT: Found ${duplicateIgnCount} IGNs with duplicate active links!`);
            report.alerts.push(`Found ${duplicateIgnCount} IGNs with duplicate active links`);
            
            duplicateIgnLinks.forEach((duplicate, index) => {
                console.log(`${index + 1}. IGN: "${duplicate.ign}", Guild: ${duplicate.guild_id}, Count: ${duplicate.count}`);
            });
            
            report.recommendations.push('Investigate and resolve duplicate IGN links');
        } else {
            console.log('✅ No duplicate IGN links found');
        }

        // 4. Check for orphaned records (no corresponding server)
        console.log('\n4. Checking for orphaned records...');
        const [orphanedRecords] = await pool.query(`
            SELECT COUNT(*) as count
            FROM players p
            LEFT JOIN rust_servers rs ON p.server_id = rs.id
            WHERE rs.id IS NULL AND p.is_active = 1
        `);
        
        const orphanedCount = orphanedRecords[0].count;
        report.checks.orphanedRecords = orphanedCount;
        
        if (orphanedCount > 0) {
            console.log(`🚨 ALERT: Found ${orphanedCount} orphaned player records!`);
            report.alerts.push(`Found ${orphanedCount} orphaned player records`);
            report.recommendations.push('Clean up orphaned records or restore missing servers');
        } else {
            console.log('✅ No orphaned records found');
        }

        // 5. Check system statistics
        console.log('\n5. Checking system statistics...');
        const [totalRecords] = await pool.query(`
            SELECT COUNT(*) as count FROM players WHERE is_active = 1
        `);
        
        const [totalServers] = await pool.query(`
            SELECT COUNT(*) as count FROM rust_servers
        `);
        
        const [totalGuilds] = await pool.query(`
            SELECT COUNT(DISTINCT guild_id) as count FROM players WHERE is_active = 1
        `);
        
        report.checks.totalActiveRecords = totalRecords[0].count;
        report.checks.totalServers = totalServers[0].count;
        report.checks.totalGuilds = totalGuilds[0].count;
        
        console.log(`📊 System Statistics:`);
        console.log(`   - Total active player records: ${totalRecords[0].count}`);
        console.log(`   - Total servers: ${totalServers[0].count}`);
        console.log(`   - Total guilds with links: ${totalGuilds[0].count}`);

        // 6. Check recent activity
        console.log('\n6. Checking recent activity...');
        const [recentLinks] = await pool.query(`
            SELECT COUNT(*) as count
            FROM players 
            WHERE linked_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND is_active = 1
        `);
        
        const [recentErrors] = await pool.query(`
            SELECT COUNT(*) as count
            FROM player_audit_log 
            WHERE action = 'ERROR'
            AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);
        
        report.checks.recentLinks24h = recentLinks[0].count;
        report.checks.recentErrors24h = recentErrors[0].count;
        
        console.log(`📈 Recent Activity (24h):`);
        console.log(`   - New links: ${recentLinks[0].count}`);
        console.log(`   - Errors: ${recentErrors[0].count}`);

        // 7. Performance check
        console.log('\n7. Checking database performance...');
        const [slowQueries] = await pool.query(`
            SELECT COUNT(*) as count
            FROM information_schema.processlist
            WHERE command = 'Query'
            AND time > 5
        `);
        
        report.checks.slowQueries = slowQueries[0].count;
        
        if (slowQueries[0].count > 0) {
            console.log(`⚠️ WARNING: ${slowQueries[0].count} slow queries detected`);
            report.recommendations.push('Investigate slow queries for performance optimization');
        } else {
            console.log('✅ No slow queries detected');
        }

        // 8. Generate summary report
        console.log('\n📋 MONITORING SUMMARY:');
        console.log(`Timestamp: ${report.timestamp}`);
        console.log(`Total Checks: ${Object.keys(report.checks).length}`);
        console.log(`Alerts: ${report.alerts.length}`);
        console.log(`Recommendations: ${report.recommendations.length}`);
        
        if (report.alerts.length > 0) {
            console.log('\n🚨 ALERTS:');
            report.alerts.forEach((alert, index) => {
                console.log(`${index + 1}. ${alert}`);
            });
        }
        
        if (report.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS:');
            report.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
        }

        // 9. Save report to database for historical tracking
        await pool.query(`
            INSERT INTO monitoring_reports (
                timestamp, 
                checks_json, 
                alerts_json, 
                recommendations_json,
                total_alerts,
                total_recommendations
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            report.timestamp,
            JSON.stringify(report.checks),
            JSON.stringify(report.alerts),
            JSON.stringify(report.recommendations),
            report.alerts.length,
            report.recommendations.length
        ]);

        console.log('\n✅ MONITORING COMPLETE - Report saved to database');

        // 10. Return severity level for external monitoring
        const severity = report.alerts.length > 0 ? 'HIGH' : 'LOW';
        console.log(`🔔 Severity Level: ${severity}`);
        
        return {
            severity,
            report
        };

    } catch (error) {
        console.error('❌ MONITORING ERROR:', error);
        return {
            severity: 'CRITICAL',
            error: error.message,
            report: null
        };
    } finally {
        await pool.end();
    }
}

// Create monitoring reports table if it doesn't exist
async function createMonitoringTable() {
    try {
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
    } catch (error) {
        console.error('❌ Error creating monitoring table:', error);
    }
}

// Run monitoring if called directly
if (require.main === module) {
    createMonitoringTable()
        .then(() => monitorPlayerLinkingSystem())
        .then(result => {
            console.log('\n🎯 MONITORING RESULT:', result);
            process.exit(result.severity === 'CRITICAL' ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ MONITORING FAILED:', error);
            process.exit(1);
        });
}

module.exports = {
    monitorPlayerLinkingSystem,
    createMonitoringTable
};
