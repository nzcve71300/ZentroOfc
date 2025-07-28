const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getLinkedPlayer } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account with your in-game name')
    .addStringOption(opt => 
      opt.setName('in-game-name')
        .setDescription('Your in-game name')
        .setRequired(true)
    ),
  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
    const ign = interaction.options.getString('in-game-name');
    
    try {
      // Find the serverId for this guild (assume only one server per guild for now, or add a server option if needed)
      const pool = require('../../db');
      const serverResult = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) LIMIT 1',
        [guildId]
      );
      if (serverResult.rows.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('No Server Found', 'No Rust server found for this Discord. Contact an admin.')]
        });
      }
      const serverId = serverResult.rows[0].id;
      // Use getLinkedPlayer to check if already linked
      const existingPlayer = await getLinkedPlayer(guildId, serverId, discordId);
      if (existingPlayer) {
        return await interaction.editReply({
          embeds: [orangeEmbed('Already Linked', 'Your Discord account is already linked to an in-game name.')]
        });
      }
      
      // Create confirmation buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`link_confirm_${guildId}_${discordId}_${ign}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('link_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
        );
      
      const confirmEmbed = orangeEmbed('Confirm Link', `Are you sure you want to link your Discord account to **${ign}**?\n\n**Discord User:** ${interaction.user.tag}\n**In-Game Name:** ${ign}`);
      
      await interaction.editReply({
        embeds: [confirmEmbed],
        components: [row]
      });
      
    } catch (error) {
      console.error('Error in /link command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to process link request.')]
      });
    }
  }
}; 