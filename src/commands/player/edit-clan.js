const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const { 
  getPlayerByDiscordId, 
  getPlayerClan,
  getClanByServerAndName,
  getClanByServerAndTag,
  isPlayerClanOwner,
  getClanColorByEmoji,
  getEmojiByClanColor
} = require('../../utils/clanSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-clan')
    .setDescription('Edit your clan details (only clan owner/co-owner can do this)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server your clan is on')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('new_clan_name')
        .setDescription('New name for your clan')
        .setRequired(false)
        .setMaxLength(50))
    .addStringOption(option =>
      option.setName('new_tag')
        .setDescription('New tag for your clan (4 characters)')
        .setRequired(false)
        .setMaxLength(4)
        .setMinLength(4))
    .addStringOption(option =>
      option.setName('new_color')
        .setDescription('New color for your clan')
        .setRequired(false)
        .addChoices(
          { name: '🔴 Red', value: '🔴' },
          { name: '🔵 Blue', value: '🔵' },
          { name: '🟢 Green', value: '🟢' },
          { name: '🟡 Yellow', value: '🟡' },
          { name: '🟣 Purple', value: '🟣' },
          { name: '🟠 Orange', value: '🟠' },
          { name: '🔷 Cyan', value: '🔷' },
          { name: '💖 Pink', value: '💖' },
          { name: '🟦 Teal', value: '🟦' },
          { name: '🟩 Lime', value: '🟩' },
          { name: '💜 Magenta', value: '💜' },
          { name: '⚪ White', value: '⚪' }
        )),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [servers] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ?',
        [guildId, `%${focusedValue}%`]
      );

      await interaction.respond(
        servers.map(server => ({ name: server.nickname, value: server.nickname }))
      );
    } catch (error) {
      console.error('Edit clan autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');
    const newClanName = interaction.options.getString('new_clan_name');
    const newTag = interaction.options.getString('new_tag')?.toUpperCase();
    const newColorEmoji = interaction.options.getString('new_color');

    try {
      // Get server
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      // Check if clan system is enabled
      const [settings] = await pool.query(
        'SELECT enabled FROM clan_settings WHERE server_id = ?',
        [server.id]
      );
      
      if (!settings.length || !settings[0].enabled) {
        return interaction.editReply({
          embeds: [errorEmbed('Clan System Disabled', 'The clan system is not enabled on this server.')]
        });
      }

      // Get player
      const player = await getPlayerByDiscordId(userId, server.id);
      if (!player) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not Found', 'You need to be linked to use clan commands.')]
        });
      }

      // Get player's clan
      const clan = await getPlayerClan(player.id, server.id);
      if (!clan) {
        return interaction.editReply({
          embeds: [errorEmbed('Not in Clan', 'You are not a member of any clan on this server.')]
        });
      }

      // Check if player is clan owner or co-owner
      const isOwner = await isPlayerClanOwner(player.id, clan.id);
      if (!isOwner) {
        return interaction.editReply({
          embeds: [errorEmbed('Permission Denied', `Only the clan owner or co-owner can edit **${clan.name}**.`)]
        });
      }

      // Check if at least one field is provided
      if (!newClanName && !newTag && !newColorEmoji) {
        return interaction.editReply({
          embeds: [errorEmbed('No Changes', 'Please provide at least one field to update (clan name, tag, or color).')]
        });
      }

      let updates = [];
      let updateValues = [];

      // Check new clan name
      if (newClanName && newClanName !== clan.name) {
        const existingClanByName = await getClanByServerAndName(server.id, newClanName);
        if (existingClanByName) {
          return interaction.editReply({
            embeds: [errorEmbed('Clan Name Taken', `A clan with the name **${newClanName}** already exists on this server.`)]
          });
        }
        updates.push('name = ?');
        updateValues.push(newClanName);
      }

      // Check new tag
      if (newTag && newTag !== clan.tag) {
        const existingClanByTag = await getClanByServerAndTag(server.id, newTag);
        if (existingClanByTag) {
          return interaction.editReply({
            embeds: [errorEmbed('Clan Tag Taken', `A clan with the tag **[${newTag}]** already exists on this server.`)]
          });
        }
        updates.push('tag = ?');
        updateValues.push(newTag);
      }

      // Check new color
      if (newColorEmoji) {
        const newColorHex = getClanColorByEmoji(newColorEmoji);
        if (newColorHex !== clan.color) {
          updates.push('color = ?');
          updateValues.push(newColorHex);
        }
      }

      // If no actual changes, return
      if (updates.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Changes', 'The provided values are the same as current values. No changes made.')]
        });
      }

      // Update clan
      updateValues.push(clan.id);
      await pool.query(
        `UPDATE clans SET ${updates.join(', ')} WHERE id = ?`,
        updateValues
      );

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) edited clan "${clan.name}" on ${server.nickname}`);

      // Get updated clan info
      const [updatedClan] = await pool.query('SELECT * FROM clans WHERE id = ?', [clan.id]);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('✏️ **CLAN EDITED SUCCESSFULLY** ✏️')
        .setDescription(`**${updatedClan[0].name}** has been updated on **${server.nickname}**!`)
        .addFields(
          { name: '🏷️ **Tag**', value: `**[${updatedClan[0].tag}]**`, inline: true },
          { name: '🎨 **Color**', value: `${getEmojiByClanColor(updatedClan[0].color)} ${updatedClan[0].color}`, inline: true },
          { name: '👑 **Edited By**', value: `${interaction.user.tag}`, inline: true },
          { name: '📅 **Updated**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: '🏰 Zentro Clan System • Clan details updated' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Edit clan error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan Edit Failed', `Failed to edit clan. Error: ${err.message}`)]
      });
    }
  }
}; 