// Test the interaction handling logic
const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// Test the customId parsing logic
function testCustomIdParsing() {
  console.log('Testing customId parsing...');
  
  // Test position_select parsing
  const positionSelectId = 'position_select_123';
  const serverId = positionSelectId.split('_')[2];
  console.log('Position select ID:', positionSelectId);
  console.log('Extracted server ID:', serverId);
  
  // Test position_modal parsing
  const positionModalId = 'position_modal_123_outpost';
  const [, , modalServerId, positionType] = positionModalId.split('_');
  console.log('Position modal ID:', positionModalId);
  console.log('Extracted server ID:', modalServerId);
  console.log('Extracted position type:', positionType);
  
  // Test modal creation
  try {
    const modal = new ModalBuilder()
      .setCustomId(`position_modal_${serverId}_outpost`)
      .setTitle('Outpost Coordinates');
    
    const xInput = new TextInputBuilder()
      .setCustomId('x_position')
      .setLabel('X Position')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter X coordinate')
      .setValue('100.5')
      .setRequired(true);
    
    const yInput = new TextInputBuilder()
      .setCustomId('y_position')
      .setLabel('Y Position')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter Y coordinate')
      .setValue('200.3')
      .setRequired(true);
    
    const zInput = new TextInputBuilder()
      .setCustomId('z_position')
      .setLabel('Z Position')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter Z coordinate')
      .setValue('300.7')
      .setRequired(true);
    
    const firstActionRow = new ActionRowBuilder().addComponents(xInput);
    const secondActionRow = new ActionRowBuilder().addComponents(yInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(zInput);
    
    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
    
    console.log('✅ Modal creation successful');
    console.log('Modal customId:', modal.data.custom_id);
    console.log('Modal title:', modal.data.title);
    console.log('Modal components count:', modal.data.components.length);
    
  } catch (error) {
    console.error('❌ Modal creation failed:', error);
  }
  
  // Test coordinate validation
  console.log('\nTesting coordinate validation...');
  const testCoords = ['100.5', '200.3', '300.7', 'invalid', '123', '456.789'];
  
  testCoords.forEach((coord, index) => {
    const num = parseFloat(coord);
    const isValid = !isNaN(num);
    console.log(`Coordinate ${index + 1}: "${coord}" -> ${isValid ? 'valid' : 'invalid'} (${num})`);
  });
}

testCustomIdParsing(); 