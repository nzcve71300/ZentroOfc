const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const { 
  getPlayerByDiscordId, 
  getPlayerClan,
  getClanMembers,
  getEmojiByClanColor
} = require('../../utils/clanSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan-view')
    .setDescription('View your clan members (only clan owner/co-owner can do this)')
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
      console.error('Clan view autocomplete error:', error);
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

      // Use server.guild_id (Discord guild ID) directly for database operations
      const serverId = server.guild_id;

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
      const [ownerCheck] = await pool.query(
        'SELECT * FROM clans WHERE id = ? AND (owner_id = ? OR co_owner_id = ?)',
        [clan.id, player.id, player.id]
      );

      if (ownerCheck.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Permission Denied', `Only the clan owner or co-owner can view clan members of **${clan.name}**.`)]
        });
      }

      // Get clan members
      const members = await getClanMembers(clan.id);

      // Get owner and co-owner info
      const [owner] = await pool.query('SELECT * FROM players WHERE id = ?', [clan.owner_id]);
      const [coOwner] = clan.co_owner_id ? await pool.query('SELECT * FROM players WHERE id = ?', [clan.co_owner_id]) : [null];

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) viewed clan "${clan.name}" members on ${server.nickname}`);

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle(`🏰 **${clan.name.toUpperCase()}** 🏰`)
        .setDescription(`**Clan Information** for **${server.nickname}**`)
        .addFields(
          { name: '🏷️ **Clan Tag**', value: `**[${clan.tag}]**`, inline: true },
          { name: '🎨 **Color**', value: `${getEmojiByClanColor(clan.color)} ${clan.color}`, inline: true },
          { name: '👥 **Total Members**', value: `**${members.length}**`, inline: true },
          { name: '👑 **Owner**', value: `**${owner[0]?.name || 'Unknown'}**`, inline: true },
          { name: '👑 **Co-Owner**', value: coOwner[0] ? `**${coOwner[0].name}**` : '**None**', inline: true },
          { name: '📅 **Created**', value: `<t:${Math.floor(new Date(clan.created_at).getTime() / 1000)}:R>`, inline: true }
        );

      // Add members list
      if (members.length > 0) {
        let membersList = '';
        let memberCount = 0;

        for (const member of members) {
          const role = member.id === clan.owner_id ? '👑 **Owner**' : 
                      member.id === clan.co_owner_id ? '👑 **Co-Owner**' : '👤 **Member**';
          
          const joinedDate = `<t:${Math.floor(new Date(member.joined_at).getTime() / 1000)}:R>`;
          
          membersList += `${role} **${member.name}** (Joined ${joinedDate})\n`;
          memberCount++;

          // Split into multiple fields if too long
          if (memberCount % 10 === 0 && memberCount < members.length) {
            embed.addFields({ name: `👥 **Members (${memberCount - 9}-${memberCount})**`, value: membersList, inline: false });
            membersList = '';
          }
        }

        if (membersList) {
          embed.addFields({ name: `👥 **Members (${Math.floor(memberCount / 10) * 10 + 1}-${memberCount})**`, value: membersList, inline: false });
        }
      } else {
        embed.addFields({ name: '👥 **Members**', value: '**No members found**', inline: false });
      }

      embed.setFooter({ text: '🏰 Zentro Clan System • Clan member overview' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Clan view error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan View Failed', `Failed to view clan members. Error: ${err.message}`)]
      });
    }
  }
}; 