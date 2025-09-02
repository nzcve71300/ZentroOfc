const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const prisonSystem = require('../../utils/prisonSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-prisoners')
    .setDescription('View all currently imprisoned players on a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname LIKE ? 
         ORDER BY rs.nickname 
         LIMIT 25`,
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in view-prisoners autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, true);
    }

    await interaction.deferReply({ ephemeral: true });

    const serverName = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Get server information
      const [serverResult] = await pool.query(
        `SELECT rs.id, rs.nickname
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE rs.nickname = ? AND g.discord_id = ?`,
        [serverName, guildId]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const server = serverResult[0];
      const serverId = server.id;

      // Get all active prisoners
      const prisoners = await prisonSystem.getActivePrisoners(serverId);

      if (prisoners.length === 0) {
        const embed = orangeEmbed(
          'Prison Status',
          `**${serverName}**\n\n` +
          `🔓 **No prisoners currently incarcerated**\n\n` +
          `The prison is empty! All cells are available.`
        );
        return interaction.editReply({ embeds: [embed] });
      }

      // Create embed with prisoner information
      const embed = new EmbedBuilder()
        .setTitle(`🔒 Prison Status - ${serverName}`)
        .setColor(0xFF6B6B)
        .setTimestamp()
        .setFooter({ text: `Total Prisoners: ${prisoners.length}` });

      let description = `**Currently Incarcerated:** ${prisoners.length} prisoner(s)\n\n`;

      // Group prisoners by cell
      const prisonersByCell = {};
      prisoners.forEach(prisoner => {
        if (!prisonersByCell[prisoner.cell_number]) {
          prisonersByCell[prisoner.cell_number] = [];
        }
        prisonersByCell[prisoner.cell_number].push(prisoner);
      });

      // Add each cell's information
      for (let cellNumber = 1; cellNumber <= 6; cellNumber++) {
        const cellPrisoners = prisonersByCell[cellNumber] || [];
        
        if (cellPrisoners.length === 0) {
          description += `**Cell ${cellNumber}:** 🟢 Empty\n`;
        } else {
          description += `**Cell ${cellNumber}:** 🔴 Occupied\n`;
          
          cellPrisoners.forEach(prisoner => {
            const sentenceType = prisoner.sentence_type === 'temporary' ? '⏰' : '💀';
            const sentenceInfo = prisoner.sentence_type === 'temporary' 
              ? `${prisoner.sentence_minutes} minutes` 
              : 'Life imprisonment';
            
            const timeServed = this.formatTimeServed(prisoner.sentenced_at);
            const timeRemaining = this.formatTimeRemaining(prisoner);
            
            description += `  ${sentenceType} **${prisoner.player_name}**\n`;
            description += `    • Sentence: ${sentenceInfo}\n`;
            description += `    • Time Served: ${timeServed}\n`;
            if (prisoner.sentence_type === 'temporary' && timeRemaining) {
              description += `    • Time Remaining: ${timeRemaining}\n`;
            }
            description += `    • Sentenced By: ${prisoner.sentenced_by}\n`;
            description += `    • Sentenced: ${new Date(prisoner.sentenced_at).toLocaleDateString()}\n\n`;
          });
        }
      }

      embed.setDescription(description);

      // Add summary statistics
      const tempPrisoners = prisoners.filter(p => p.sentence_type === 'temporary');
      const lifePrisoners = prisoners.filter(p => p.sentence_type === 'life');
      
      const summary = `**Summary:**\n` +
        `• Temporary Sentences: ${tempPrisoners.length}\n` +
        `• Life Sentences: ${lifePrisoners.length}\n` +
        `• Available Cells: ${6 - prisoners.length}`;

      embed.addFields({ name: '📊 Statistics', value: summary, inline: false });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in view-prisoners command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'An error occurred while retrieving prisoner information.')]
      });
    }
  },

  formatTimeServed(sentencedAt) {
    const now = new Date();
    const sentenced = new Date(sentencedAt);
    const diffMs = now - sentenced;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      const hours = Math.floor((diffMinutes % 1440) / 60);
      return `${days}d ${hours}h`;
    }
  },

  formatTimeRemaining(prisoner) {
    if (prisoner.sentence_type !== 'temporary' || !prisoner.release_time) {
      return null;
    }

    const now = new Date();
    const releaseTime = new Date(prisoner.release_time);
    const diffMs = releaseTime - now;
    
    if (diffMs <= 0) {
      return 'Expired (should be released)';
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      const hours = Math.floor((diffMinutes % 1440) / 60);
      return `${days}d ${hours}h`;
    }
  }
};
