const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const { 
  getPlayerByDiscordId, 
  getClanByServerAndName, 
  getClanByServerAndTag, 
  getPlayerClan,
  getClanColorByEmoji,
  getEmojiByClanColor,
  CLAN_COLORS
} = require('../../utils/clanSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan-create')
    .setDescription('Create a new clan')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to create the clan on')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('clan_name')
        .setDescription('The name of your clan')
        .setRequired(true)
        .setMaxLength(50))
    .addStringOption(option =>
      option.setName('tag')
        .setDescription('Your clan tag (4 characters max)')
        .setRequired(true)
        .setMaxLength(4)
        .setMinLength(4))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Choose your clan color')
        .setRequired(true)
        .addChoices(
          { name: '🔴 Red', value: '🔴' },
          { name: '🔵 Blue', value: '🔵' },
          { name: '🟢 Green', value: '🟢' },
          { name: '🟡 Yellow', value: '🟡' },
          { name: '🟣 Purple', value: '🟣' },
          { name: '🟠 Orange', value: '🟠' },
          { name: '🔷 Cyan', value: '🔷' },
          { name: '💖 Pink', value: '💖' },
          { name: '🟦 Teal', value: '🟦' },
          { name: '🟩 Lime', value: '🟩' },
          { name: '💜 Magenta', value: '💜' },
          { name: '⚪ White', value: '⚪' }
        )),

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
      console.error('Clan create autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');
    const clanName = interaction.options.getString('clan_name');
    const tag = interaction.options.getString('tag').toUpperCase();
    const colorEmoji = interaction.options.getString('color');

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

      // Check if player is already in a clan
      const existingClan = await getPlayerClan(player.id, serverId);
      console.log(`[CLAN CREATE DEBUG] Player ${player.id} (${player.name}) existing clan:`, existingClan);
      if (existingClan) {
        return interaction.editReply({
          embeds: [errorEmbed('Already in Clan', `You are already a member of **${existingClan.name}**. You must leave your current clan first.`)]
        });
      }

      // Check if clan name already exists
      const existingClanByName = await getClanByServerAndName(serverId, clanName);
      if (existingClanByName) {
        return interaction.editReply({
          embeds: [errorEmbed('Clan Name Taken', `A clan with the name **${clanName}** already exists on this server.`)]
        });
      }

      // Check if clan tag already exists
      const existingClanByTag = await getClanByServerAndTag(serverId, tag);
      if (existingClanByTag) {
        return interaction.editReply({
          embeds: [errorEmbed('Clan Tag Taken', `A clan with the tag **[${tag}]** already exists on this server.`)]
        });
      }

      // Get color hex
      const colorHex = getClanColorByEmoji(colorEmoji);

      // Create clan
      const [result] = await pool.query(
        'INSERT INTO clans (server_id, name, tag, color, owner_id) VALUES (?, ?, ?, ?, ?)',
        [serverId, clanName, tag, colorHex, player.id]
      );

      const clanId = result.insertId;

      // Add owner as member
      await pool.query(
        'INSERT INTO clan_members (clan_id, player_id) VALUES (?, ?)',
        [clanId, player.id]
      );

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) created clan "${clanName}" [${tag}] on ${server.nickname}`);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('🏰 **CLAN CREATED SUCCESSFULLY** 🏰')
        .setDescription(`**${clanName}** has been created on **${server.nickname}**!`)
        .addFields(
          { name: '👑 **Owner**', value: `${interaction.user.tag}`, inline: true },
          { name: '🏷️ **Tag**', value: `**[${tag}]**`, inline: true },
          { name: '🎨 **Color**', value: `${colorEmoji} ${colorHex}`, inline: true },
          { name: '📅 **Created**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: '👥 **Members**', value: '**1** (You)', inline: true },
          { name: '🆔 **Clan ID**', value: `**#${clanId}**`, inline: true }
        )
        .setFooter({ text: '🏰 Zentro Clan System • Use /clan-invite to add members' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Clan create error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan Creation Failed', `Failed to create clan. Error: ${err.message}`)]
      });
    }
  }
}; 