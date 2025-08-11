const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../../db');
const { ensureZentroAdminRole, isAuthorizedGuild, sendUnauthorizedGuildMessage } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nivaro-link')
    .setDescription('Link your Discord server to your Nivaro store (Admin Only)')
    .addStringOption(option =>
      option.setName('secret_key')
        .setDescription('The secret key from your Nivaro store dashboard')
        .setRequired(true)
        .setMaxLength(64))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.editReply('❌ **Insufficient Permissions** - You need **Administrator** permissions to use this command.');
    }

    // Check if guild is authorized (if using strict authorization)
    if (!isAuthorizedGuild(interaction.guildId)) {
      return await sendUnauthorizedGuildMessage(interaction);
    }

    const secretKey = interaction.options.getString('secret_key');
    const guildId = interaction.guildId;
    const guildName = interaction.guild.name;
    const userId = interaction.user.id;

    try {
      // First, validate the secret key exists and isn't expired
      const [pendingStores] = await pool.query(
        'SELECT * FROM pending_stores WHERE secret_key = ? AND is_used = FALSE AND expires_at > NOW()',
        [secretKey]
      );

      if (pendingStores.length === 0) {
        return await interaction.editReply('❌ **Invalid Secret Key** - The secret key you provided is invalid, expired, or has already been used.');
      }

      // Check if this guild is already linked to a store
      const [existingLinks] = await pool.query(
        'SELECT dl.*, s.store_name FROM discord_links dl JOIN stores s ON dl.store_id = s.id WHERE dl.discord_guild_id = ? AND dl.is_active = TRUE',
        [guildId]
      );

      if (existingLinks.length > 0) {
        return await interaction.editReply(`❌ **Already Linked** - This Discord server is already linked to **${existingLinks[0].store_name}**`);
      }

      // Call the API to connect the Discord server
                      const apiUrl = process.env.API_BASE_URL || 'https://5c42f0c4058e.ngrok-free.app';
      const response = await fetch(`${apiUrl}/api/discord/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secretKey: secretKey,
          discordServerId: guildId,
          discordServerName: guildName,
          userId: userId
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Success - return the message from the API
        return await interaction.editReply(`✅ **${result.message}**`);
      } else {
        // API returned an error
        const errorMessage = result.error || 'Unknown error occurred';
        return await interaction.editReply(`❌ **Error** - ${errorMessage}`);
      }

    } catch (error) {
      console.error('Error in nivaro-link command:', error);
      
      // Check if it's a network error (API not reachable)
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return await interaction.editReply('❌ **API Connection Error** - Unable to connect to the Nivaro API server. Please try again later.');
      }
      
      return await interaction.editReply('❌ **Error** - An error occurred while linking your store. Please try again later.');
    }
  },
}; 