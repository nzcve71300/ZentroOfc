const { exec } = require('child_process');

console.log('🔍 Checking bot processes...');

// Check PM2 processes
exec('pm2 list', (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error checking PM2 processes:', error);
        return;
    }
    
    console.log('📋 PM2 Processes:');
    console.log(stdout);
    
    // Check if zentro-bot is running
    if (stdout.includes('zentro-bot')) {
        console.log('✅ zentro-bot is running in PM2');
    } else {
        console.log('❌ zentro-bot not found in PM2');
    }
});

// Check Node.js processes
exec('ps aux | grep node', (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error checking Node processes:', error);
        return;
    }
    
    console.log('\n📋 Node.js Processes:');
    const lines = stdout.split('\n');
    lines.forEach(line => {
        if (line.includes('node') && !line.includes('grep')) {
            console.log(`   ${line.trim()}`);
        }
    });
});

// Check if there are multiple instances
exec('ps aux | grep "zentro-bot" | grep -v grep', (error, stdout, stderr) => {
    if (error) {
        console.log('❌ No zentro-bot processes found');
        return;
    }
    
    const processes = stdout.split('\n').filter(line => line.trim());
    console.log(`\n📋 Found ${processes.length} zentro-bot processes:`);
    processes.forEach((process, index) => {
        console.log(`   ${index + 1}. ${process.trim()}`);
    });
    
    if (processes.length > 1) {
        console.log('\n⚠️ Multiple zentro-bot processes detected! This might cause conflicts.');
        console.log('🔄 Consider restarting with: pm2 restart zentro-bot');
    }
}); 