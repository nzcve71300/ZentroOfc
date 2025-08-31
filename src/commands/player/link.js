const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');
const { validateDiscordIdForDatabase, compareDiscordIds } = require('../../utils/discordUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to your in-game name')
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('Your in-game name')
        .setRequired(true)
        .setMaxLength(32)),

  async execute(interaction) {
    console.log(`🔗 LINK COMMAND: User ${interaction.user.id} attempting to link IGN: "${interaction.options.getString('ign')}"`);
    
    try {
      const discordId = interaction.user.id;
      const ign = interaction.options.getString('ign').trim();
      const guildId = interaction.guildId;

      // CRITICAL VALIDATION 1: Validate Discord ID before any processing
      if (!validateDiscordIdForDatabase(discordId, 'link command')) {
        console.error(`🚨 LINK COMMAND: Invalid Discord ID detected: ${discordId}`);
        await interaction.reply({
          content: '❌ **Error:** Invalid Discord ID detected. Please contact an administrator.',
          ephemeral: true
        });
        return;
      }

      // CRITICAL VALIDATION 2: Validate IGN
      if (!ign || ign.length < 2 || ign.length > 32) {
        console.error(`🚨 LINK COMMAND: Invalid IGN detected: "${ign}"`);
        await interaction.reply({
          content: '❌ **Error:** Invalid in-game name. Must be 2-32 characters.',
          ephemeral: true
        });
        return;
      }

      // CRITICAL VALIDATION 3: Validate guild ID
      if (!guildId) {
        console.error(`🚨 LINK COMMAND: No guild ID found for user ${discordId}`);
        await interaction.reply({
          content: '❌ **Error:** Guild ID not found. Please try again.',
          ephemeral: true
        });
        return;
      }

      console.log(`🔗 LINK COMMAND: Validated inputs - Discord ID: ${discordId}, IGN: "${ign}", Guild: ${guildId}`);

      // Get all servers for this guild
      const [servers] = await pool.query(`
        SELECT id, nickname, guild_id 
        FROM rust_servers 
        WHERE guild_id = ?
      `, [guildId]);

      if (servers.length === 0) {
        console.log(`❌ LINK COMMAND: No servers found for guild ${guildId}`);
        await interaction.reply({
          content: '❌ **Error:** No Rust servers found for this Discord server.',
          ephemeral: true
        });
        return;
      }

      console.log(`🔗 LINK COMMAND: Found ${servers.length} servers for guild ${guildId}`);

      // CRITICAL CHECK 1: Check if this Discord user has active links in this guild
      console.log(`🔍 LINK COMMAND: Checking if Discord user ${discordId} has active links in guild ${guildId}...`);
      const [activeDiscordLinks] = await pool.query(`
        SELECT ign, server_id, linked_at
        FROM players 
        WHERE discord_id = ? AND guild_id = ? AND is_active = 1
      `, [discordId, guildId]);

      console.log(`🔍 LINK COMMAND: Found ${activeDiscordLinks.length} active links for Discord user ${discordId} in guild ${guildId}`);

      if (activeDiscordLinks.length > 0) {
        const existingLink = activeDiscordLinks[0];
        console.log(`❌ LINK COMMAND: User ${discordId} already linked to "${existingLink.ign}" on server ${existingLink.server_id}`);
        
        await interaction.reply({
          content: `❌ **Already Linked**\nYou are already linked to **${existingLink.ign}** on: **${existingLink.server_id}**\n\n⚠️ **ONE-TIME LINKING:** You can only link once per guild. Contact an admin to unlink you if you need to change your name.`,
          ephemeral: true
        });
        return;
      }

      // CRITICAL CHECK 2: Check if this IGN has active links in this guild
      console.log(`🔍 LINK COMMAND: Checking if IGN "${ign}" has active links in guild ${guildId}...`);
      const [activeIgnLinks] = await pool.query(`
        SELECT discord_id, server_id, linked_at
        FROM players 
        WHERE ign = ? AND guild_id = ? AND is_active = 1
      `, [ign, guildId]);

      console.log(`🔍 LINK COMMAND: Found ${activeIgnLinks.length} active links for IGN "${ign}" in guild ${guildId}`);

      if (activeIgnLinks.length > 0) {
        const existingLink = activeIgnLinks[0];
        console.log(`❌ LINK COMMAND: IGN "${ign}" already linked to Discord ID ${existingLink.discord_id} on server ${existingLink.server_id}`);
        
        await interaction.reply({
          content: `❌ **IGN Already Linked**\nThe in-game name **${ign}** is already linked to another Discord account on: **${existingLink.server_id}**\n\nPlease use a different in-game name or contact an admin.`,
          ephemeral: true
        });
        return;
      }

      console.log(`✅ LINK COMMAND: All checks passed - proceeding with link creation`);

      // Create confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🔗 Link Confirmation')
        .setDescription(`Are you sure you want to link your Discord account to **${ign}**?`)
        .addFields(
          { name: 'Discord User', value: `<@${discordId}>`, inline: true },
          { name: 'In-Game Name', value: ign, inline: true },
          { name: 'Servers', value: servers.map(s => s.nickname).join(', '), inline: false }
        )
        .setFooter({ text: 'This link will apply to all servers in this Discord server' })
        .setTimestamp();

      const confirmButton = new ButtonBuilder()
        .setCustomId(`link_confirm_${guildId}_${discordId}_${ign}`)
        .setLabel('Confirm Link')
        .setStyle(ButtonStyle.Success);

      const cancelButton = new ButtonBuilder()
        .setCustomId('link_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder()
        .addComponents(confirmButton, cancelButton);

      console.log(`🔗 LINK COMMAND: Sending confirmation embed for user ${discordId}, IGN "${ign}"`);
      
      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

    } catch (error) {
      console.error(`🚨 LINK COMMAND ERROR:`, error);
      console.error(`🚨 Context: Discord ID: ${interaction.user.id}, IGN: "${interaction.options.getString('ign')}", Guild: ${interaction.guildId}`);
      
      await interaction.reply({
        content: '❌ **Error:** An unexpected error occurred while processing your link request. Please try again or contact an administrator.',
        ephemeral: true
      });
    }
  }
};
