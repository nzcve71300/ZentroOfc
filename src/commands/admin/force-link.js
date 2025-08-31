const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');
const { validateDiscordIdForDatabase, compareDiscordIds } = require('../../utils/discordUtils');

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
    console.log(`🔗 FORCE-LINK COMMAND: Admin ${interaction.user.id} attempting to force-link Discord user to IGN: "${interaction.options.getString('ign')}"`);
    
    try {
      await interaction.deferReply();
      
      if (!hasAdminPermissions(interaction.member)) {
        return sendAccessDeniedMessage(interaction, false);
      }

      const guildId = interaction.guildId;
      const discordUser = interaction.options.getUser('discord_user');
      const discordId = discordUser.id;
      const playerName = interaction.options.getString('ign').trim();

      // CRITICAL VALIDATION 1: Validate Discord ID before any processing
      if (!validateDiscordIdForDatabase(discordId, 'force-link command')) {
        console.error(`🚨 FORCE-LINK COMMAND: Invalid Discord ID detected: ${discordId}`);
        await interaction.editReply({
          embeds: [errorEmbed('Invalid Discord ID', '❌ **Error:** Invalid Discord ID detected. Please contact an administrator.')]
        });
        return;
      }

      // CRITICAL VALIDATION 2: Validate IGN
      if (!playerName || playerName.length < 2 || playerName.length > 32) {
        console.error(`🚨 FORCE-LINK COMMAND: Invalid IGN detected: "${playerName}"`);
        await interaction.editReply({
          embeds: [errorEmbed('Invalid IGN', '❌ **Error:** Invalid in-game name. Must be 2-32 characters.')]
        });
        return;
      }

      // CRITICAL VALIDATION 3: Validate guild ID
      if (!guildId) {
        console.error(`🚨 FORCE-LINK COMMAND: No guild ID found for admin ${discordId}`);
        await interaction.editReply({
          embeds: [errorEmbed('Guild Error', '❌ **Error:** Guild ID not found. Please try again.')]
        });
        return;
      }

      console.log(`🔗 FORCE-LINK COMMAND: Validated inputs - Discord ID: ${discordId}, IGN: "${playerName}", Guild: ${guildId}`);

      // Get all servers for this guild
      const [servers] = await pool.query(`
        SELECT id, nickname, guild_id 
        FROM rust_servers 
        WHERE guild_id = ?
      `, [guildId]);

      if (servers.length === 0) {
        console.log(`❌ FORCE-LINK COMMAND: No servers found for guild ${guildId}`);
        await interaction.editReply({
          embeds: [errorEmbed('No Servers Found', '❌ **Error:** No Rust servers found for this Discord server.')]
        });
        return;
      }

      console.log(`🔗 FORCE-LINK COMMAND: Found ${servers.length} servers for guild ${guildId}`);

      const linkedServers = [];
      const errors = [];
      const warnings = [];

      // CRITICAL CHECK 1: Check if this Discord user has active links in this guild
      console.log(`🔍 FORCE-LINK COMMAND: Checking if Discord user ${discordId} has existing links...`);
      const [existingDiscordLinks] = await pool.query(`
        SELECT p.*, rs.nickname 
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.guild_id = ? 
        AND p.discord_id = ? 
        AND p.is_active = true
      `, [guildId, discordId]);

      console.log(`🔍 FORCE-LINK COMMAND: Found ${existingDiscordLinks.length} existing links for Discord user ${discordId}`);

      if (existingDiscordLinks.length > 0) {
        const currentIgn = existingDiscordLinks[0].ign;
        if (currentIgn.toLowerCase() !== playerName.toLowerCase()) {
          warnings.push(`⚠️ **${discordUser.username}** is already linked to **${currentIgn}** on: ${existingDiscordLinks.map(p => p.nickname).join(', ')}`);
        }
      }

      // CRITICAL CHECK 2: Check if IGN is already linked to a different Discord user
      console.log(`🔍 FORCE-LINK COMMAND: Checking if IGN "${playerName}" is already linked...`);
      const [existingIgnLinks] = await pool.query(`
        SELECT p.*, rs.nickname 
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.guild_id = ? 
        AND LOWER(p.ign) = LOWER(?) 
        AND p.is_active = true
      `, [guildId, playerName]);

      console.log(`🔍 FORCE-LINK COMMAND: Found ${existingIgnLinks.length} existing links for IGN "${playerName}"`);

      if (existingIgnLinks.length > 0) {
        const existingDiscordId = existingIgnLinks[0].discord_id;
        if (!compareDiscordIds(existingDiscordId, discordId)) {
          warnings.push(`⚠️ **${playerName}** is already linked to Discord ID **${existingDiscordId}** on: ${existingIgnLinks.map(p => p.nickname).join(', ')}`);
        }
      }

      // Process each server
      console.log(`🔗 FORCE-LINK COMMAND: Processing ${servers.length} servers...`);
      for (const server of servers) {
        try {
          console.log(`🔗 FORCE-LINK COMMAND: Processing server ${server.nickname} (ID: ${server.id})`);
          
          // Ensure guild exists
          await pool.query(
            'INSERT INTO guilds (discord_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
            [guildId, interaction.guild?.name || 'Unknown Guild']
          );

          // First, delete any existing records that would conflict with the unique constraint
          // Delete records with the same Discord ID on this server
          const [deleteDiscordResult] = await pool.query(
            'DELETE FROM players WHERE guild_id = ? AND server_id = ? AND discord_id = ?',
            [guildId, server.id, discordId]
          );
          console.log(`🔗 FORCE-LINK COMMAND: Deleted ${deleteDiscordResult.affectedRows} existing Discord ID records for server ${server.nickname}`);

          // Delete records with the same IGN on this server
          const [deleteIgnResult] = await pool.query(
            'DELETE FROM players WHERE guild_id = ? AND server_id = ? AND LOWER(ign) = LOWER(?)',
            [guildId, server.id, playerName]
          );
          console.log(`🔗 FORCE-LINK COMMAND: Deleted ${deleteIgnResult.affectedRows} existing IGN records for server ${server.nickname}`);

          // Insert new player
          const [playerResult] = await pool.query(
            'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, true)',
            [guildId, server.id, discordId, playerName]
          );
          console.log(`🔗 FORCE-LINK COMMAND: Created player record with ID ${playerResult.insertId} for server ${server.nickname}`);
          
          // Create economy record
          await pool.query(
            'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE balance = balance',
            [playerResult.insertId, guildId]
          );
          console.log(`🔗 FORCE-LINK COMMAND: Created economy record for player ${playerResult.insertId} on server ${server.nickname}`);
          
          linkedServers.push(server.nickname);
        } catch (error) {
          console.error(`❌ FORCE-LINK COMMAND: Failed to force link to server ${server.nickname}:`, error);
          errors.push(`${server.nickname}: ${error.message}`);
        }
      }

      // Create ZentroLinked role if it doesn't exist and assign it to the user
      try {
        console.log(`🔗 FORCE-LINK COMMAND: Managing ZentroLinked role for user ${discordUser.username}...`);
        const guild = interaction.guild;
        let zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
        
        if (!zentroLinkedRole) {
          console.log(`🔗 FORCE-LINK COMMAND: Creating ZentroLinked role for guild: ${guild.name}`);
          zentroLinkedRole = await guild.roles.create({
            name: 'ZentroLinked',
            color: '#00ff00', // Green color
            reason: 'Auto-created role for linked players'
          });
          console.log(`🔗 FORCE-LINK COMMAND: Successfully created ZentroLinked role with ID: ${zentroLinkedRole.id}`);
        }
        
        // Assign the role to the user
        const member = await guild.members.fetch(discordId);
        if (member && !member.roles.cache.has(zentroLinkedRole.id)) {
          await member.roles.add(zentroLinkedRole);
          console.log(`🔗 FORCE-LINK COMMAND: Assigned ZentroLinked role to user: ${member.user.username}`);
        } else if (member && member.roles.cache.has(zentroLinkedRole.id)) {
          console.log(`🔗 FORCE-LINK COMMAND: User ${member.user.username} already has ZentroLinked role`);
        }
      } catch (roleError) {
        console.log(`🔗 FORCE-LINK COMMAND: Could not create/assign ZentroLinked role: ${roleError.message}`);
      }

      // Build response message
      console.log(`🔗 FORCE-LINK COMMAND: Building response message...`);
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
      
      console.log(`🔗 FORCE-LINK COMMAND: Successfully force-linked ${discordUser.username} to ${playerName} on ${linkedServers.length} servers`);

    } catch (error) {
      console.error('❌ FORCE-LINK COMMAND: Error in force-link:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', '❌ **Error:** Failed to force link player. Please try again.')]
      });
    }
  }
};
