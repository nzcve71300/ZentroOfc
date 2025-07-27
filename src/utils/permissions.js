const { errorEmbed } = require('../embeds/format');
const authConfig = require('../config/authorization');

/**
 * Check if a user has the "Zentro Admin" role
 * @param {GuildMember} member - The guild member to check
 * @returns {boolean} - True if user has the role, false otherwise
 */
function hasZentroAdminRole(member) {
  return member.roles.cache.some(role => role.name === 'Zentro Admin');
}

/**
 * Check if a user has admin permissions (either Discord Administrator or Zentro Admin role)
 * @param {GuildMember} member - The guild member to check
 * @returns {boolean} - True if user has admin permissions, false otherwise
 */
function hasAdminPermissions(member) {
  return member.permissions.has('ADMINISTRATOR') || hasZentroAdminRole(member);
}

/**
 * Create the "Zentro Admin" role if it doesn't exist
 * @param {Guild} guild - The guild to create the role in
 * @returns {Promise<Role>} - The created or existing role
 */
async function ensureZentroAdminRole(guild) {
  let role = guild.roles.cache.find(r => r.name === 'Zentro Admin');
  
  if (!role) {
    try {
      role = await guild.roles.create({
        name: 'Zentro Admin',
        color: '#FF6B35', // Orange color
        reason: 'Zentro Bot admin role for managing bot features'
      });
      console.log(`Created Zentro Admin role in guild: ${guild.name}`);
    } catch (error) {
      console.error(`Failed to create Zentro Admin role in guild ${guild.name}:`, error);
      return null;
    }
  }
  
  return role;
}

/**
 * Check if guild was added through authorized invite
 * @param {Guild} guild - The guild to check
 * @returns {Promise<boolean>} - True if authorized, false otherwise
 */
async function isAuthorizedGuild(guild) {
  // Option 1: Allow all guilds (current behavior)
  if (authConfig.allowAllGuilds) {
    return true;
  }
  
  // Option 2: Check against hardcoded guild IDs
  if (authConfig.authorizedGuildIds.includes(guild.id)) {
    return true;
  }
  
  // Option 3: Check environment variable
  const envGuildIds = process.env.AUTHORIZED_GUILD_IDS?.split(',') || [];
  if (envGuildIds.includes(guild.id)) {
    return true;
  }
  
  // Option 4: Check database table
  if (authConfig.useDatabase) {
    try {
      const pool = require('../db');
      const result = await pool.query('SELECT id FROM authorized_guilds WHERE discord_id = $1', [guild.id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking database authorization:', error);
      return false;
    }
  }
  
  return false;
}

/**
 * Send an access denied message for admin commands
 * @param {CommandInteraction} interaction - The interaction to reply to
 * @param {boolean} ephemeral - Whether the message should be ephemeral
 */
async function sendAccessDeniedMessage(interaction, ephemeral = true) {
  const embed = errorEmbed(
    'Access Denied', 
    'You need the "Zentro Admin" role or Administrator permissions to use this command.'
  );
  
  if (ephemeral) {
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Send an unauthorized guild message
 * @param {CommandInteraction} interaction - The interaction to reply to
 */
async function sendUnauthorizedGuildMessage(interaction) {
  const embed = errorEmbed(
    'Unauthorized Server', 
    'This server is not authorized to use Zentro Bot. Please contact the bot owner for access.'
  );
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = {
  hasZentroAdminRole,
  hasAdminPermissions,
  ensureZentroAdminRole,
  isAuthorizedGuild,
  sendAccessDeniedMessage,
  sendUnauthorizedGuildMessage
}; 