const { errorEmbed } = require('../embeds/format');
const authConfig = require('../config/authorization');

/**
 * Check if a user has the "Zentro Admin" role
 */
function hasZentroAdminRole(member) {
  return member.roles.cache.some(role => role.name === 'Zentro Admin');
}

/**
 * Check if a user has admin permissions
 */
function hasAdminPermissions(member) {
  return member.permissions.has('ADMINISTRATOR') || hasZentroAdminRole(member);
}

/**
 * Ensure "Zentro Admin" role exists
 */
async function ensureZentroAdminRole(guild) {
  let role = guild.roles.cache.find(r => r.name === 'Zentro Admin');
  if (!role) {
    try {
      role = await guild.roles.create({
        name: 'Zentro Admin',
        color: 0xFF6B35,
        reason: 'Zentro Bot admin role'
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
 * Check if guild is authorized
 */
async function isAuthorizedGuild(guild) {
  if (authConfig.allowAllGuilds) return true;
  if (authConfig.authorizedGuildIds.includes(guild.id)) return true;

  const envGuildIds = process.env.AUTHORIZED_GUILD_IDS?.split(',') || [];
  if (envGuildIds.includes(guild.id)) return true;

  if (authConfig.useDatabase) {
    try {
      const pool = require('../db');
      const result = await pool.query(
        'SELECT id FROM authorized_guilds WHERE discord_id = $1',
        [guild.id]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking database authorization:', error);
      return false;
    }
  }
  return false;
}

/**
 * Send access denied message
 */
async function sendAccessDeniedMessage(interaction, ephemeral = true) {
  const embed = errorEmbed(
    'Access Denied',
    'You need the **Zentro Admin** role or **Administrator** permission to use this command.'
  );
  if (interaction.deferred) {
    await interaction.editReply({ embeds: [embed] });
  } else if (interaction.replied) {
    await interaction.followUp({ embeds: [embed], flags: ephemeral ? 64 : 0 });
  } else {
    await interaction.reply({ embeds: [embed], flags: ephemeral ? 64 : 0 });
  }
}

/**
 * Send unauthorized guild message
 */
async function sendUnauthorizedGuildMessage(interaction) {
  const embed = errorEmbed(
    'Unauthorized Server',
    'This server is not authorized to use Zentro Bot. Please contact the bot owner for access.'
  );
  if (interaction.deferred) {
    await interaction.editReply({ embeds: [embed] });
  } else if (interaction.replied) {
    await interaction.followUp({ embeds: [embed], flags: 64 });
  } else {
    await interaction.reply({ embeds: [embed], flags: 64 });
  }
}

/**
 * Get linked player by guildId, serverId, and discordId
 */
async function getLinkedPlayer(guildId, serverId, discordId) {
  const pool = require('../db');
  const result = await pool.query(
    'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND server_id = $2 AND discord_id = $3 LIMIT 1',
    [guildId, serverId, discordId]
  );
  return result.rows[0] || null;
}

/**
 * Get player by IGN
 */
async function getPlayerByIGN(guildId, serverId, ign) {
  const pool = require('../db');
  const result = await pool.query(
    'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND server_id = $2 AND ign IS NOT NULL AND LOWER(ign) = LOWER($3) AND is_active = true LIMIT 1',
    [guildId, serverId, ign]
  );
  return result.rows[0] || null;
}

module.exports = {
  hasZentroAdminRole,
  hasAdminPermissions,
  ensureZentroAdminRole,
  isAuthorizedGuild,
  sendAccessDeniedMessage,
  sendUnauthorizedGuildMessage,
  getLinkedPlayer,
  getPlayerByIGN
};
