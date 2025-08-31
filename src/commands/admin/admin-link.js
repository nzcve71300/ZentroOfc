const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-link')
    .setDescription('Admin link a Discord user to an in-game player name')
    .addUserOption(option =>
      option.setName('discord')
        .setDescription('The Discord user to link')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The in-game player name')
        .setRequired(true)
        .setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    console.log(`🔗 ADMIN-LINK: Admin ${interaction.user.id} attempting to link Discord user to IGN: "${interaction.options.getString('name')}"`);
    
    try {
      await interaction.deferReply();
      
      if (!hasAdminPermissions(interaction.member)) {
        return sendAccessDeniedMessage(interaction, false);
      }

      const guildId = interaction.guildId;
      const discordUser = interaction.options.getUser('discord');
      const discordId = discordUser.id;
      const playerName = interaction.options.getString('name').trim();

      // Validate inputs
      if (!guildId) {
        console.error(`🚨 ADMIN-LINK: No guild ID found`);
        await interaction.editReply({
          embeds: [errorEmbed('Error', '❌ **Error:** Guild ID not found. Please try again.')]
        });
        return;
      }

      if (!playerName || playerName.length < 2 || playerName.length > 32) {
        console.error(`🚨 ADMIN-LINK: Invalid IGN detected: "${playerName}"`);
        await interaction.editReply({
          embeds: [errorEmbed('Invalid IGN', '❌ **Error:** Invalid in-game name. Must be 2-32 characters.')]
        });
        return;
      }

      console.log(`🔗 ADMIN-LINK: Validated inputs - Discord ID: ${discordId}, IGN: "${playerName}", Guild: ${guildId}`);

      // Get all servers for this guild
      const [servers] = await pool.query(`
        SELECT id, nickname, guild_id 
        FROM rust_servers 
        WHERE guild_id = ?
      `, [guildId]);

      if (servers.length === 0) {
        console.log(`❌ ADMIN-LINK: No servers found for guild ${guildId}`);
        await interaction.editReply({
          embeds: [errorEmbed('No Servers Found', '❌ **Error:** No Rust servers found for this Discord server.')]
        });
        return;
      }

      console.log(`🔗 ADMIN-LINK: Found ${servers.length} servers for guild ${guildId}`);

      const linkedServers = [];
      const errors = [];
      const warnings = [];

      // Get guild record first for consistent ID usage
      let guildRecord;
      try {
        const [guildResult] = await pool.query(
          'SELECT id FROM guilds WHERE discord_id = ?',
          [guildId]
        );
        
        if (guildResult.length === 0) {
          // Create the guild record
          const [insertResult] = await pool.query(
            'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
            [guildId, interaction.guild?.name || 'Unknown Guild']
          );
          guildRecord = { id: insertResult.insertId };
        } else {
          guildRecord = guildResult[0];
        }
      } catch (error) {
        console.error(`❌ ADMIN-LINK: Failed to ensure guild exists:`, error);
        throw new Error(`Failed to create guild record: ${error.message}`);
      }

      // Check for existing links
      const [existingDiscordLinks] = await pool.query(`
        SELECT p.*, rs.nickname 
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.guild_id = ? 
        AND p.discord_id = ? 
        AND p.is_active = true
      `, [guildRecord.id, discordId]);

      if (existingDiscordLinks.length > 0) {
        const currentIgn = existingDiscordLinks[0].ign;
        if (currentIgn.toLowerCase() !== playerName.toLowerCase()) {
          warnings.push(`⚠️ **${discordUser.username}** is already linked to **${currentIgn}** on: ${existingDiscordLinks.map(p => p.nickname).join(', ')}`);
        }
      }

      const [existingIgnLinks] = await pool.query(`
        SELECT p.*, rs.nickname 
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.guild_id = ? 
        AND LOWER(p.ign) = LOWER(?) 
        AND p.is_active = true
      `, [guildRecord.id, playerName]);

      if (existingIgnLinks.length > 0) {
        const existingDiscordId = existingIgnLinks[0].discord_id;
        if (existingDiscordId !== discordId) {
          warnings.push(`⚠️ **${playerName}** is already linked to Discord ID **${existingDiscordId}** on: ${existingIgnLinks.map(p => p.nickname).join(', ')}`);
        }
      }

      // Process each server
      console.log(`🔗 ADMIN-LINK: Processing ${servers.length} servers...`);
      for (const server of servers) {
        try {
          console.log(`🔗 ADMIN-LINK: Processing server ${server.nickname} (ID: ${server.id})`);

          // Delete any existing records that would conflict (guild-wide, not just server-specific)
          await pool.query(
            'DELETE FROM players WHERE guild_id = ? AND discord_id = ? AND is_active = true',
            [guildRecord.id, discordId]
          );

          await pool.query(
            'DELETE FROM players WHERE guild_id = ? AND LOWER(ign) = LOWER(?) AND is_active = true',
            [guildRecord.id, playerName]
          );

          // Insert new player
          const [playerResult] = await pool.query(
            'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, true)',
            [guildRecord.id, server.id, discordId, playerName]
          );
          console.log(`🔗 ADMIN-LINK: Created player record with ID ${playerResult.insertId} for server ${server.nickname}`);
          
          // Create economy record
          await pool.query(
            'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE balance = balance',
            [playerResult.insertId, guildRecord.id]
          );
          console.log(`🔗 ADMIN-LINK: Created economy record for player ${playerResult.insertId} on server ${server.nickname}`);
          
          linkedServers.push(server.nickname);
        } catch (error) {
          console.error(`❌ ADMIN-LINK: Failed to link to server ${server.nickname}:`, error);
          errors.push(`${server.nickname}: ${error.message}`);
        }
      }

      // Create ZentroLinked role if it doesn't exist and assign it to the user
      try {
        console.log(`🔗 ADMIN-LINK: Managing ZentroLinked role for user ${discordUser.username}...`);
        const guild = interaction.guild;
        let zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
        
        if (!zentroLinkedRole) {
          console.log(`🔗 ADMIN-LINK: Creating ZentroLinked role for guild: ${guild.name}`);
          zentroLinkedRole = await guild.roles.create({
            name: 'ZentroLinked',
            color: '#00ff00',
            reason: 'Auto-created role for linked players'
          });
          console.log(`🔗 ADMIN-LINK: Successfully created ZentroLinked role with ID: ${zentroLinkedRole.id}`);
        }
        
        // Assign the role to the user
        const member = await guild.members.fetch(discordId);
        if (member && !member.roles.cache.has(zentroLinkedRole.id)) {
          await member.roles.add(zentroLinkedRole);
          console.log(`🔗 ADMIN-LINK: Assigned ZentroLinked role to user: ${member.user.username}`);
        } else if (member && member.roles.cache.has(zentroLinkedRole.id)) {
          console.log(`🔗 ADMIN-LINK: User ${member.user.username} already has ZentroLinked role`);
        }
      } catch (roleError) {
        console.log(`🔗 ADMIN-LINK: Could not create/assign ZentroLinked role: ${roleError.message}`);
      }

      // Build response message
      console.log(`🔗 ADMIN-LINK: Building response message...`);
      let responseMessage = `**${discordUser.username}** has been admin-linked to **${playerName}**!\n\n`;
      
      if (warnings.length > 0) {
        responseMessage += `**Warnings:**\n${warnings.join('\n')}\n\n`;
      }
      
      if (linkedServers.length > 0) {
        responseMessage += `**✅ Successfully linked to:** ${linkedServers.join(', ')}`;
      }
      
      if (errors.length > 0) {
        responseMessage += `\n\n**❌ Errors:**\n${errors.join('\n')}`;
      }

      const embed = successEmbed('Admin Link Complete', responseMessage);
      await interaction.editReply({ embeds: [embed] });
      
      console.log(`🔗 ADMIN-LINK: Successfully admin-linked ${discordUser.username} to ${playerName} on ${linkedServers.length} servers`);

    } catch (error) {
      console.error('❌ ADMIN-LINK: Error in admin-link:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', '❌ **Error:** Failed to admin link player. Please try again.')]
      });
    }
  }
};
