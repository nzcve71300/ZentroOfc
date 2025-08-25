const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');
const { normalizeDiscordId, compareDiscordIds, normalizeIgnForComparison } = require('../../utils/linking');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('force-link')
    .setDescription('Forcefully link a Discord user to an in-game player name (Admin only)')
    .addUserOption(option =>
      option.setName('discord_user')
        .setDescription('The Discord user to link (mention or select)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('The in-game player name')
        .setRequired(true)
        .setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply();
    
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const guildId = interaction.guildId;
    const discordUser = interaction.options.getUser('discord_user');
    const discordId = discordUser.id.toString(); // Ensure string format
    const playerName = normalizeIgnForComparison(interaction.options.getString('ign'));

    // Validate inputs
    if (!playerName || playerName.length < 2) {
      return await interaction.editReply({
        embeds: [errorEmbed('Invalid Name', 'Please provide a valid in-game name (at least 2 characters).')]
      });
    }

    try {
      // Get all servers for this guild
      const [servers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guildId]
      );

      if (servers.length === 0) {
        return await interaction.editReply({
          embeds: [errorEmbed('No Servers Found', 'No Rust servers found for this Discord. Contact an admin.')]
        });
      }

      const linkedServers = [];
      const errors = [];
      const warnings = [];

      // Check if Discord user is already linked to a different IGN
      const [existingDiscordLinks] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND p.discord_id = ? 
         AND p.is_active = true`,
        [guildId, discordId]
      );

      if (existingDiscordLinks.length > 0) {
        const currentIgn = existingDiscordLinks[0].ign;
        if (currentIgn.toLowerCase() !== playerName.toLowerCase()) {
          warnings.push(`⚠️ **${discordUser.username}** is already linked to **${currentIgn}** on: ${existingDiscordLinks.map(p => p.nickname).join(', ')}`);
        }
      }

      // Check if IGN is already linked to a different Discord user
      const [existingIgnLinks] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND LOWER(p.ign) = LOWER(?) 
         AND p.is_active = true`,
        [guildId, playerName]
      );

      if (existingIgnLinks.length > 0) {
        const existingDiscordId = existingIgnLinks[0].discord_id;
        if (!compareDiscordIds(existingDiscordId, discordId)) {
          warnings.push(`⚠️ **${playerName}** is already linked to Discord ID **${existingDiscordId}** on: ${existingIgnLinks.map(p => p.nickname).join(', ')}`);
        }
      }

      // Process each server
      for (const server of servers) {
        try {
          // Ensure guild exists
          await pool.query(
            'INSERT INTO guilds (discord_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
            [guildId, interaction.guild?.name || 'Unknown Guild']
          );

          // First, delete any existing records that would conflict with the unique constraint
          // Delete records with the same Discord ID on this server
          await pool.query(
            'DELETE FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND discord_id = ?',
            [guildId, server.id, discordId]
          );

          // Delete records with the same IGN on this server
          await pool.query(
            'DELETE FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND LOWER(ign) = LOWER(?)',
            [guildId, server.id, playerName]
          );

          // Insert new player
          const [playerResult] = await pool.query(
            'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, CURRENT_TIMESTAMP, true)',
            [guildId, server.id, discordId, playerName]
          );
          
          // Create economy record
          await pool.query(
            'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT id FROM guilds WHERE discord_id = ?), 0) ON DUPLICATE KEY UPDATE balance = balance',
            [playerResult.insertId, guildId]
          );
          
          linkedServers.push(server.nickname);
        } catch (error) {
          console.error(`Failed to force link to server ${server.nickname}:`, error);
          errors.push(`${server.nickname}: ${error.message}`);
        }
      }

      // Create ZentroLinked role if it doesn't exist and assign it to the user
      try {
        const guild = interaction.guild;
        let zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
        
        if (!zentroLinkedRole) {
          console.log(`[ROLE] Creating ZentroLinked role for guild: ${guild.name}`);
          zentroLinkedRole = await guild.roles.create({
            name: 'ZentroLinked',
            color: '#00ff00', // Green color
            reason: 'Auto-created role for linked players'
          });
          console.log(`[ROLE] Successfully created ZentroLinked role with ID: ${zentroLinkedRole.id}`);
        }
        
        // Assign the role to the user
        const member = await guild.members.fetch(discordId);
        if (member && !member.roles.cache.has(zentroLinkedRole.id)) {
          await member.roles.add(zentroLinkedRole);
          console.log(`[ROLE] Assigned ZentroLinked role to user: ${member.user.username}`);
        }
      } catch (roleError) {
        console.log('Could not create/assign ZentroLinked role:', roleError.message);
      }

      // Build response message
      let responseMessage = `**${discordUser.username}** has been force-linked to **${playerName}**!\n\n`;
      
      if (warnings.length > 0) {
        responseMessage += `**Warnings:**\n${warnings.join('\n')}\n\n`;
      }
      
      if (linkedServers.length > 0) {
        responseMessage += `**✅ Successfully linked to:** ${linkedServers.join(', ')}`;
      }
      
      if (errors.length > 0) {
        responseMessage += `\n\n**❌ Errors:**\n${errors.join('\n')}`;
      }

      const embed = successEmbed('Force Link Complete', responseMessage);
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in force-link:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to force link player. Please try again.')]
      });
    }
  }
};
