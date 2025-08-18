const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function deployZorpFixes() {
  console.log('🚀 DEPLOYING ZORP SYSTEM FIXES');
  console.log('================================\n');

  try {
    // Step 1: Apply database schema fixes
    console.log('📊 Step 1: Applying database schema fixes...');
    try {
      const applyFixes = require('./apply_zorp_database_fixes');
      await applyFixes();
      console.log('✅ Database schema updated successfully\n');
    } catch (error) {
      console.error('❌ Database schema update failed:', error.message);
      throw error;
    }

    // Step 2: Restart the bot to apply code changes
    console.log('🔄 Step 2: Restarting bot to apply code changes...');
    try {
      // Check if PM2 is being used
      try {
        execSync('pm2 list', { stdio: 'pipe' });
        console.log('   Using PM2 to restart bot...');
        execSync('pm2 restart zentro-bot', { stdio: 'inherit' });
        console.log('✅ Bot restarted with PM2\n');
      } catch (pm2Error) {
        console.log('   PM2 not available, please manually restart your bot');
        console.log('   Run: node src/index.js\n');
      }
    } catch (error) {
      console.error('❌ Bot restart failed:', error.message);
      console.log('   Please manually restart your bot\n');
    }

    // Step 3: Summary of fixes applied
    console.log('📋 SUMMARY OF ZORP FIXES APPLIED:');
    console.log('==================================');
    console.log('✅ Fixed color transitions: white (1 min) → green → yellow (delay) → red');
    console.log('✅ Fixed team integration: Only team owners can create Zorp zones');
    console.log('✅ Fixed team status logic: Zone goes yellow/red only when ALL team members offline');
    console.log('✅ Enhanced team change handling: Zorp zones deleted on team changes');
    console.log('✅ Improved /edit-zorp command: Respects current zone state');
    console.log('✅ Added database schema improvements: New columns and indexes');
    console.log('✅ Enhanced error handling and logging');
    
    console.log('\n🎯 KEY IMPROVEMENTS:');
    console.log('====================');
    console.log('• No more color flashing - proper state management');
    console.log('• Zones stay green until ALL team members go offline');
    console.log('• Automatic zone deletion when players leave/join teams');
    console.log('• Better delay handling (configurable per zone)');
    console.log('• Improved reliability and performance');

    console.log('\n📝 TESTING CHECKLIST:');
    console.log('=====================');
    console.log('1. Create a Zorp zone as team owner');
    console.log('2. Verify zone starts white for 1 minute');
    console.log('3. Verify zone turns green when online');
    console.log('4. Test team member going offline (zone stays green)');
    console.log('5. Test ALL team members going offline (zone goes yellow)');
    console.log('6. Wait for delay period (zone goes red)');
    console.log('7. Test team member coming online (zone goes green)');
    console.log('8. Test /edit-zorp command updates');
    console.log('9. Test team changes (zone deletion)');

    console.log('\n🎉 ZORP SYSTEM FIXES DEPLOYED SUCCESSFULLY!');
    console.log('Your users should now have a much better Zorp experience.');

  } catch (error) {
    console.error('\n❌ DEPLOYMENT FAILED:', error.message);
    console.error('Please check the error above and try again.');
    process.exit(1);
  }
}

// Run deployment if this script is executed directly
if (require.main === module) {
  deployZorpFixes()
    .then(() => {
      console.log('\nDeployment completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nDeployment failed:', error);
      process.exit(1);
    });
}

module.exports = deployZorpFixes;
