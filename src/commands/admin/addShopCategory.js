const { SlashCommandBuilder } = require('@discordjs/builders');
const pool = require('../../db');
const { orangeEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-shop-category')
    .setDescription('Add a shop category')
    .addStringOption(opt => 
      opt.setName('server')
        .setDescription('Select server')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt => 
      opt.setName('name')
        .setDescription('Category name')
        .setRequired(true)
    )
    .addStringOption(opt => 
      opt.setName('type')
        .setDescription('Category type')
        .setRequired(true)
        .addChoices(
          { name: 'Items', value: 'items' },
          { name: 'Kits', value: 'kits' },
          { name: 'Both', value: 'both' }
        )
    )
    .addStringOption(opt => 
      opt.setName('role')
        .setDescription('Required role (optional)')
        .setRequired(false)
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
    const name = interaction.options.getString('name');
    const type = interaction.options.getString('type');
    const role = interaction.options.getString('role');
    
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
      
      // Insert category
      const result = await pool.query(
        'INSERT INTO shop_categories (server_id, name, type, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [serverId, name, type, role]
      );
      
      const category = result.rows[0];
      
      await interaction.editReply({
        embeds: [orangeEmbed('Category Added', `**${name}** has been added to **${serverNickname}**'s shop.`, [
          { name: 'Name', value: name, inline: true },
          { name: 'Type', value: type, inline: true },
          { name: 'Role', value: role || 'None', inline: true }
        ])]
      });
      
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [orangeEmbed('Error', 'Failed to add category. It may already exist.')]
      });
    }
  }
}; 