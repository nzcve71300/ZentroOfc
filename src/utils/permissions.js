const { errorEmbed } = require('../embeds/format');

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

module.exports = {
  hasZentroAdminRole,
  hasAdminPermissions,
  ensureZentroAdminRole,
  sendAccessDeniedMessage
}; 