(async () => {
  try {
    console.log("Running database migrations...");
    await require('../mysql_migrate');
    console.log("Migrations completed successfully.");
  } catch (err) {
    console.error("⚠️ Migration failed. Bot will still start. Error:", err.message);
  }
})();

require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { discordToken } = require('./config');
const { startRconListeners } = require('./rcon');
const { ensureZentroAdminRole, isAuthorizedGuild, sendUnauthorizedGuildMessage } = require('./utils/permissions');
const { initializeGuildSubscription } = require('./utils/subscriptionSystem');
const pool = require('./db');
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

client.once('ready', async () => {
  console.log(`Zentro Bot is online as ${client.user.tag}`);
  console.log('🚀 Bot startup complete - Latest code version loaded');
  
  // Initialize database tables
  try {
    const { initializeDatabase } = require('./db');
    await initializeDatabase();
    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  }
  
  // Initialize subscriptions for all connected guilds
  try {
    console.log('📋 Initializing subscriptions for all connected guilds...');
    for (const [id, guild] of client.guilds.cache) {
      await initializeGuildSubscription(id);
    }
    console.log(`✅ Initialized subscriptions for ${client.guilds.cache.size} guild(s)`);
  } catch (error) {
    console.error('❌ Failed to initialize subscriptions:', error);
  }
  
  // Create Zentro Admin role in all guilds the bot is in
  client.guilds.cache.forEach(async (guild) => {
    try {
      await ensureZentroAdminRole(guild);
    } catch (error) {
      console.error(`Failed to ensure Zentro Admin role in guild ${guild.name}:`, error);
    }
  });
  
  // Start RCON listeners after bot is ready
  startRconListeners(client);
  
  // Restore zones after a short delay to ensure RCON connections are established
  setTimeout(async () => {
    try {
      const { restoreZonesOnStartup } = require('./rcon');
      await restoreZonesOnStartup(client);
    } catch (error) {
      console.error('Error during zone restoration:', error);
    }
  }, 10000); // 10 second delay
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

  // Subscription enforcement - block all commands if subscription is not active
  const { isSubscriptionActive } = require('./utils/subscriptionSystem');
  const subscriptionActive = await isSubscriptionActive(interaction.guildId);
  
  if (!subscriptionActive) {
    return interaction.reply({
      embeds: [{
        color: 0xFF6B35,
        title: '❌ Subscription Required',
        description: 'This bot is inactive for your server. Please contact support to activate your subscription.',
        footer: {
          text: 'Zentro Bot'
        }
      }],
      ephemeral: true
    });
  }
  
  // Check if guild is authorized (except for player commands)
  if (command.data.name.startsWith('add-') || command.data.name.startsWith('remove-') || 
      command.data.name.startsWith('edit-') || command.data.name.startsWith('setup-') ||
      command.data.name.startsWith('manage-') || command.data.name.startsWith('set-') ||
      command.data.name.startsWith('channel-') || command.data.name.startsWith('eco-') ||
      command.data.name.startsWith('autokits-') || command.data.name.startsWith('killfeed') ||
      command.data.name.startsWith('view-') || command.data.name.startsWith('list-') ||
      command.data.name.startsWith('open-') || command.data.name.startsWith('allow-') ||
      command.data.name.startsWith('unlink') || command.data.name === 'force-link') {
    
    const isAuthorized = await isAuthorizedGuild(interaction.guild);
    if (!isAuthorized) {
      return sendUnauthorizedGuildMessage(interaction);
    }
  }
  
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Command execution error:', error);
    // Don't try to reply here - let commands manage their own responses
  }
});

// Handle bot joining new guilds
client.on('guildCreate', async (guild) => {
  console.log(`Bot joined new guild: ${guild.name} (ID: ${guild.id})`);
  
  // Check if this guild is authorized
  const isAuthorized = await isAuthorizedGuild(guild);
  
  if (!isAuthorized) {
    console.log(`🚫 Unauthorized guild attempted to add bot: ${guild.name} (ID: ${guild.id})`);
    console.log(`🚪 Leaving unauthorized guild: ${guild.name}`);
    
    try {
      await guild.leave();
      console.log(`✅ Successfully left unauthorized guild: ${guild.name}`);
    } catch (error) {
      console.error(`❌ Failed to leave unauthorized guild ${guild.name}:`, error);
    }
    return;
  }
  
  try {
    await ensureZentroAdminRole(guild);
    await initializeGuildSubscription(guild.id);
    console.log(`Successfully set up Zentro Admin role and initialized subscription in authorized guild: ${guild.name}`);
  } catch (error) {
    console.error(`Failed to create Zentro Admin role or initialize subscription in guild ${guild.name}:`, error);
  }
});

client.login(discordToken);
