const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const { 
  getPlayerByDiscordId, 
  getPlayerClan,
  getEmojiByClanColor
} = require('../../utils/clanSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan-leave')
    .setDescription('Leave your current clan')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server your clan is on')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [servers] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ?',
        [guildId, `%${focusedValue}%`]
      );

      await interaction.respond(
        servers.map(server => ({ name: server.nickname, value: server.nickname }))
      );
    } catch (error) {
      console.error('Clan leave autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');

    try {
      // Get server
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      // Check if clan system is enabled
      const [settings] = await pool.query(
        'SELECT enabled FROM clan_settings WHERE server_id = ?',
        [server.id]
      );
      
      if (!settings.length || !settings[0].enabled) {
        return interaction.editReply({
          embeds: [errorEmbed('Clan System Disabled', 'The clan system is not enabled on this server.')]
        });
      }

      // Get player
      const player = await getPlayerByDiscordId(userId, server.id);
      if (!player) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not Found', 'You need to be linked to use clan commands.')]
        });
      }

      // Get player's clan
      const clan = await getPlayerClan(player.id, server.id);
      if (!clan) {
        return interaction.editReply({
          embeds: [errorEmbed('Not in Clan', 'You are not a member of any clan on this server.')]
        });
      }

      // Check if player is the clan owner
      if (clan.owner_id === player.id) {
        return interaction.editReply({
          embeds: [errorEmbed('Cannot Leave as Owner', `You cannot leave **${clan.name}** as the clan owner. You must either transfer ownership or delete the clan.`)]
        });
      }

      // Leave clan
      await pool.query(
        'DELETE FROM clan_members WHERE clan_id = ? AND player_id = ?',
        [clan.id, player.id]
      );

      // Remove co-owner status if they were co-owner
      if (clan.co_owner_id === player.id) {
        await pool.query(
          'UPDATE clans SET co_owner_id = NULL WHERE id = ?',
          [clan.id]
        );
      }

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) left clan "${clan.name}" on ${server.nickname}`);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('👋 **LEFT CLAN SUCCESSFULLY** 👋')
        .setDescription(`You have left **${clan.name}** on **${server.nickname}**!`)
        .addFields(
          { name: '🏷️ **Clan Tag**', value: `**[${clan.tag}]**`, inline: true },
          { name: '🎨 **Color**', value: `${getEmojiByClanColor(clan.color)} ${clan.color}`, inline: true },
          { name: '👤 **Left By**', value: `${interaction.user.tag}`, inline: true },
          { name: '🎮 **Game Name**', value: `**${player.name}**`, inline: true },
          { name: '📅 **Left**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: '🏰 Zentro Clan System • You are now clanless' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Clan leave error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan Leave Failed', `Failed to leave clan. Error: ${err.message}`)]
      });
    }
  }
}; 