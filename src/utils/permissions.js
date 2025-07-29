const { errorEmbed } = require('../embeds/format');
const authConfig = require('../config/authorization');
const pool = require('../db');

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
  try {
    // Check if role already exists
    const existingRole = guild.roles.cache.find(role => role.name === 'Zentro Admin');
    if (existingRole) {
      return existingRole;
    }

    // Create the role
    const role = await guild.roles.create({
      name: 'Zentro Admin',
      color: 0xFF8C00, // Orange
      reason: 'Zentro Bot - Admin role for server management'
    });

    console.log(`✅ Created Zentro Admin role in guild: ${guild.name}`);
    return role;
  } catch (error) {
    console.error(`❌ Failed to create Zentro Admin role in guild ${guild.name}:`, error);
    return null;
  }
}

/**
 * Check if guild is authorized
 */
async function isAuthorizedGuild(guild) {
  if (authConfig.allowAllGuilds) return TRUE;
  if (authConfig.authorizedGuildIds.includes(guild.id)) return TRUE;

  const envGuildIds = process.env.AUTHORIZED_GUILD_IDS?.split(',') || [];
  if (envGuildIds.includes(guild.id)) return TRUE;

  if (authConfig.useDatabase) {
    try {
      const [result] = await pool.query(
        'SELECT id FROM authorized_guilds WHERE discord_id = ?',
        [guild.id]
      );
      return result.length > 0;
    } catch (error) {
      console.error('Error checking database authorization:', error);
      return FALSE;
    }
  }
  return FALSE;
}

/**
 * Send access denied message
 */
async function sendAccessDeniedMessage(interaction, ephemeral = TRUE) {
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
  const embed = {
    color: 0xFF8C00, // Orange
    title: '🚫 Unauthorized Guild',
    description: 'This Discord server is not authorized to use Zentro Bot.',
    fields: [
      {
        name: 'Contact Support',
        value: 'Please contact the bot administrator to get access.',
        inline: FALSE
      }
    ],
    timestamp: new Date()
  };

  await interaction.reply({ embeds: [embed], ephemeral: TRUE });
}

/**
 * Get linked player by guildId, serverId, and discordId
 */
async function getLinkedPlayer(guildId, serverId, discordId) {
  try {
    const [result] = await pool.query(
      'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND discord_id = ? LIMIT 1',
      [guildId, serverId, discordId]
    );
    return result[0] || null;
  } catch (error) {
    console.error('Error getting linked player:', error);
    return null;
  }
}

/**
 * Get player by IGN
 */
async function getPlayerByIGN(guildId, serverId, ign) {
  try {
    const [result] = await pool.query(
      'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND ign IS NOT NULL AND LOWER(ign) = LOWER(?) AND is_active = TRUE LIMIT 1',
      [guildId, serverId, ign]
    );
    return result[0] || null;
  } catch (error) {
    console.error('Error getting player by IGN:', error);
    return null;
  }
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
