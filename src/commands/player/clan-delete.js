const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const { 
  getPlayerByDiscordId, 
  getPlayerClan,
  isPlayerClanOwnerOnly
} = require('../../utils/clanSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan-delete')
    .setDescription('Delete your clan (only clan owner can do this)')
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
      console.error('Clan delete autocomplete error:', error);
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
      const isOwner = await isPlayerClanOwnerOnly(player.id, clan.id);
      if (!isOwner) {
        return interaction.editReply({
          embeds: [errorEmbed('Permission Denied', `Only the clan owner can delete **${clan.name}**. You are not the owner.`)]
        });
      }

      // Get clan members count
      const [members] = await pool.query(
        'SELECT COUNT(*) as count FROM clan_members WHERE clan_id = ?',
        [clan.id]
      );
      const memberCount = members[0].count;

      // Delete clan (cascade will handle clan_members and clan_invites)
      await pool.query('DELETE FROM clans WHERE id = ?', [clan.id]);

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) deleted clan "${clan.name}" [${clan.tag}] on ${server.nickname}`);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('🗑️ **CLAN DELETED SUCCESSFULLY** 🗑️')
        .setDescription(`**${clan.name}** has been permanently deleted from **${server.nickname}**!`)
        .addFields(
          { name: '🏷️ **Clan Tag**', value: `**[${clan.tag}]**`, inline: true },
          { name: '👥 **Members Removed**', value: `**${memberCount}** members`, inline: true },
          { name: '👑 **Deleted By**', value: `${interaction.user.tag}`, inline: true },
          { name: '📅 **Deleted**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: '🏰 Zentro Clan System • Clan deletion is permanent' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Clan delete error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan Deletion Failed', `Failed to delete clan. Error: ${err.message}`)]
      });
    }
  }
}; 