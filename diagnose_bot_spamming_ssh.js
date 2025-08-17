const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
require('dotenv').config();

async function diagnoseBotSpamming() {
    console.log('🔍 Diagnosing Bot Channel Spamming Issue...\n');
    
    try {
        // 1. Check for multiple bot processes
        console.log('1️⃣ Checking for multiple bot processes...');
        try {
            const { stdout } = await execAsync('ps aux | grep -i "node.*index" | grep -v grep');
            const processes = stdout.trim().split('\n').filter(line => line.trim());
            console.log(`   Found ${processes.length} Node.js processes:`);
            processes.forEach((proc, index) => {
                console.log(`   ${index + 1}. ${proc}`);
            });
            
            if (processes.length > 1) {
                console.log('   🚨 MULTIPLE BOT PROCESSES DETECTED! This could cause duplicate messaging.');
            } else {
                console.log('   ✅ Only one bot process found');
            }
        } catch (error) {
            console.log('   ❌ Could not check processes:', error.message);
        }
        
        // 2. Check PM2 processes if available
        console.log('\n2️⃣ Checking PM2 processes...');
        try {
            const { stdout } = await execAsync('pm2 list');
            console.log('   PM2 processes:');
            console.log(stdout);
        } catch (error) {
            console.log('   ℹ️ PM2 not available or no processes running');
        }
        
        // 3. Check database for active servers
        console.log('\n3️⃣ Checking database for server configurations...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'zentro_bot',
            port: process.env.DB_PORT || 3306
        });
        
        // Get all servers and their channel settings
        const [servers] = await connection.query(`
            SELECT 
                g.discord_id,
                g.name as guild_name,
                rs.id as server_id,
                rs.nickname,
                rs.ip,
                rs.port,
                COUNT(cs.id) as channel_count
            FROM guilds g
            JOIN rust_servers rs ON g.id = rs.guild_id
            LEFT JOIN channel_settings cs ON rs.id = cs.server_id
            GROUP BY g.discord_id, g.name, rs.id, rs.nickname, rs.ip, rs.port
            ORDER BY g.discord_id
        `);
        
        console.log(`   Found ${servers.length} servers in database:`);
        servers.forEach(server => {
            console.log(`   - ${server.guild_name} (${server.discord_id}): ${server.nickname} (${server.ip}:${server.port}) - ${server.channel_count} channels`);
        });
        
        // 4. Check for specific guilds with multiple servers
        console.log('\n4️⃣ Checking for guilds with multiple servers...');
        const [guildServerCounts] = await connection.query(`
            SELECT 
                g.discord_id,
                g.name,
                COUNT(rs.id) as server_count
            FROM guilds g
            JOIN rust_servers rs ON g.id = rs.guild_id
            GROUP BY g.discord_id, g.name
            HAVING COUNT(rs.id) > 1
        `);
        
        if (guildServerCounts.length > 0) {
            console.log('   🚨 Guilds with multiple servers (potential for confusion):');
            guildServerCounts.forEach(guild => {
                console.log(`   - ${guild.name} (${guild.discord_id}): ${guild.server_count} servers`);
            });
        } else {
            console.log('   ✅ No guilds with multiple servers');
        }
        
        // 5. Check for duplicate IP/Port combinations
        console.log('\n5️⃣ Checking for duplicate server IP/Port combinations...');
        const [duplicateServers] = await connection.query(`
            SELECT 
                ip,
                port,
                COUNT(*) as count,
                GROUP_CONCAT(CONCAT(nickname, ' (', discord_id, ')') SEPARATOR ', ') as servers
            FROM rust_servers rs
            JOIN guilds g ON rs.guild_id = g.id
            GROUP BY ip, port
            HAVING COUNT(*) > 1
        `);
        
        if (duplicateServers.length > 0) {
            console.log('   🚨 DUPLICATE SERVER IP/PORT COMBINATIONS FOUND:');
            duplicateServers.forEach(dup => {
                console.log(`   - ${dup.ip}:${dup.port} used by ${dup.count} servers: ${dup.servers}`);
            });
        } else {
            console.log('   ✅ No duplicate IP/Port combinations');
        }
        
        // 6. Check channel settings for the problem guilds specifically
        console.log('\n6️⃣ Detailed channel analysis for problem guilds...');
        const problemGuilds = ['1406308741628039228', '1390476170872750080'];
        
        for (const guildId of problemGuilds) {
            console.log(`\n   Analyzing guild ${guildId}:`);
            const [channelDetails] = await connection.query(`
                SELECT 
                    rs.nickname,
                    cs.channel_type,
                    cs.channel_id,
                    cs.created_at,
                    cs.updated_at
                FROM channel_settings cs
                JOIN rust_servers rs ON cs.server_id = rs.id
                JOIN guilds g ON rs.guild_id = g.id
                WHERE g.discord_id = ?
                ORDER BY rs.nickname, cs.channel_type
            `, [guildId]);
            
            if (channelDetails.length > 0) {
                console.log(`     ${channelDetails.length} channel settings:`);
                channelDetails.forEach(ch => {
                    console.log(`     - ${ch.nickname}: ${ch.channel_type} -> ${ch.channel_id} (created: ${ch.created_at})`);
                });
            } else {
                console.log(`     No channel settings found`);
            }
        }
        
        // 7. Check for potential RCON connection issues
        console.log('\n7️⃣ Checking server connectivity...');
        const activeServers = servers.filter(s => 
            s.ip && 
            s.ip !== '0.0.0.0' && 
            s.ip !== 'PLACEHOLDER_IP' && 
            s.port && 
            s.port > 0
        );
        
        console.log(`   ${activeServers.length} servers have valid IP/Port configurations`);
        
        // 8. Look for timing-related issues
        console.log('\n8️⃣ Recommendations based on findings...');
        
        if (processes.length > 1) {
            console.log('   🔧 CRITICAL: Kill duplicate bot processes:');
            console.log('      pm2 stop all && pm2 delete all');
            console.log('      OR manually kill processes and restart only one instance');
        }
        
        if (duplicateServers.length > 0) {
            console.log('   🔧 WARNING: Multiple bots connecting to same server will cause duplicate messages');
            console.log('      Review your server configurations and remove duplicates');
        }
        
        console.log('\n   📋 General troubleshooting steps:');
        console.log('   1. Stop all bot instances: pm2 stop all');
        console.log('   2. Check for any remaining processes: ps aux | grep node');
        console.log('   3. Kill any remaining bot processes manually');
        console.log('   4. Start only ONE bot instance: pm2 start ecosystem.config.js');
        console.log('   5. Monitor logs: pm2 logs');
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Error during diagnosis:', error);
    }
    
    console.log('\n✅ Diagnosis complete!');
}

// Run the diagnosis
diagnoseBotSpamming().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});
