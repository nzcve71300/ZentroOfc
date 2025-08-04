const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const { 
  getPlayerByDiscordId, 
  getPlayerClan,
  isPlayerClanOwner,
  getClanInvite,
  getEmojiByClanColor
} = require('../../utils/clanSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan-invite')
    .setDescription('Invite a player to your clan (only clan owner/co-owner can do this)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server your clan is on')
        .setRequired(true)
        .setAutocomplete(true))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The Discord user to invite')
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
      console.error('Clan invite autocomplete error:', error);
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

      // Check if player is clan owner or co-owner
      const isOwner = await isPlayerClanOwner(player.id, clan.id);
      if (!isOwner) {
        return interaction.editReply({
          embeds: [errorEmbed('Permission Denied', `Only the clan owner or co-owner can invite players to **${clan.name}**.`)]
        });
      }

      // Get target player
      const targetPlayer = await getPlayerByDiscordId(targetUser.id, server.id);
      if (!targetPlayer) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not Linked', `${targetUser.tag} is not linked to this server. They need to link their account first.`)]
        });
      }

      // Check if target player is already in a clan
      const [targetClan] = await pool.query(`
        SELECT c.* FROM clans c
        INNER JOIN clan_members cm ON c.id = cm.clan_id
        WHERE cm.player_id = ? AND c.server_id = ?
      `, [targetPlayer.id, server.id]);

      if (targetClan.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Already in Clan', `${targetUser.tag} is already a member of **${targetClan[0].name}**.`)]
        });
      }

      // Check if target player already has an invite
      const existingInvite = await getClanInvite(clan.id, targetPlayer.id);
      if (existingInvite) {
        return interaction.editReply({
          embeds: [errorEmbed('Invite Already Sent', `${targetUser.tag} already has a pending invite to **${clan.name}**.`)]
        });
      }

      // Create invite
      await pool.query(
        'INSERT INTO clan_invites (clan_id, invited_player_id, invited_by_id) VALUES (?, ?, ?)',
        [clan.id, targetPlayer.id, player.id]
      );

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) invited ${targetUser.tag} to clan "${clan.name}" on ${server.nickname}`);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('📨 **CLAN INVITE SENT** 📨')
        .setDescription(`**${targetUser.tag}** has been invited to join **${clan.name}**!`)
        .addFields(
          { name: '🏷️ **Clan Tag**', value: `**[${clan.tag}]**`, inline: true },
          { name: '🎨 **Color**', value: `${getEmojiByClanColor(clan.color)} ${clan.color}`, inline: true },
          { name: '👑 **Invited By**', value: `${interaction.user.tag}`, inline: true },
          { name: '⏰ **Expires**', value: `<t:${Math.floor(Date.now() / 1000) + 86400}:R>`, inline: true },
          { name: '🎮 **Game Name**', value: `**${targetPlayer.name}**`, inline: true },
          { name: '📅 **Invited**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: '🏰 Zentro Clan System • Invite expires in 24 hours' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Clan invite error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan Invite Failed', `Failed to send clan invite. Error: ${err.message}`)]
      });
    }
  }
}; 