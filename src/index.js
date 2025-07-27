require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { discordToken } = require('./config');
const { startRconListeners } = require('./rcon');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Set global Discord client reference for RCON
global.discordClient = client;

// Load commands from src/commands and subdirectories
function loadCommands(dir) {
  const commandFiles = fs.readdirSync(dir).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const command = require(path.join(dir, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
    }
  }
  
  // Load subdirectories
  const subdirs = fs.readdirSync(dir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
    
  for (const subdir of subdirs) {
    loadCommands(path.join(dir, subdir));
  }
}

loadCommands(path.join(__dirname, 'commands'));

client.once('ready', () => {
  console.log(`Zentro Bot is online as ${client.user.tag}`);
  console.log('🚀 Bot startup complete - Latest code version loaded');
  
  // Start RCON listeners after bot is ready
  startRconListeners(client);
});

client.on('interactionCreate', async interaction => {
  // Handle autocomplete
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error('Autocomplete error:', error);
      try {
        await interaction.respond([]);
      } catch (respondError) {
        console.error('Failed to respond to autocomplete:', respondError);
      }
    }
    return;
  }

  // Handle shop dropdowns and other interactions
  if (interaction.isStringSelectMenu() || interaction.isButton()) {
    try {
      const interactionHandler = require('./events/interactionCreate');
      await interactionHandler.execute(interaction);
    } catch (error) {
      console.error('Error handling interaction:', error);
      // Don't try to reply here - let the interaction handler manage its own responses
    }
    return;
  }
  
  // Handle chat commands
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Command execution error:', error);
    // Don't try to reply here - let commands manage their own responses
  }
});

client.login(discordToken);
