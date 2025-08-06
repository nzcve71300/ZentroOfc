const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

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
      // Get all servers for this guild
      const [servers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guildId]
      );

      if (servers.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('No Server Found', 'No Rust server found for this Discord. Contact an admin.')]
        });
      }

      // Check if Discord ID is already linked to a different IGN
      const [existingDiscordLinks] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND p.discord_id = ? 
         AND p.is_active = true
         AND LOWER(p.ign) != LOWER(?)`,
        [guildId, discordId, ign]
      );

      if (existingDiscordLinks.length > 0) {
        const serverList = existingDiscordLinks.map(p => p.nickname).join(', ');
        return await interaction.editReply({
          embeds: [orangeEmbed('Already Linked', `Your Discord is already linked to a different in-game name on: ${serverList}\n\nUse \`/unlink\` first to unlink your account.`)]
        });
      }

      // Check if IGN is already linked to a different Discord ID
      const [existingIgnLinks] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND LOWER(p.ign) = LOWER(?) 
         AND p.discord_id != ? 
         AND p.is_active = true`,
        [guildId, ign, discordId]
      );

      if (existingIgnLinks.length > 0) {
        const serverList = existingIgnLinks.map(p => p.nickname).join(', ');
        return await interaction.editReply({
          embeds: [orangeEmbed('IGN Already Linked', `This in-game name is already linked to another Discord account on: ${serverList}`)]
        });
      }

      // Confirm linking
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`link_confirm_${guildId}_${discordId}_${ign}`)
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('link_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

      const confirmEmbed = orangeEmbed(
        'Confirm Link', 
        `Are you sure you want to link to **${ign}**?\n\nThis will link your account across **${servers.length} server(s)**:\n${servers.map(s => `• ${s.nickname}`).join('\n')}`
      );
      
      await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
    } catch (error) {
      console.error('Error in /link:', error);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to process link request.')] });
    }
  }
};
