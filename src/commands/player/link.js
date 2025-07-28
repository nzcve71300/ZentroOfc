const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const {
  isDiscordIdBlocked,
  isIgnBlocked,
  getActivePlayerLinks,
  isDiscordIdLinkedToDifferentIgn,
  isIgnLinkedToDifferentDiscordId,
  createLinkRequest,
  getServersForGuild
} = require('../../utils/linking');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account with your in-game name')
    .addStringOption(opt =>
      opt.setName('in-game-name')
        .setDescription('Your in-game name')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
    const ign = interaction.options.getString('in-game-name');

    try {
      // TEMPORARILY DISABLED: Check if Discord ID is blocked
      // const isBlocked = await isDiscordIdBlocked(guildId, discordId);
      // if (isBlocked) {
      //   return await interaction.editReply({
      //     embeds: [errorEmbed('Account Blocked', 'Your Discord account is blocked from linking. Contact an admin.')]
      //   });
      // }

      // TEMPORARILY DISABLED: Check if IGN is blocked
      // const isIgnBlockedResult = await isIgnBlocked(guildId, ign);
      // if (isIgnBlockedResult) {
      //   return await interaction.editReply({
      //     embeds: [errorEmbed('IGN Blocked', 'This in-game name is blocked from linking. Contact an admin.')]
      //   });
      // }

      // Get all servers for this guild
      const servers = await getServersForGuild(guildId);
      if (servers.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('No Server Found', 'No Rust server found for this Discord. Contact an admin.')]
        });
      }

      // Check if Discord ID is already linked to a different IGN
      const isLinkedToDifferentIgn = await isDiscordIdLinkedToDifferentIgn(guildId, discordId, ign);
      if (isLinkedToDifferentIgn) {
        return await interaction.editReply({
          embeds: [orangeEmbed('Already Linked', 'Your Discord is already linked to a different in-game name. Use `/unlink` first.')]
        });
      }

      // Check if IGN is already linked to a different Discord ID
      const isIgnLinkedToDifferentDiscord = await isIgnLinkedToDifferentDiscordId(guildId, ign, discordId);
      if (isIgnLinkedToDifferentDiscord) {
        return await interaction.editReply({
          embeds: [orangeEmbed('IGN Already Linked', 'This in-game name is already linked to another Discord account.')]
        });
      }

      // Check if already linked to this IGN
      const existingLinks = await getActivePlayerLinks(guildId, discordId);
      const alreadyLinkedToThisIgn = existingLinks.some(link => link.ign.toLowerCase() === ign.toLowerCase());
      if (alreadyLinkedToThisIgn) {
        return await interaction.editReply({
          embeds: [orangeEmbed('Already Linked', 'Your Discord is already linked to this in-game name.')]
        });
      }

      // Create link request for the first server (we'll link to all servers when confirmed)
      const firstServer = servers[0];
      await createLinkRequest(guildId, discordId, ign, firstServer.id);

      // Confirm linking
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`link_confirm_${guildId}_${discordId}_${ign}`)
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('link_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

      const confirmEmbed = orangeEmbed(
        'Confirm Link', 
        `Are you sure you want to link to **${ign}**?\n\nThis will link your account across **${servers.length} server(s)**:\n${servers.map(s => `• ${s.nickname}`).join('\n')}`
      );
      
      await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
    } catch (error) {
      console.error('Error in /link:', error);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to process link request.')] });
    }
  }
};
