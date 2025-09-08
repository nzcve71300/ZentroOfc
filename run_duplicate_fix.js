#!/usr/bin/env node

/**
 * Simple script to run the comprehensive duplicate player fix
 * Usage: node run_duplicate_fix.js
 */

const { fixDuplicatePlayersComprehensive } = require('./fix_duplicate_players_comprehensive');

console.log('🚀 Starting Duplicate Player Fix...');
console.log('This will clean up existing duplicates and prevent future ones.\n');

fixDuplicatePlayersComprehensive()
  .then(() => {
    console.log('\n🎉 Duplicate fix completed successfully!');
    console.log('✅ Your system is now protected against duplicate player records.');
    console.log('✅ You can now use /admin-link to fix any remaining issues.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Duplicate fix failed:', error);
    console.error('Please check the error above and try again.');
    process.exit(1);
  });
