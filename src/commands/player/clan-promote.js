const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const { 
  getPlayerByDiscordId, 
  getPlayerClan,
  isPlayerClanOwnerOnly,
  isPlayerInClan,
  getEmojiByClanColor
} = require('../../utils/clanSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan-promote')
    .setDescription('Promote a player to co-owner (only clan owner can do this)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server your clan is on')
        .setRequired(true)
        .setAutocomplete(true))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The Discord user to promote')
        .setRequired(true)),

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
      console.error('Clan promote autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');
    const targetUser = interaction.options.getUser('user');

    try {
      // Get server
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      // Use server.id (rust_servers.id) directly for database operations
      const serverId = server.id;

      // Check if clan system is enabled
      const [settings] = await pool.query(
        'SELECT enabled FROM clan_settings WHERE server_id = ?',
        [serverId]
      );
      
      if (!settings.length || !settings[0].enabled) {
        return interaction.editReply({
          embeds: [errorEmbed('Clan System Disabled', 'The clan system is not enabled on this server.')]
        });
      }

      // Get player
      const player = await getPlayerByDiscordId(userId, serverId);
      if (!player) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not Found', 'You need to be linked to use clan commands.')]
        });
      }

      // Get player's clan
      const clan = await getPlayerClan(player.id, serverId);
      if (!clan) {
        return interaction.editReply({
          embeds: [errorEmbed('Not in Clan', 'You are not a member of any clan on this server.')]
        });
      }

      // Check if player is the clan owner (only owner can promote)
      const isOwner = await isPlayerClanOwnerOnly(player.id, clan.id);
      if (!isOwner) {
        return interaction.editReply({
          embeds: [errorEmbed('Permission Denied', `Only the clan owner can promote players to co-owner in **${clan.name}**.`)]
        });
      }

      // Get target player
      const targetPlayer = await getPlayerByDiscordId(targetUser.id, serverId);
      if (!targetPlayer) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not Linked', `${targetUser.tag} is not linked to this server.`)]
        });
      }

      // Check if target player is in the same clan
      const isTargetInClan = await isPlayerInClan(targetPlayer.id, clan.id);
      if (!isTargetInClan) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not in Clan', `${targetUser.tag} is not a member of **${clan.name}**.`)]
        });
      }

      // Check if target player is already co-owner
      if (clan.co_owner_id === targetPlayer.id) {
        return interaction.editReply({
          embeds: [errorEmbed('Already Co-Owner', `${targetUser.tag} is already a co-owner of **${clan.name}**.`)]
        });
      }

      // Check if target player is the owner
      if (clan.owner_id === targetPlayer.id) {
        return interaction.editReply({
          embeds: [errorEmbed('Cannot Promote Owner', `You cannot promote yourself to co-owner. You are already the clan owner.`)]
        });
      }

      // Promote player to co-owner
      await pool.query(
        'UPDATE clans SET co_owner_id = ? WHERE id = ?',
        [targetPlayer.id, clan.id]
      );

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) promoted ${targetUser.tag} to co-owner in clan "${clan.name}" on ${server.nickname}`);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('👑 **PLAYER PROMOTED TO CO-OWNER** 👑')
        .setDescription(`**${targetUser.tag}** has been promoted to co-owner of **${clan.name}**!`)
        .addFields(
          { name: '🏷️ **Clan Tag**', value: `**[${clan.tag}]**`, inline: true },
          { name: '🎨 **Color**', value: `${getEmojiByClanColor(clan.color)} ${clan.color}`, inline: true },
          { name: '👑 **Promoted By**', value: `${interaction.user.tag}`, inline: true },
          { name: '👤 **Promoted Player**', value: `${targetUser.tag}`, inline: true },
          { name: '🎮 **Game Name**', value: `**${targetPlayer.name}**`, inline: true },
          { name: '📅 **Promoted**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: '🏰 Zentro Clan System • Co-owner has full clan management rights' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Clan promote error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan Promotion Failed', `Failed to promote player to co-owner. Error: ${err.message}`)]
      });
    }
  }
}; 