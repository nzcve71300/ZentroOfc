const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('@discordjs/builders');
const pool = require('../../db');
const { orangeEmbed } = require('../../embeds/format');

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
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
    const ign = interaction.options.getString('in-game-name');
    
    try {
      // Check if already linked
      const existingResult = await pool.query(
        'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND discord_id = $2',
        [guildId, discordId]
      );
      
      if (existingResult.rows.length > 0) {
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
      
      await interaction.editReply({
        embeds: [orangeEmbed('Confirm Link', `Are you sure you want to link your Discord account to **${ign}**?`, [
          { name: 'Discord User', value: interaction.user.tag, inline: true },
          { name: 'In-Game Name', value: ign, inline: true }
        ])],
        components: [row]
      });
      
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [orangeEmbed('Error', 'Failed to process link request.')]
      });
    }
  }
}; 