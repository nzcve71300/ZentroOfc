const { migrateGuildData } = require('./migrate_guild_data');

console.log('🚀 Zentro Bot Guild Migration Tool');
console.log('=====================================');
console.log('');
console.log('This will migrate all bot data from:');
console.log('  Old Discord Server: 1376431874699825216');
console.log('  New Discord Server: 1413335350742614067');
console.log('');
console.log('⚠️  IMPORTANT: Make sure the bot is added to the new Discord server before running this migration!');
console.log('');

// Ask for confirmation
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Do you want to proceed with the migration? (yes/no): ', async (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    console.log('\n🔄 Starting migration...');
    try {
      await migrateGuildData();
      console.log('\n✅ Migration completed successfully!');
      console.log('📝 Next steps:');
      console.log('   1. Add the bot to the new Discord server (if not already done)');
      console.log('   2. Test the bot commands in the new server');
      console.log('   3. Verify that all player data and economy are working');
      console.log('   4. Update any hardcoded server IDs in your configuration');
    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      console.log('\n🔄 You can try running the rollback script if needed');
    }
  } else {
    console.log('\n❌ Migration cancelled by user');
  }
  
  rl.close();
});
