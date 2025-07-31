const fs = require('fs');
const path = require('path');

console.log('Testing command loading...');

const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFolders = fs.readdirSync(commandsPath);

console.log('Found command folders:', commandFolders);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;
  
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  console.log(`\nCommands in ${folder}:`);
  
  for (const file of commandFiles) {
    try {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);
      
      if (command.data) {
        console.log(`  ✅ ${file} -> ${command.data.name}`);
      } else {
        console.log(`  ❌ ${file} -> missing data property`);
      }
    } catch (error) {
      console.log(`  ❌ ${file} -> Error: ${error.message}`);
    }
  }
} 