const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const { getEmojiByClanColor } = require('../../utils/clanSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-clans')
    .setDescription('List all clans on a server with pagination (Admin only)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to list clans from')
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
      console.error('List clans autocomplete error:', error);
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

      // Get all clans with member counts
      const [clans] = await pool.query(`
        SELECT 
          c.*,
          COUNT(cm.player_id) as member_count,
          p_owner.name as owner_name,
          p_coowner.name as coowner_name
        FROM clans c
        LEFT JOIN clan_members cm ON c.id = cm.clan_id
        LEFT JOIN players p_owner ON c.owner_id = p_owner.id
        LEFT JOIN players p_coowner ON c.co_owner_id = p_coowner.id
        WHERE c.server_id = ?
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `, [server.id]);

      if (clans.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Clans Found', `There are no clans on **${server.nickname}**.`)]
        });
      }

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) listed ${clans.length} clans on ${server.nickname}`);

      // Create pagination
      const clansPerPage = 5;
      const totalPages = Math.ceil(clans.length / clansPerPage);
      let currentPage = 1;

      function createClanEmbed(page) {
        const startIndex = (page - 1) * clansPerPage;
        const endIndex = startIndex + clansPerPage;
        const pageClans = clans.slice(startIndex, endIndex);

        const embed = new EmbedBuilder()
          .setColor(0xFF8C00)
          .setTitle(`🏰 **CLAN LIST** 🏰`)
          .setDescription(`**All clans on ${server.nickname}** (Page ${page}/${totalPages})`)
          .addFields(
            { name: '📊 **Total Clans**', value: `**${clans.length}** clans`, inline: true },
            { name: '👥 **Total Members**', value: `**${clans.reduce((sum, clan) => sum + clan.member_count, 0)}** members`, inline: true },
            { name: '👑 **Listed By**', value: `${interaction.user.tag}`, inline: true }
          );

        pageClans.forEach((clan, index) => {
          const clanNumber = startIndex + index + 1;
          const colorEmoji = getEmojiByClanColor(clan.color);
          const createdDate = `<t:${Math.floor(new Date(clan.created_at).getTime() / 1000)}:R>`;
          
          embed.addFields({
            name: `🏰 **${clanNumber}. ${clan.name}**`,
            value: `🏷️ **Tag:** [${clan.tag}]\n🎨 **Color:** ${colorEmoji} ${clan.color}\n👥 **Members:** ${clan.member_count}\n👑 **Owner:** ${clan.owner_name || 'Unknown'}\n👑 **Co-Owner:** ${clan.coowner_name || 'None'}\n📅 **Created:** ${createdDate}`,
            inline: false
          });
        });

        embed.setFooter({ text: `🏰 Zentro Clan System • Page ${page}/${totalPages} • ${clans.length} total clans` })
          .setTimestamp();

        return embed;
      }

      // Create navigation buttons
      function createButtons() {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('first')
              .setLabel('⏮️ First')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(currentPage === 1),
            new ButtonBuilder()
              .setCustomId('prev')
              .setLabel('◀️ Previous')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentPage === 1),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('Next ▶️')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentPage === totalPages),
            new ButtonBuilder()
              .setCustomId('last')
              .setLabel('Last ⏭️')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(currentPage === totalPages)
          );

        return row;
      }

      // Send initial embed
      const embed = createClanEmbed(currentPage);
      const buttons = createButtons();
      
      const response = await interaction.editReply({ 
        embeds: [embed], 
        components: totalPages > 1 ? [buttons] : [] 
      });

      // Handle button interactions
      if (totalPages > 1) {
        const collector = response.createMessageComponentCollector({ 
          time: 300000 // 5 minutes
        });

        collector.on('collect', async (i) => {
          if (i.user.id !== userId) {
            await i.reply({ 
              content: '❌ This is not your clan list!', 
              ephemeral: true 
            });
            return;
          }

          switch (i.customId) {
            case 'first':
              currentPage = 1;
              break;
            case 'prev':
              currentPage = Math.max(1, currentPage - 1);
              break;
            case 'next':
              currentPage = Math.min(totalPages, currentPage + 1);
              break;
            case 'last':
              currentPage = totalPages;
              break;
          }

          const updatedEmbed = createClanEmbed(currentPage);
          const updatedButtons = createButtons();

          await i.update({ 
            embeds: [updatedEmbed], 
            components: [updatedButtons] 
          });
        });

        collector.on('end', async () => {
          // Disable all buttons when collector expires
          const disabledButtons = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('first')
                .setLabel('⏮️ First')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('last')
                .setLabel('Last ⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            );

          await response.edit({ 
            embeds: [embed], 
            components: [disabledButtons] 
          });
        });
      }

    } catch (err) {
      console.error('List clans error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan List Failed', `Failed to list clans. Error: ${err.message}`)]
      });
    }
  }
}; 