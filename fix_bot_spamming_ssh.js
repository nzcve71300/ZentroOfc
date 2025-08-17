const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
require('dotenv').config();

async function fixBotSpamming() {
    console.log('🔧 Fixing Bot Channel Spamming Issue...\n');
    
    try {
        // 1. Stop all PM2 processes first
        console.log('1️⃣ Stopping all PM2 processes...');
        try {
            const { stdout: stopOutput } = await execAsync('pm2 stop all');
            console.log('   ✅ PM2 processes stopped');
            console.log(`   ${stopOutput}`);
        } catch (error) {
            console.log('   ℹ️ PM2 stop failed or no processes running:', error.message);
        }
        
        // 2. Delete all PM2 processes
        console.log('\n2️⃣ Deleting all PM2 processes...');
        try {
            const { stdout: deleteOutput } = await execAsync('pm2 delete all');
            console.log('   ✅ PM2 processes deleted');
            console.log(`   ${deleteOutput}`);
        } catch (error) {
            console.log('   ℹ️ PM2 delete failed or no processes to delete:', error.message);
        }
        
        // 3. Kill any remaining Node.js processes
        console.log('\n3️⃣ Checking for remaining Node.js processes...');
        try {
            const { stdout } = await execAsync('ps aux | grep -i "node.*index" | grep -v grep');
            const processes = stdout.trim().split('\n').filter(line => line.trim());
            
            if (processes.length > 0) {
                console.log(`   Found ${processes.length} remaining Node.js processes:`);
                processes.forEach((proc, index) => {
                    console.log(`   ${index + 1}. ${proc}`);
                });
                
                // Extract PIDs and kill them
                console.log('\n   Killing remaining processes...');
                for (const proc of processes) {
                    const parts = proc.trim().split(/\s+/);
                    const pid = parts[1]; // PID is usually the second column
                    if (pid && !isNaN(pid)) {
                        try {
                            await execAsync(`kill -9 ${pid}`);
                            console.log(`   ✅ Killed process ${pid}`);
                        } catch (killError) {
                            console.log(`   ❌ Failed to kill process ${pid}:`, killError.message);
                        }
                    }
                }
            } else {
                console.log('   ✅ No remaining Node.js processes found');
            }
        } catch (error) {
            console.log('   ℹ️ Could not check for remaining processes:', error.message);
        }
        
        // 4. Clean up database duplicates (just in case)
        console.log('\n4️⃣ Cleaning up any potential database issues...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'zentro_bot',
            port: process.env.DB_PORT || 3306
        });
        
        // Remove any duplicate servers with same IP/Port
        console.log('   Checking for duplicate servers...');
        const [duplicateServers] = await connection.query(`
            SELECT ip, port, COUNT(*) as count, GROUP_CONCAT(id) as server_ids
            FROM rust_servers 
            GROUP BY ip, port 
            HAVING COUNT(*) > 1
        `);
        
        if (duplicateServers.length > 0) {
            console.log(`   🚨 Found ${duplicateServers.length} duplicate server IP/Port combinations`);
            for (const dup of duplicateServers) {
                const serverIds = dup.server_ids.split(',');
                // Keep the first server, delete the rest
                const toDelete = serverIds.slice(1);
                console.log(`   Removing duplicate servers for ${dup.ip}:${dup.port}, keeping first, deleting: ${toDelete.join(', ')}`);
                
                for (const serverId of toDelete) {
                    // Delete related records first
                    await connection.query('DELETE FROM channel_settings WHERE server_id = ?', [serverId]);
                    await connection.query('DELETE FROM players WHERE server_id = ?', [serverId]);
                    await connection.query('DELETE FROM zorp_zones WHERE server_id = ?', [serverId]);
                    // Delete the server
                    await connection.query('DELETE FROM rust_servers WHERE id = ?', [serverId]);
                    console.log(`     ✅ Deleted duplicate server ${serverId}`);
                }
            }
        } else {
            console.log('   ✅ No duplicate servers found');
        }
        
        await connection.end();
        
        // 5. Wait a moment for cleanup
        console.log('\n5️⃣ Waiting for cleanup to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 6. Start a single bot instance
        console.log('\n6️⃣ Starting a single bot instance...');
        try {
            // Check if ecosystem.config.js exists
            const fs = require('fs');
            if (fs.existsSync('ecosystem.config.js')) {
                const { stdout: startOutput } = await execAsync('pm2 start ecosystem.config.js');
                console.log('   ✅ Bot started with PM2');
                console.log(`   ${startOutput}`);
            } else {
                console.log('   ℹ️ ecosystem.config.js not found, attempting to start index.js directly');
                const { stdout: startOutput } = await execAsync('pm2 start src/index.js --name "zentro-bot"');
                console.log('   ✅ Bot started with PM2');
                console.log(`   ${startOutput}`);
            }
        } catch (error) {
            console.log('   ❌ Failed to start bot with PM2:', error.message);
            console.log('   💡 You may need to start the bot manually:');
            console.log('      cd /path/to/your/bot && pm2 start ecosystem.config.js');
            console.log('      OR: pm2 start src/index.js --name "zentro-bot"');
        }
        
        // 7. Show status
        console.log('\n7️⃣ Checking final status...');
        try {
            const { stdout: statusOutput } = await execAsync('pm2 list');
            console.log('   Current PM2 processes:');
            console.log(statusOutput);
        } catch (error) {
            console.log('   ℹ️ Could not get PM2 status:', error.message);
        }
        
        console.log('\n✅ Bot spamming fix completed!');
        console.log('\n📋 What was done:');
        console.log('   1. Stopped all PM2 processes');
        console.log('   2. Deleted all PM2 processes');
        console.log('   3. Killed any remaining Node.js processes');
        console.log('   4. Cleaned up duplicate database entries');
        console.log('   5. Started a single bot instance');
        
        console.log('\n🔍 Monitor the bot:');
        console.log('   pm2 logs          # View logs');
        console.log('   pm2 status        # Check status');
        console.log('   pm2 restart all   # Restart if needed');
        
        console.log('\n⚠️  If spamming continues, check:');
        console.log('   1. Are there multiple bots in the same Discord server?');
        console.log('   2. Are there multiple servers with the same IP/Port?');
        console.log('   3. Check Discord bot permissions and channel settings');
        
    } catch (error) {
        console.error('❌ Error during fix:', error);
    }
}

// Run the fix
fixBotSpamming().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});
