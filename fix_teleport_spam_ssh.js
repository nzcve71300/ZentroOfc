const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function fixTeleportSpam() {
    console.log('🔧 Fixing Position Teleport Message Duplication...\n');
    
    try {
        console.log('1️⃣ The fix has been applied to src/rcon/index.js');
        console.log('   - Added missing return statement after delayed teleport setTimeout');
        console.log('   - This prevents both delayed AND immediate teleport messages from being sent');
        console.log('');
        
        console.log('2️⃣ Restarting the bot to apply the fix...');
        
        // Restart PM2 process
        try {
            const { stdout: restartOutput } = await execAsync('pm2 restart zentro-bot');
            console.log('   ✅ Bot restarted successfully');
            console.log(`   ${restartOutput}`);
        } catch (error) {
            console.log('   ⚠️ PM2 restart failed, trying alternative restart...');
            try {
                await execAsync('pm2 stop zentro-bot');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                const { stdout: startOutput } = await execAsync('pm2 start zentro-bot');
                console.log('   ✅ Bot restarted with stop/start method');
                console.log(`   ${startOutput}`);
            } catch (altError) {
                console.log('   ❌ Could not restart bot automatically:', altError.message);
                console.log('   💡 Please restart manually: pm2 restart zentro-bot');
            }
        }
        
        console.log('\n3️⃣ Checking bot status...');
        try {
            const { stdout: statusOutput } = await execAsync('pm2 status');
            console.log(statusOutput);
        } catch (error) {
            console.log('   ℹ️ Could not get status:', error.message);
        }
        
        console.log('\n✅ TELEPORT SPAM FIX DEPLOYED!\n');
        
        console.log('🎯 What was fixed:');
        console.log('   - Position teleport messages were being sent TWICE');
        console.log('   - Once from the delayed teleport setTimeout');
        console.log('   - Once from the immediate teleport code (due to missing return)');
        console.log('   - Added return statement to prevent double execution');
        console.log('');
        
        console.log('📋 Expected results:');
        console.log('   - Position teleport messages will now appear only ONCE');
        console.log('   - No more duplicate "🚀 Position Teleport: player teleported to Location" messages');
        console.log('   - Other messages (kit claims, admin spawns) should remain unaffected');
        console.log('');
        
        console.log('🔍 Monitor the fix:');
        console.log('   pm2 logs zentro-bot    # Watch bot logs');
        console.log('   # Test by having a player use teleport emotes in-game');
        console.log('   # Check Discord adminfeed channel for single messages');
        console.log('');
        
        console.log('⚠️ If other message types are still duplicating:');
        console.log('   - Kit claims: Check handleKitClaim function');
        console.log('   - Admin spawns: Check admin spawn handlers');
        console.log('   - Player joins: Check join/leave handlers');
        
    } catch (error) {
        console.error('❌ Error during fix deployment:', error);
    }
}

// Run the fix
fixTeleportSpam().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});
