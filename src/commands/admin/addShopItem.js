const { SlashCommandBuilder } = require('@discordjs/builders');
const pool = require('../../db');
const { orangeEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-shop-item')
    .setDescription('Add a shop item')
    .addStringOption(opt => 
      opt.setName('server')
        .setDescription('Select server')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt => 
      opt.setName('category')
        .setDescription('Select category')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt => 
      opt.setName('display_name')
        .setDescription('Display name for the item')
        .setRequired(true)
    )
    .addStringOption(opt => 
      opt.setName('short_name')
        .setDescription('Item short name (for inventory.giveto)')
        .setRequired(true)
    )
    .addIntegerOption(opt => 
      opt.setName('price')
        .setDescription('Item price in coins')
        .setRequired(true)
    )
    .addIntegerOption(opt => 
      opt.setName('quantity')
        .setDescription('Quantity to give')
        .setRequired(true)
    )
    .addIntegerOption(opt => 
      opt.setName('timer')
        .setDescription('Cooldown timer in minutes (optional)')
        .setRequired(false)
    ),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      if (focusedOption.name === 'server') {
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
      } else if (focusedOption.name === 'category') {
        const serverNickname = interaction.options.getString('server');
        if (!serverNickname) {
          await interaction.respond([]);
          return;
        }
        
        const result = await pool.query(
          `SELECT sc.name FROM shop_categories sc 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
           AND rs.nickname = $2 
           AND (sc.type = 'items' OR sc.type = 'both')`,
          [guildId, serverNickname]
        );
        
        const choices = result.rows.map(row => ({
          name: row.name,
          value: row.name
        }));
        
        const filtered = choices.filter(choice => 
          choice.name.toLowerCase().includes(focusedValue.toLowerCase())
        );
        
        await interaction.respond(filtered.slice(0, 25));
      }
    } catch (error) {
      console.error(error);
      await interaction.respond([]);
    }
  },
  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const serverNickname = interaction.options.getString('server');
    const categoryName = interaction.options.getString('category');
    const displayName = interaction.options.getString('display_name');
    const shortName = interaction.options.getString('short_name');
    const price = interaction.options.getInteger('price');
    const quantity = interaction.options.getInteger('quantity');
    const timer = interaction.options.getInteger('timer');
    
    try {
      // Get category ID
      const categoryResult = await pool.query(
        `SELECT sc.id FROM shop_categories sc 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
         AND rs.nickname = $2 
         AND sc.name = $3`,
        [guildId, serverNickname, categoryName]
      );
      
      if (categoryResult.rows.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('Error', 'Category not found.')]
        });
      }
      
      const categoryId = categoryResult.rows[0].id;
      
      // Insert item
      const result = await pool.query(
        'INSERT INTO shop_items (category_id, display_name, short_name, price, quantity, timer) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [categoryId, displayName, shortName, price, quantity, timer]
      );
      
      const item = result.rows[0];
      
      await interaction.editReply({
        embeds: [orangeEmbed('Item Added', `**${displayName}** has been added to **${categoryName}** in **${serverNickname}**'s shop.`, [
          { name: 'Display Name', value: displayName, inline: true },
          { name: 'Short Name', value: shortName, inline: true },
          { name: 'Price', value: `${price} coins`, inline: true },
          { name: 'Quantity', value: quantity.toString(), inline: true },
          { name: 'Timer', value: timer ? `${timer} minutes` : 'None', inline: true }
        ])]
      });
      
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [orangeEmbed('Error', 'Failed to add item. It may already exist or there was a database error.')]
      });
    }
  }
}; 