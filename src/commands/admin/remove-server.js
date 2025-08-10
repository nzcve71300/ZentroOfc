const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-server')
    .setDescription('Remove a server from the database (Admin Only)')
    .addStringOption(option =>
      option.setName('server_name')
        .setDescription('The name of the server to remove (e.g., "Rise 3x")')
        .setRequired(true)
        .setMaxLength(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Insufficient Permissions')
        .setDescription('You need **Administrator** permissions to use this command.')
        .addFields(
          { name: 'Required Permission', value: 'Administrator', inline: true },
          { name: 'Your Permissions', value: 'Insufficient', inline: true }
        )
        .setTimestamp();
      
      return await interaction.editReply({ embeds: [embed] });
    }

    const serverName = interaction.options.getString('server_name');
    const userId = interaction.user.id;

    try {
      // First, check if the server exists
      const [existingServers] = await pool.query(
        'SELECT * FROM servers WHERE server_name LIKE ?',
        [`%${serverName}%`]
      );

      if (existingServers.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Server Not Found')
          .setDescription(`No server found with name containing **"${serverName}"**`)
          .addFields(
            { name: 'Available Servers', value: 'Use `/list-servers` to see all available servers', inline: false }
          )
          .setTimestamp();
        
        return await interaction.editReply({ embeds: [embed] });
      }

      // If multiple servers match, show them all
      if (existingServers.length > 1) {
        const serverList = existingServers.map(server => 
          `• **${server.server_name}** (${server.ip}:${server.port})`
        ).join('\n');

        const embed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⚠️ Multiple Servers Found')
          .setDescription(`Found ${existingServers.length} servers matching **"${serverName}"**`)
          .addFields(
            { name: 'Matching Servers', value: serverList, inline: false },
            { name: 'Action Required', value: 'Please be more specific with the server name to remove the correct one.', inline: false }
          )
          .setTimestamp();
        
        return await interaction.editReply({ embeds: [embed] });
      }

      const serverToRemove = existingServers[0];

      // Begin transaction
      await pool.query('START TRANSACTION');

      try {
        // Remove the server
        const [deleteResult] = await pool.query(
          'DELETE FROM servers WHERE id = ?',
          [serverToRemove.id]
        );

        if (deleteResult.affectedRows === 0) {
          throw new Error('Server deletion failed');
        }

        // Commit transaction
        await pool.query('COMMIT');

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Server Removed Successfully')
          .setDescription(`**${serverToRemove.server_name}** has been removed from the database`)
          .addFields(
            { name: 'Server Details', value: `${serverToRemove.ip}:${serverToRemove.port}`, inline: true },
            { name: 'Removed By', value: `<@${userId}> (Admin)`, inline: true },
            { name: 'Removed At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setFooter({ text: 'The server will no longer be monitored or managed by the bot.' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

      } catch (error) {
        // Rollback transaction on error
        await pool.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('Error in remove-server command:', error);
      
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription('An error occurred while removing the server. Please try again later.')
        .addFields(
          { name: 'Error Details', value: 'If this problem persists, please contact support.', inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
}; 