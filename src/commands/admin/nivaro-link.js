const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../../db');
const { ensureZentroAdminRole, isAuthorizedGuild, sendUnauthorizedGuildMessage } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nivaro-link')
    .setDescription('Link your Discord server to your Nivaro store (Admin Only)')
    .addStringOption(option =>
      option.setName('secret_key')
        .setDescription('The secret key from your Nivaro store dashboard')
        .setRequired(true)
        .setMaxLength(64))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('❌ Insufficient Permissions')
        .setDescription('You need **Administrator** permissions to use this command.')
        .addFields(
          { name: 'Required Permission', value: 'Administrator', inline: true },
          { name: 'Your Permissions', value: 'Insufficient', inline: true }
        )
        .setTimestamp();
      
      return await interaction.editReply({ embeds: [embed] });
    }

    // Check if guild is authorized (if using strict authorization)
    if (!isAuthorizedGuild(interaction.guildId)) {
      return await sendUnauthorizedGuildMessage(interaction);
    }

    const secretKey = interaction.options.getString('secret_key');
    const guildId = interaction.guildId;
    const guildName = interaction.guild.name;
    const userId = interaction.user.id;

    try {
      // Check if this guild is already linked to a store
      const [existingLinks] = await pool.query(
        'SELECT dl.*, s.store_name, s.store_url FROM discord_links dl JOIN stores s ON dl.store_id = s.id WHERE dl.discord_guild_id = ? AND dl.is_active = TRUE',
        [guildId]
      );

      if (existingLinks.length > 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('❌ Already Linked')
          .setDescription(`This Discord server is already linked to **${existingLinks[0].store_name}**`)
          .addFields(
            { name: 'Store URL', value: existingLinks[0].store_url, inline: false },
            { name: 'Linked At', value: `<t:${Math.floor(new Date(existingLinks[0].linked_at).getTime() / 1000)}:R>`, inline: true },
            { name: 'Note', value: 'Only server administrators can manage Discord store links.', inline: false }
          )
          .setTimestamp();
        
        return await interaction.editReply({ embeds: [embed] });
      }

      // Verify the secret key
      const [pendingStores] = await pool.query(
        'SELECT * FROM pending_stores WHERE secret_key = ? AND is_used = FALSE AND expires_at > NOW()',
        [secretKey]
      );

      if (pendingStores.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('❌ Invalid Secret Key')
          .setDescription('The secret key you provided is invalid, expired, or has already been used.')
          .addFields(
            { name: 'Troubleshooting', value: '• Make sure you copied the key correctly\n• Check that the key hasn\'t expired (10 minutes)\n• Ensure the key hasn\'t been used before', inline: false }
          )
          .setTimestamp();
        
        return await interaction.editReply({ embeds: [embed] });
      }

      const pendingStore = pendingStores[0];

      // Begin transaction
      await pool.query('START TRANSACTION');

      try {
        // Create the store record
        const [storeResult] = await pool.query(
          'INSERT INTO stores (store_name, store_url, owner_email) VALUES (?, ?, ?)',
          [pendingStore.store_name, pendingStore.store_url, pendingStore.owner_email]
        );

        const storeId = storeResult.insertId;

        // Create the Discord link
        await pool.query(
          'INSERT INTO discord_links (store_id, discord_guild_id, discord_guild_name, linked_by_user_id) VALUES (?, ?, ?, ?)',
          [storeId, guildId, guildName, userId]
        );

        // Mark the pending store as used
        await pool.query(
          'UPDATE pending_stores SET is_used = TRUE WHERE id = ?',
          [pendingStore.id]
        );

        // Commit transaction
        await pool.query('COMMIT');

        const embed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('✅ Successfully Linked!')
          .setDescription(`Your Discord server has been successfully linked to **${pendingStore.store_name}**`)
          .addFields(
            { name: 'Store Name', value: pendingStore.store_name, inline: true },
            { name: 'Store URL', value: pendingStore.store_url, inline: true },
            { name: 'Linked By', value: `<@${userId}> (Admin)`, inline: true },
            { name: 'Linked At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setFooter({ text: 'Your store is now connected and ready to use! Only admins can manage this link.' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

      } catch (error) {
        // Rollback transaction on error
        await pool.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('Error in nivaro-link command:', error);
      
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('❌ Error')
        .setDescription('An error occurred while linking your store. Please try again later.')
        .addFields(
          { name: 'Error Details', value: 'If this problem persists, please contact support.', inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
}; 