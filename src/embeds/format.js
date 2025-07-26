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

function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

module.exports = { orangeEmbed, errorEmbed, successEmbed }; 