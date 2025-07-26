const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('@discordjs/builders');
const pool = require('../../db');
const { orangeEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('open-shop')
    .setDescription('Open the shop for a server')
    .addStringOption(opt => 
      opt.setName('server')
        .setDescription('Select server')
        .setRequired(true)
        .setAutocomplete(true)
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
    
    try {
      // Get server and categories
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
      const categoriesResult = await pool.query(
        'SELECT id, name, type FROM shop_categories WHERE server_id = $1',
        [serverId]
      );
      
      if (categoriesResult.rows.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('Shop', 'No categories available for this server.')]
        });
      }
      
      // Create dropdown menu
      const row = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`shop_${serverId}`)
            .setPlaceholder('Select a category')
            .addOptions(
              categoriesResult.rows.map(cat => ({
                label: cat.name,
                description: `Type: ${cat.type}`,
                value: cat.id.toString()
              }))
            )
        );
      
      await interaction.editReply({
        embeds: [orangeEmbed('Shop', `Select a category from **${serverNickname}**'s shop:`)],
        components: [row]
      });
      
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [orangeEmbed('Error', 'Failed to open shop.')]
      });
    }
  }
}; 