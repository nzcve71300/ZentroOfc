const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying enhanced /status command...\n');

// Check if the status command file exists
const statusCommandPath = path.join(__dirname, 'src/commands/admin/status.js');
if (!fs.existsSync(statusCommandPath)) {
  console.log('❌ Status command file not found:', statusCommandPath);
  console.log('💡 Make sure the status.js file exists in src/commands/admin/');
  process.exit(1);
}

console.log('✅ Status command file found');

// Check if template exists
const templatePath = path.join(__dirname, 'src/assets/status_template.png');
if (!fs.existsSync(templatePath)) {
  console.log('⚠️ Template file not found:', templatePath);
  console.log('💡 The command will work but may not display the template background');
} else {
  console.log('✅ Template file found');
}

// Check package.json for required dependencies
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const requiredDeps = ['canvas', 'chart.js', 'chartjs-node-canvas'];
  const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
  
  if (missingDeps.length > 0) {
    console.log('⚠️ Missing dependencies:', missingDeps.join(', '));
    console.log('💡 Install with: npm install canvas chart.js chartjs-node-canvas');
  } else {
    console.log('✅ All required dependencies found in package.json');
  }
}

console.log('\n📋 Enhanced /status command features:');
console.log('   🖼️ Visual dashboard with template background');
console.log('   📊 Real-time FPS, Players, Entities, Memory, Uptime');
console.log('   📈 Chart.js performance graph (green/red based on trends)');
console.log('   🎨 Orange highlights for values');
console.log('   🔒 Hidden IP addresses for security');
console.log('   📱 Discord-friendly image format (<2MB)');

console.log('\n🚀 Deployment steps for SSH:');
console.log('1. Upload status.js to server:');
console.log('   scp src/commands/admin/status.js username@server:/path/to/zentro-bot/src/commands/admin/');
console.log('');
console.log('2. Upload template (if available):');
console.log('   scp src/assets/status_template.png username@server:/path/to/zentro-bot/src/assets/');
console.log('');
console.log('3. SSH into server and install dependencies:');
console.log('   ssh username@server');
console.log('   cd /path/to/zentro-bot');
console.log('   npm install canvas chart.js chartjs-node-canvas');
console.log('');
console.log('4. Deploy command to Discord:');
console.log('   node deploy-commands.js');
console.log('');
console.log('5. Restart bot:');
console.log('   pm2 restart zentro-bot');
console.log('');
console.log('6. Test the command:');
console.log('   /status server:YourServerName');

console.log('\n✅ Status command deployment guide ready!'); 