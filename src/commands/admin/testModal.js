const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testmodal')
    .setDescription('Test modal functionality'),

  async execute(interaction) {
    console.log('[TESTMODAL] Command executed');
    
    const modal = new ModalBuilder()
      .setCustomId('test_slash_modal')
      .setTitle('Test Slash Modal');

    const input = new TextInputBuilder()
      .setCustomId('test_input')
      .setLabel('Test Input')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    console.log('[TESTMODAL] About to show modal...');
    await interaction.showModal(modal);
    console.log('[TESTMODAL] Modal shown successfully');
  },
};
