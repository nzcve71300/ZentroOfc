const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

console.log('Commands path:', commandsPath);

// Check if commands directory exists
if (!fs.existsSync(commandsPath)) {
  console.error('Commands directory not found:', commandsPath);
  process.exit(1);
}

const commandFolders = fs.readdirSync(commandsPath);
console.log('Found command folders:', commandFolders);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;
  
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  console.log(`Loading commands from ${folder}:`, commandFiles);
  
  for (const file of commandFiles) {
    try {
      const filePath = path.join(folderPath, file);
      console.log(`Attempting to load: ${filePath}`);
      
      const command = require(filePath);
      
      if (command.data) {
        commands.push(command.data.toJSON());
        console.log(`✅ Loaded command: ${command.data.name}`);
      } else {
        console.warn(`⚠️ Command file ${file} missing data property`);
      }
    } catch (error) {
      console.error(`❌ Error loading command ${file}:`, error.message);
    }
  }
}

console.log(`\n📊 Total commands loaded: ${commands.length}`);
console.log('Commands to deploy:', commands.map(cmd => cmd.name));

// Check environment variables
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN not found in environment variables');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error('❌ CLIENT_ID not found in environment variables');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`\n🚀 Started refreshing ${commands.length} application (/) commands globally.`);

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('✅ Successfully reloaded application (/) commands globally.');
    console.log('📋 Commands deployed:', commands.map(cmd => cmd.name));
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    if (error.code === 50001) {
      console.error('❌ Missing Access: The bot does not have the "applications.commands" scope');
    } else if (error.code === 50013) {
      console.error('❌ Missing Permissions: The bot does not have permission to create commands');
    }
  }
})(); 