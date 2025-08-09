const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wipe-kit-claims')
    .setDescription('Wipe cooldown timers for kit claims')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('kitlist')
        .setDescription('Select which kit list to wipe claims for')
        .setRequired(true)
        .addChoices(
          { name: 'All Kits', value: 'all' },
          { name: 'Free Kit 1', value: 'FREEkit1' },
          { name: 'Free Kit 2', value: 'FREEkit2' },
          { name: 'VIP Kits', value: 'VIPkit' },
          { name: 'Elite List 1', value: 'Elite1' },
          { name: 'Elite List 2', value: 'Elite2' },
          { name: 'Elite List 3', value: 'Elite3' },
          { name: 'Elite List 4', value: 'Elite4' },
          { name: 'Elite List 5', value: 'Elite5' },
          { name: 'Elite List 6', value: 'Elite6' }
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

      let deletedCount = 0;
      let kitNames = [];

      if (kitlist === 'all') {
        // Delete all cooldown entries for this server
        const [deleteResult] = await pool.query(
          'DELETE FROM kit_cooldowns WHERE server_id = ?',
          [serverId]
        );
        deletedCount = deleteResult.affectedRows;
        kitNames = ['All kits'];
      } else {
        // Delete cooldown entries for specific kit
        let kitName;
        if (kitlist === 'VIPkit') {
          kitName = 'VIPkit';
        } else if (kitlist.startsWith('FREEkit')) {
          kitName = kitlist; // FREEkit1, FREEkit2
        } else if (kitlist.startsWith('Elite')) {
          kitName = `ELITEkit${kitlist.replace('Elite', '')}`;
        } else {
          kitName = kitlist;
        }
        
        const [deleteResult] = await pool.query(
          'DELETE FROM kit_cooldowns WHERE server_id = ? AND kit_name = ?',
          [serverId, kitName]
        );
        deletedCount = deleteResult.affectedRows;
        
        if (kitlist === 'VIPkit') {
          kitNames = ['VIP kits'];
        } else if (kitlist.startsWith('FREEkit')) {
          kitNames = [`${kitlist} free kits`];
        } else if (kitlist.startsWith('Elite')) {
          kitNames = [`${kitlist} elite kits`];
        } else {
          kitNames = [kitlist];
        }
      }

      const embed = successEmbed(
        'Kit Claims Wiped',
        `**Server:** ${serverName}\n**Kit List:** ${kitNames.join(', ')}\n**Claims Cleared:** ${deletedCount}\n\nAll cooldown timers have been reset for the selected kit(s).`
      );

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error wiping kit claims:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to wipe kit claims. Please try again.')]
      });
    }
  },
}; 