const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { createOrUpdatePlayerLink, getServersForGuild, isDiscordId } = require('../../utils/unifiedPlayerSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allow-link')
    .setDescription('Allow a player to link their Discord account')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Discord ID or in-game name of the player')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const identifier = interaction.options.getString('name');

    try {
      // Get all servers for this guild
      const servers = await getServersForGuild(guildId);
      if (servers.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Servers Found', 'No Rust servers found for this Discord.')]
        });
      }

      const linkedPlayers = [];
      
      // Link the player to all servers - works with both Discord ID and IGN
      for (const server of servers) {
        const player = await createOrUpdatePlayerLink(guildId, server.id, identifier);
        linkedPlayers.push({ server: server.nickname, player: player });
      }

      const embed = successEmbed(
        'Link Allowed', 
        `Successfully linked **${identifier}** across **${servers.length} server(s)**.`
      );

      // Show which servers were linked
      const serverNames = linkedPlayers.map(p => p.server);
      embed.addFields({ name: 'Servers Linked', value: serverNames.join(', ') });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in allow-link:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to allow link. Please try again.')] });
    }
  }
};
