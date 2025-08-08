const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { 
  getServersForGuild, 
  createOrUpdatePlayerLink,
  isDiscordId 
} = require('../../utils/unifiedPlayerSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('force-link-player')
    .setDescription('Force link a player (Admin only)')
    .addStringOption(option =>
      option.setName('identifier')
        .setDescription('Discord ID or in-game name of the player')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('In-game name (if linking by Discord ID)')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const identifier = interaction.options.getString('identifier');
    const ign = interaction.options.getString('ign');

    try {
      // Get all servers for this guild
      const servers = await getServersForGuild(guildId);
      if (servers.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Servers Found', 'No Rust servers found for this Discord.')]
        });
      }

      let finalIgn, discordId;

      if (isDiscordId(identifier)) {
        // Linking by Discord ID
        discordId = identifier;
        finalIgn = ign || 'Unknown';
      } else {
        // Linking by IGN
        discordId = '0'; // Placeholder for IGN-only links
        finalIgn = identifier;
      }

      const linkedPlayers = [];
      
      // Link the player to all servers
      for (const server of servers) {
        const player = await createOrUpdatePlayerLink(guildId, server.id, discordId, finalIgn);
        linkedPlayers.push({ server: server.nickname, player: player });
      }

      const embed = successEmbed(
        'Player Force Linked', 
        `Successfully force-linked **${finalIgn}** (${discordId}) across **${servers.length} server(s)**.`
      );

      // Show which servers were linked
      const serverNames = linkedPlayers.map(p => p.server);
      embed.addFields({ name: 'Servers Linked', value: serverNames.join(', ') });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in force-link:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to force-link player. Please try again.')] });
    }
  }
};