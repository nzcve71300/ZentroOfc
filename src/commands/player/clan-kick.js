const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const { 
  getPlayerByDiscordId, 
  getPlayerClan,
  isPlayerClanOwner,
  isPlayerInClan,
  getEmojiByClanColor
} = require('../../utils/clanSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan-kick')
    .setDescription('Kick a player from your clan (only clan owner/co-owner can do this)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server your clan is on')
        .setRequired(true)
        .setAutocomplete(true))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The Discord user to kick')
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
      console.error('Clan kick autocomplete error:', error);
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

      // Check if player is clan owner or co-owner
      const isOwner = await isPlayerClanOwner(player.id, clan.id);
      if (!isOwner) {
        return interaction.editReply({
          embeds: [errorEmbed('Permission Denied', `Only the clan owner or co-owner can kick players from **${clan.name}**.`)]
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

      // Check if target player is the owner (can't kick owner)
      if (clan.owner_id === targetPlayer.id) {
        return interaction.editReply({
          embeds: [errorEmbed('Cannot Kick Owner', `You cannot kick the clan owner. The owner must transfer ownership or delete the clan.`)]
        });
      }

      // Check if target player is co-owner and current player is not owner
      if (clan.co_owner_id === targetPlayer.id && clan.owner_id !== player.id) {
        return interaction.editReply({
          embeds: [errorEmbed('Cannot Kick Co-Owner', `Only the clan owner can kick a co-owner.`)]
        });
      }

      // Kick player from clan
      await pool.query(
        'DELETE FROM clan_members WHERE clan_id = ? AND player_id = ?',
        [clan.id, targetPlayer.id]
      );

      // Remove co-owner status if they were co-owner
      if (clan.co_owner_id === targetPlayer.id) {
        await pool.query(
          'UPDATE clans SET co_owner_id = NULL WHERE id = ?',
          [clan.id]
        );
      }

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) kicked ${targetUser.tag} from clan "${clan.name}" on ${server.nickname}`);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('👢 **PLAYER KICKED FROM CLAN** 👢')
        .setDescription(`**${targetUser.tag}** has been kicked from **${clan.name}**!`)
        .addFields(
          { name: '🏷️ **Clan Tag**', value: `**[${clan.tag}]**`, inline: true },
          { name: '🎨 **Color**', value: `${getEmojiByClanColor(clan.color)} ${clan.color}`, inline: true },
          { name: '👑 **Kicked By**', value: `${interaction.user.tag}`, inline: true },
          { name: '👤 **Kicked Player**', value: `${targetUser.tag}`, inline: true },
          { name: '🎮 **Game Name**', value: `**${targetPlayer.name}**`, inline: true },
          { name: '📅 **Kicked**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: '🏰 Zentro Clan System • Player has been removed from clan' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Clan kick error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan Kick Failed', `Failed to kick player from clan. Error: ${err.message}`)]
      });
    }
  }
}; 