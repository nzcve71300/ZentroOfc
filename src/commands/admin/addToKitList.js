const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-to-kit-list')
    .setDescription('Add a player to an elite kit list')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Player name (Discord username or in-game name)')
        .setRequired(true)
        .setMaxLength(50))
    .addStringOption(option =>
      option.setName('kitlist')
        .setDescription('Select which elite list to add to')
        .setRequired(true)
        .addChoices(
          { name: 'Elite List 1', value: 'Elite1' },
          { name: 'Elite List 2', value: 'Elite2' },
          { name: 'Elite List 3', value: 'Elite3' },
          { name: 'Elite List 4', value: 'Elite4' },
          { name: 'Elite List 5', value: 'Elite5' }
        )),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.rows.map(row => ({
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
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        embeds: [errorEmbed('Access Denied', 'You need administrator permissions to use this command.')]
      });
    }

    const serverOption = interaction.options.getString('server');
    const playerName = interaction.options.getString('name');
    const kitlist = interaction.options.getString('kitlist');
    const guildId = interaction.guildId;

    try {
      // Get server info
      const serverResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverOption]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult.rows[0].id;
      const serverName = serverResult.rows[0].nickname;

      // Find player by Discord username or in-game name
      const playerResult = await pool.query(
        `SELECT p.id, p.discord_id, p.ign
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE g.discord_id = $1 AND rs.id = $2 AND (p.ign ILIKE $3 OR p.discord_id = $3)
         ORDER BY p.ign`,
        [guildId, serverId, playerName]
      );

      if (playerResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not Found', `No player found with name "${playerName}" on ${serverName}.`)]
        });
      }

      if (playerResult.rows.length > 1) {
        // Multiple players found - show options
        const embed = orangeEmbed(
          'Multiple Players Found',
          `Found ${playerResult.rows.length} players matching "${playerName}". Please be more specific:`
        );

        for (const player of playerResult.rows) {
          embed.addFields({
            name: `👤 ${player.ign || 'Unknown'}`,
            value: `**Discord ID:** ${player.discord_id}`,
            inline: true
          });
        }

        return interaction.editReply({
          embeds: [embed]
        });
      }

      const player = playerResult.rows[0];

      // Check if player is already in this kit list
      const existingResult = await pool.query(
        'SELECT id FROM kit_auth WHERE server_id = $1 AND discord_id = $2 AND kitlist = $3',
        [serverId, player.discord_id, kitlist]
      );

      if (existingResult.rows.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Already in List', `${player.ign || 'Player'} is already in ${kitlist} on ${serverName}.`)]
        });
      }

      // Add player to kit list
      await pool.query(
        'INSERT INTO kit_auth (server_id, discord_id, kitlist) VALUES ($1, $2, $3)',
        [serverId, player.discord_id, kitlist]
      );

      await interaction.editReply({
        embeds: [successEmbed(
          'Player Added to Kit List',
          `**Player:** ${player.ign || 'Unknown'}\n**Server:** ${serverName}\n**Kit List:** ${kitlist}\n\nPlayer has been added to the elite kit list successfully.`
        )]
      });

    } catch (error) {
      console.error('Error adding player to kit list:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to add player to kit list. Please try again.')]
      });
    }
  },
}; 