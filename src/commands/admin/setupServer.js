const { SlashCommandBuilder } = require('@discordjs/builders');
const pool = require('../../db');
const { orangeEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-server')
    .setDescription('Add a Rust server')
    .addStringOption(opt => opt.setName('nickname').setDescription('Server nickname').setRequired(true))
    .addStringOption(opt => opt.setName('ip').setDescription('Server IP').setRequired(true))
    .addIntegerOption(opt => opt.setName('port').setDescription('RCON Port').setRequired(true))
    .addStringOption(opt => opt.setName('password').setDescription('RCON Password').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const nickname = interaction.options.getString('nickname');
    const ip = interaction.options.getString('ip');
    const port = interaction.options.getInteger('port');
    const password = interaction.options.getString('password');
    
    try {
      // Ensure guild exists in DB
      await pool.query(
        'INSERT INTO guilds (discord_id, name) VALUES ($1, $2) ON CONFLICT (discord_id) DO NOTHING',
        [guildId, interaction.guild.name]
      );
      
      // Insert server
      const result = await pool.query(
        'INSERT INTO rust_servers (guild_id, nickname, ip, port, password) VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4, $5) RETURNING *',
        [guildId, nickname, ip, port, password]
      );
      
      const server = result.rows[0];
      
      await interaction.editReply({
        embeds: [orangeEmbed('Server Added', `**${nickname}** (${ip}:${port}) has been added.`, [
          { name: 'Nickname', value: nickname, inline: true },
          { name: 'IP', value: ip, inline: true },
          { name: 'Port', value: port.toString(), inline: true }
        ])]
      });
      
    } catch (err) {
      console.error(err);
      await interaction.editReply({
        embeds: [orangeEmbed('Error', 'Failed to add server. It may already exist or there was a database error.')]
      });
    }
  }
}; 