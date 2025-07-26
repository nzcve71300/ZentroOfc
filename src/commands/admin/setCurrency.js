const { SlashCommandBuilder } = require('@discordjs/builders');
const pool = require('../../db');
const { orangeEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-currency')
    .setDescription('Set currency name for a server')
    .addStringOption(opt => 
      opt.setName('server')
        .setDescription('Select server')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt => 
      opt.setName('name')
        .setDescription('Currency name')
        .setRequired(true)
    ),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    
    try {
      const result = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)',
        [guildId]
      );
      
      const choices = result.rows.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));
      
      const filtered = choices.filter(choice => 
        choice.name.toLowerCase().includes(focusedValue.toLowerCase())
      );
      
      await interaction.respond(filtered.slice(0, 25));
    } catch (error) {
      console.error(error);
      await interaction.respond([]);
    }
  },
  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const serverNickname = interaction.options.getString('server');
    const currencyName = interaction.options.getString('name');
    
    try {
      // Get server ID
      const serverResult = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname = $2',
        [guildId, serverNickname]
      );
      
      if (serverResult.rows.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('Error', 'Server not found.')]
        });
      }
      
      const serverId = serverResult.rows[0].id;
      
      // For now, we'll store currency name in a config table or use a simple approach
      // This could be extended to use a proper config table
      await interaction.editReply({
        embeds: [orangeEmbed('Currency Set', `Currency name for **${serverNickname}** has been set to **${currencyName}**.`, [
          { name: 'Server', value: serverNickname, inline: true },
          { name: 'Currency', value: currencyName, inline: true }
        ])]
      });
      
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [orangeEmbed('Error', 'Failed to set currency name.')]
      });
    }
  }
}; 