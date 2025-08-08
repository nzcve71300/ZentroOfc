const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servers-leaderboard')
    .setDescription('Set the channel for weekly servers leaderboard (Owner only)')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The channel to send the weekly leaderboard')
        .setRequired(true)
    ),

  async execute(interaction) {
    // Check if user is the owner (your user ID)
    const OWNER_ID = '1252993829007528086';
    
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: '❌ Only the bot owner can use this command.',
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guild.id;

    try {
      // Check if guild exists in database
      const [guildResult] = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [guildId]
      );

      if (guildResult.length === 0) {
        return interaction.reply({
          content: '❌ This guild is not set up in the database.',
          ephemeral: true
        });
      }

      const guildDbId = guildResult[0].id;

      // Check if leaderboard setting already exists
      const [existingResult] = await pool.query(
        'SELECT * FROM leaderboard_settings WHERE guild_id = ?',
        [guildDbId]
      );

      if (existingResult.length > 0) {
        // Update existing setting
        await pool.query(
          'UPDATE leaderboard_settings SET channel_id = ?, updated_at = NOW() WHERE guild_id = ?',
          [channel.id, guildDbId]
        );
      } else {
        // Create new setting
        await pool.query(
          'INSERT INTO leaderboard_settings (guild_id, channel_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
          [guildDbId, channel.id]
        );
      }

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Servers Leaderboard Channel Set')
        .setDescription(`The weekly servers leaderboard will now be sent to <#${channel.id}>`)
        .addFields(
          { name: 'Channel', value: `<#${channel.id}>`, inline: true },
          { name: 'Guild', value: interaction.guild.name, inline: true },
          { name: 'Next Update', value: 'Every Sunday at 12:00 PM UTC', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error setting leaderboard channel:', error);
      await interaction.reply({
        content: '❌ An error occurred while setting the leaderboard channel.',
        ephemeral: true
      });
    }
  },
}; 