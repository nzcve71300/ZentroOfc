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
  
  // Start RCON listeners after bot is ready
  startRconListeners(client);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
      await interaction.respond([]);
    }
    return;
  }
  
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'There was an error executing this command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
    }
  }
});

client.login(discordToken);
