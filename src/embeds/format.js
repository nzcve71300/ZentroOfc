const { EmbedBuilder } = require('discord.js');
const ORANGE = 0xFFA500;

function orangeEmbed(title, description, fields = []) {
  return new EmbedBuilder()
    .setColor(ORANGE)
    .setTitle(`**${title}**`)
    .setDescription(description)
    .addFields(fields)
    .setTimestamp();
}

module.exports = { orangeEmbed }; 