const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getServerByNickname, getServersForGuild, getActivePlayerByDiscordId, getPlayerBalance, updatePlayerBalance, recordTransaction } = require('../../utils/unifiedPlayerSystem');
const { errorEmbed, successEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transfer currency to another player')
    .addUserOption(option =>
      option.setName('player')
        .setDescription('Player to transfer currency to')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of currency to transfer')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    
    try {
      const servers = await getServersForGuild(guildId);
      const filtered = servers.filter(s => s.nickname.toLowerCase().includes(focusedValue.toLowerCase()));
      await interaction.respond(filtered.map(s => ({ name: s.nickname, value: s.nickname })));
    } catch (err) {
      console.error('Autocomplete error:', err);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const targetUser = interaction.options.getUser('player');
      const amount = interaction.options.getInteger('amount');
      const serverOption = interaction.options.getString('server');
      const guildId = interaction.guildId;
      const userId = interaction.user.id;

      // Prevent self-transfer
      if (targetUser.id === userId) {
        return interaction.editReply({
          embeds: [errorEmbed('Transfer Error', 'You cannot transfer currency to yourself.')]
        });
      }

      // Get server using shared helper
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server does not exist.')]
        });
      }

      // Get sender player
      const senderPlayer = await getActivePlayerByDiscordId(guildId, server.id, userId);
      if (!senderPlayer) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Account Not Linked',
            'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account.'
          )]
        });
      }

      // Get target player
      const targetPlayer = await getActivePlayerByDiscordId(guildId, server.id, targetUser.id);
      if (!targetPlayer) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Target Player Not Linked',
            `${targetUser.toString()} must link their Discord account to their in-game character first.\n\nThey need to use \`/link <in-game-name>\` to link their account.`
          )]
        });
      }

      // Check sender balance
      const senderBalance = await getPlayerBalance(senderPlayer.id);
      if (senderBalance < amount) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Insufficient Balance',
            `You only have **${senderBalance}** currency. You need **${amount}** to complete this transfer.`
          )]
        });
      }

      // Get currency name for this server
      const { getCurrencyName } = require('../../utils/economy');
      const currencyName = await getCurrencyName(server.id);

      // Perform the transfer
      const newSenderBalance = await updatePlayerBalance(senderPlayer.id, -amount);
      const newTargetBalance = await updatePlayerBalance(targetPlayer.id, amount);

      // Record transactions
      await recordTransaction(senderPlayer.id, -amount, 'transfer_sent');
      await recordTransaction(targetPlayer.id, amount, 'transfer_received');

      // Create success embed
      const successEmbed = {
        color: 0x00FF00,
        title: '💰 Transfer Successful',
        description: `Successfully transferred **${amount} ${currencyName}** to ${targetUser.toString()}`,
        fields: [
          {
            name: '📤 Sent From',
            value: `**${interaction.user.toString()}**\nBalance: **${newSenderBalance} ${currencyName}**`,
            inline: true
          },
          {
            name: '📥 Sent To',
            value: `**${targetUser.toString()}**\nBalance: **${newTargetBalance} ${currencyName}**`,
            inline: true
          },
          {
            name: '🏠 Server',
            value: `**${server.nickname}**`,
            inline: true
          }
        ],
        timestamp: new Date().toISOString()
      };

      await interaction.editReply({
        embeds: [successEmbed]
      });

      // Notify target player (if they're online)
      try {
        await targetUser.send({
          embeds: [{
            color: 0x00FF00,
            title: '💰 Currency Received',
            description: `You received **${amount} ${currencyName}** from ${interaction.user.toString()}`,
            fields: [
              {
                name: '🏠 Server',
                value: `**${server.nickname}**`,
                inline: true
              },
              {
                name: '💳 New Balance',
                value: `**${newTargetBalance} ${currencyName}**`,
                inline: true
              }
            ],
            timestamp: new Date().toISOString()
          }]
        });
      } catch (dmError) {
        // Target user has DMs disabled, that's okay
        console.log(`Could not DM transfer notification to ${targetUser.tag}`);
      }

    } catch (error) {
      console.error('Error in transfer command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Transfer Error', `An error occurred: ${error.message}`)]
      });
    }
  }
};
