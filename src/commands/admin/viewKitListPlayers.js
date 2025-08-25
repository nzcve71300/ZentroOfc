const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-kit-list-players')
    .setDescription('View all players in a specific kit authorization list')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('kitlist')
        .setDescription('Select which kit list to view')
        .setRequired(true)
        .addChoices(
          { name: 'VIP Kits', value: 'VIPkit' },
          { name: 'Elite List 1', value: 'Elite1' },
          { name: 'Elite List 2', value: 'Elite2' },
          { name: 'Elite List 3', value: 'Elite3' },
          { name: 'Elite List 4', value: 'Elite4' },
          { name: 'Elite List 5', value: 'Elite5' },
          { name: 'Elite List 6', value: 'Elite6' },
          { name: 'Elite List 7', value: 'Elite7' },
          { name: 'Elite List 8', value: 'Elite8' },
          { name: 'Elite List 9', value: 'Elite9' },
          { name: 'Elite List 10', value: 'Elite10' },
          { name: 'Elite List 11', value: 'Elite11' },
          { name: 'Elite List 12', value: 'Elite12' },
          { name: 'Elite List 13', value: 'Elite13' },
          { name: 'Elite List 14', value: 'Elite14' },
          { name: 'Elite List 15', value: 'Elite15' },
          { name: 'Elite List 16', value: 'Elite16' },
          { name: 'Elite List 17', value: 'Elite17' },
          { name: 'Elite List 18', value: 'Elite18' },
          { name: 'Elite List 19', value: 'Elite19' },
          { name: 'Elite List 20', value: 'Elite20' },
          { name: 'Elite List 21', value: 'Elite21' }
        )),

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

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverOption = interaction.options.getString('server');
    const kitlist = interaction.options.getString('kitlist');
    const guildId = interaction.guildId;

    try {
      // Get server info
      const [serverResult] = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
        [guildId, serverOption]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult[0].id;
      const serverName = serverResult[0].nickname;

      // Get all players in this kit list
      const [playersResult] = await pool.query(
        `SELECT p.ign, p.discord_id, ka.kitlist
         FROM kit_auth ka
         JOIN players p ON ka.discord_id = p.discord_id
         WHERE ka.server_id = ? AND ka.kitlist = ?
         ORDER BY p.ign`,
        [serverId, kitlist]
      );

      const kitType = kitlist === 'VIPkit' ? 'VIP kits' : `${kitlist} elite kits`;

      if (playersResult.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'Kit List Players',
            `**Server:** ${serverName}\n**Kit List:** ${kitType}\n\nNo players are currently authorized for ${kitType}.`
          )]
        });
      }

      const embed = orangeEmbed(
        'Kit List Players',
        `**Server:** ${serverName}\n**Kit List:** ${kitType}\n**Total Players:** ${playersResult.length}`
      );

      // Group players by pages if there are many
      const playersPerField = 5;
      for (let i = 0; i < playersResult.length; i += playersPerField) {
        const pagePlayers = playersResult.slice(i, i + playersPerField);
        const playerList = pagePlayers.map(player => 
          `👤 **${player.ign}**\n   Discord ID: ${player.discord_id || 'Not linked'}`
        ).join('\n\n');

        embed.addFields({
          name: `Players ${i + 1}-${Math.min(i + playersPerField, playersResult.length)}`,
          value: playerList,
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error viewing kit list players:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to view kit list players. Please try again.')]
      });
    }
  },
}; 