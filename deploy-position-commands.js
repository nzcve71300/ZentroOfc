const { REST, Routes } = require('discord.js');
require('dotenv').config();

// Import the position commands directly
const setPositions = require('./src/commands/admin/setPositions');
const managePositions = require('./src/commands/admin/managePositions');

const commands = [
  setPositions.data.toJSON(),
  managePositions.data.toJSON()
];

console.log('Commands to deploy:', commands.map(cmd => cmd.name));

// Check environment variables
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN not found in environment variables');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error('CLIENT_ID not found in environment variables');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands globally.`);

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands globally.');
    console.log('Commands deployed:', commands.map(cmd => cmd.name));
  } catch (error) {
    console.error('Error deploying commands:', error);
    if (error.code === 50001) {
      console.error('Missing Access: The bot does not have the "applications.commands" scope');
    } else if (error.code === 50013) {
      console.error('Missing Permissions: The bot does not have permission to create commands');
    }
  }
})(); 