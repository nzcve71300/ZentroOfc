const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge-clans')
    .setDescription('Remove all clans from a server (Admin only)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to purge clans from')
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
      console.error('Purge clans autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');

    try {
      // Check if user has admin permissions
      const member = await interaction.guild.members.fetch(userId);
      if (!member.permissions.has('Administrator')) {
        return interaction.editReply({
          embeds: [errorEmbed('Permission Denied', 'You need Administrator permissions to use this command.')]
        });
      }

      // Get server
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      // Get clan count before purge
      const [clanCount] = await pool.query(
        'SELECT COUNT(*) as count FROM clans WHERE server_id = ?',
        [server.id]
      );

      const [memberCount] = await pool.query(`
        SELECT COUNT(*) as count FROM clan_members cm
        INNER JOIN clans c ON cm.clan_id = c.id
        WHERE c.server_id = ?
      `, [server.id]);

      if (clanCount[0].count === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Clans Found', `There are no clans to purge on **${server.nickname}**.`)]
        });
      }

      // Delete all clans (cascade will handle clan_members and clan_invites)
      await pool.query('DELETE FROM clans WHERE server_id = ?', [server.id]);

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) purged ${clanCount[0].count} clans from ${server.nickname}`);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('🗑️ **ALL CLANS PURGED** 🗑️')
        .setDescription(`**All clans have been removed** from **${server.nickname}**!`)
        .addFields(
          { name: '🖥️ **Server**', value: `${server.nickname}`, inline: true },
          { name: '🏰 **Clans Removed**', value: `**${clanCount[0].count}** clans`, inline: true },
          { name: '👥 **Members Affected**', value: `**${memberCount[0].count}** members`, inline: true },
          { name: '👑 **Purged By**', value: `${interaction.user.tag}`, inline: true },
          { name: '📅 **Purged**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: '🏰 Zentro Clan System • All clan data has been permanently deleted' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Purge clans error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan Purge Failed', `Failed to purge clans. Error: ${err.message}`)]
      });
    }
  }
}; 