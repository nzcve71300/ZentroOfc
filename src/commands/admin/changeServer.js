const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('change-server')
    .setDescription('Update server details while preserving all associated data')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server to update')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('new_nickname')
        .setDescription('New server nickname')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('new_ip')
        .setDescription('New server IP address')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('new_port')
        .setDescription('New server port (1-65535)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(65535))
    .addStringOption(option =>
      option.setName('new_password')
        .setDescription('New RCON password')
        .setRequired(true)),

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
      console.error('Error in change-server autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions (ZentroAdmin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const newNickname = interaction.options.getString('new_nickname').trim();
    const newIp = interaction.options.getString('new_ip').trim();
    const newPort = interaction.options.getInteger('new_port');
    const newPassword = interaction.options.getString('new_password').trim();
    const guildId = interaction.guildId;

    try {
      // Validate IP address format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(newIp)) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid IP Address', 'Please provide a valid IPv4 address (e.g., 192.168.1.1)')]
        });
      }

      // Validate nickname length
      if (newNickname.length < 1 || newNickname.length > 50) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Nickname', 'Server nickname must be between 1 and 50 characters')]
        });
      }

      // Validate password length
      if (newPassword.length < 1) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Password', 'RCON password cannot be empty')]
        });
      }

      // Get the current server details
      const [serverResult] = await pool.query(
        `SELECT rs.*, g.name as guild_name
         FROM rust_servers rs
         JOIN guilds g ON rs.guild_id = g.id
         WHERE rs.nickname = ? AND g.discord_id = ?`,
        [serverNickname, guildId]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const currentServer = serverResult[0];
      const serverId = currentServer.id;

      // Check if the new nickname conflicts with existing servers (excluding current server)
      const [nicknameCheck] = await pool.query(
        `SELECT rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE rs.nickname = ? AND g.discord_id = ? AND rs.id != ?`,
        [newNickname, guildId, serverId]
      );

      if (nicknameCheck.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Nickname Conflict', `A server with the nickname "${newNickname}" already exists in this guild.`)]
        });
      }

      // Check if the new IP:Port combination conflicts with existing servers (excluding current server)
      const [ipPortCheck] = await pool.query(
        `SELECT rs.nickname, rs.ip, rs.port 
         FROM rust_servers rs 
         WHERE rs.ip = ? AND rs.port = ? AND rs.id != ?`,
        [newIp, newPort, serverId]
      );

      if (ipPortCheck.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('IP:Port Conflict', 
            `The IP:Port combination ${newIp}:${newPort} is already used by server "${ipPortCheck[0].nickname}". ` +
            `Each server must have a unique IP:Port combination.`)]
        });
      }

      // Start transaction to ensure data consistency
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // Get counts of associated data before update
        const [channelCount] = await connection.query(
          'SELECT COUNT(*) as count FROM channel_settings WHERE server_id = ?',
          [serverId]
        );
        
        const [playerCount] = await connection.query(
          'SELECT COUNT(*) as count FROM players WHERE server_id = ?',
          [serverId]
        );
        
        const [zorpCount] = await connection.query(
          'SELECT COUNT(*) as count FROM zorp_zones WHERE server_id = ?',
          [serverId]
        );

        // Update the server details
        await connection.query(
          `UPDATE rust_servers 
           SET nickname = ?, ip = ?, port = ?, password = ? 
           WHERE id = ?`,
          [newNickname, newIp, newPort, newPassword, serverId]
        );

        // Commit the transaction
        await connection.commit();
        connection.release();

        // Create summary embed
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🔄 Server Updated Successfully')
          .setDescription(`Server details have been updated while preserving all associated data.`)
          .addFields(
            { 
              name: '📋 Changes Made', 
              value: `**Old:** ${currentServer.nickname} (${currentServer.ip}:${currentServer.port})\n**New:** ${newNickname} (${newIp}:${newPort})`,
              inline: false 
            },
            { 
              name: '💾 Data Preserved', 
              value: `• **${channelCount[0].count}** channel settings\n• **${playerCount[0].count}** player records\n• **${zorpCount[0].count}** ZORP zones\n• All other associated data`,
              inline: false 
            },
            {
              name: '⚠️ Important Notes',
              value: `• The bot will automatically reconnect to the new server details\n• All Discord channels will continue working normally\n• Player data and statistics are preserved\n• You may need to wait up to 60 seconds for the new connection`,
              inline: false
            }
          )
          .setTimestamp();

        await interaction.editReply({
          embeds: [embed]
        });

        // Log the change
        console.log(`[CHANGE-SERVER] Server updated by ${interaction.user.tag} in guild ${guildId}:`);
        console.log(`  Old: ${currentServer.nickname} (${currentServer.ip}:${currentServer.port})`);
        console.log(`  New: ${newNickname} (${newIp}:${newPort})`);
        console.log(`  Preserved: ${channelCount[0].count} channels, ${playerCount[0].count} players, ${zorpCount[0].count} zones`);

      } catch (updateError) {
        // Rollback transaction on error
        await connection.rollback();
        connection.release();
        throw updateError;
      }

    } catch (error) {
      console.error('Error in change-server command:', error);
      
      let errorMessage = 'Failed to update server details.';
      
      if (error.code === 'ER_DUP_ENTRY') {
        errorMessage = 'A server with those details already exists.';
      } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        errorMessage = 'Invalid server reference. Please try again.';
      }
      
      await interaction.editReply({
        embeds: [errorEmbed('Update Failed', `${errorMessage}\n\nError: ${error.message}`)]
      });
    }
  }
};
