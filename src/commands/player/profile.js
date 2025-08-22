const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your player profile and statistics')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
    const serverName = interaction.options.getString('server');

    try {
      // Get server info
      const [serverResult] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, serverName]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const server = serverResult[0];

      // Get player info
      const [playerResult] = await pool.query(
        `SELECT p.*, rs.nickname as server_name
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
         AND p.discord_id = ?
         AND p.server_id = ?
         AND p.is_active = true`,
        [guildId, discordId, server.id]
      );

      if (playerResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Not Linked', `You are not linked to **${serverName}**.\n\nUse \`/link <in-game-name>\` to link your account first.`)]
        });
      }

      const player = playerResult[0];

      // Format the linked date with relative time
      const linkedDate = new Date(player.linked_at);
      const now = new Date();
      const diffTime = Math.abs(now - linkedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      let relativeTime;
      if (diffDays > 0) {
        relativeTime = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        relativeTime = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else {
        relativeTime = 'Less than an hour ago';
      }

      // Create main profile embed
      const embed = orangeEmbed(
        `${player.ign} Info: (${serverName})`,
        `**Identity:**\n` +
        `Discord Username: ${interaction.user.username}\n` +
        `In-game Username: ${player.ign}\n` +
        `Linked: ${linkedDate.toLocaleString('en-US', { 
          timeZone: 'UTC',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        })} (${relativeTime})`
      );

      // Create Rust Info button
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`rust_info_${guildId}_${discordId}_${server.id}`)
            .setLabel('Rust Info')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Error in profile command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to fetch your profile. Please try again.')]
      });
    }
  }
};
