const fs = require('fs');
const path = require('path');

async function checkBotRuntimeIssue() {
  console.log('🔧 CHECK BOT RUNTIME ISSUE');
  console.log('===========================\n');

  console.log('📋 CHECKING BOT FILES AND RUNTIME...');

  // Check if link command file exists and is correct
  const linkCommandPath = path.join(__dirname, 'src', 'commands', 'player', 'link.js');
  
  if (fs.existsSync(linkCommandPath)) {
    console.log('✅ Link command file exists');
    
    const linkContent = fs.readFileSync(linkCommandPath, 'utf8');
    
    // Check for the exact query
    if (linkContent.includes('SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)')) {
      console.log('✅ Link command has correct query');
    } else {
      console.log('❌ Link command query is different or missing');
    }
    
    // Check for the "No Server Found" message
    if (linkContent.includes('No Rust server found for this Discord')) {
      console.log('✅ Link command has correct error message');
    } else {
      console.log('❌ Link command error message is different');
    }
    
  } else {
    console.log('❌ Link command file missing!');
  }

  // Check database connection file
  const dbPath = path.join(__dirname, 'src', 'db', 'index.js');
  
  if (fs.existsSync(dbPath)) {
    console.log('✅ Database connection file exists');
  } else {
    console.log('❌ Database connection file missing!');
  }

  console.log('\n📋 POTENTIAL ISSUES:');
  console.log('1. Bot needs restart (PM2 restart zentro-bot)');
  console.log('2. Bot is using cached/old code');
  console.log('3. Environment variables different in bot vs scripts');
  console.log('4. Bot is connecting to different database');
  console.log('5. Discord command not properly registered');

  console.log('\n🚀 IMMEDIATE ACTIONS TO TRY:');
  console.log('1. RESTART BOT: pm2 restart zentro-bot');
  console.log('2. CHECK LOGS: pm2 logs zentro-bot');
  console.log('3. RELOAD COMMANDS: Try using the bot in Discord and check logs');
  console.log('4. VERIFY ENVIRONMENT: Check if .env is correct');

  console.log('\n📝 DEBUGGING STEPS:');
  console.log('1. After restarting bot, try /link in Snowy Billiards 2x');
  console.log('2. Watch pm2 logs to see what query actually runs');
  console.log('3. Look for any error messages in logs');
  console.log('4. Check if bot is connected to correct database');

  console.log('\n⚠️ THEORY:');
  console.log('The bot might be running old code or connecting to wrong database.');
  console.log('Our simulation works perfectly, so the issue is runtime-specific.');
}

checkBotRuntimeIssue();