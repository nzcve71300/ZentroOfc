const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getLinkedPlayer, getPlayerByIGN } = require('../../utils/permissions');

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
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
    const ign = interaction.options.getString('in-game-name');

    try {
      // Get server for this guild
      const serverResult = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) LIMIT 1',
        [guildId]
      );
      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed('No Server Found', 'No Rust server found for this Discord. Contact an admin.')]
        });
      }
      const serverId = serverResult.rows[0].id;
      const serverName = serverResult.rows[0].nickname;

      // Check if Discord ID is already linked
      const existingPlayer = await getLinkedPlayer(guildId, serverId, discordId);
      if (existingPlayer && existingPlayer.ign.toLowerCase() !== ign.toLowerCase()) {
        return interaction.editReply({
          embeds: [orangeEmbed('Already Linked', `Your Discord account is already linked to **${existingPlayer.ign}** on **${serverName}**.`)]
        });
      }

      // Check if IGN is linked to a different Discord ID
      const ignPlayer = await getPlayerByIGN(guildId, serverId, ign);
      if (ignPlayer && ignPlayer.discord_id && ignPlayer.discord_id !== discordId) {
        return interaction.editReply({
          embeds: [orangeEmbed('IGN Already Linked', `The in-game name **${ign}** is already linked to another Discord account on **${serverName}**.`)]
        });
      }

      // If player doesn't exist, create a new row
      let playerId = ignPlayer ? ignPlayer.id : null;
      if (!playerId) {
        const insertResult = await pool.query(
          'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) RETURNING id',
          [guildId, serverId, discordId, ign]
        );
        playerId = insertResult.rows[0].id;
      } else {
        // Update existing record with Discord ID
        await pool.query('UPDATE players SET discord_id = $1 WHERE id = $2', [discordId, playerId]);
      }

      // Send confirmation buttons
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

      const confirmEmbed = orangeEmbed(
        'Confirm Link',
        `Are you sure you want to link your Discord account to **${ign}**?\n\n**Discord User:** ${interaction.user.tag}\n**In-Game Name:** ${ign}\n**Server:** ${serverName}`
      );

      await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

    } catch (error) {
      console.error('Error in /link command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to process link request.')]
      });
    }
  }
};
