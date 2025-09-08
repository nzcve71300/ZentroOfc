const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getServerByNickname, getServersForGuild, getActivePlayerByDiscordId, getPlayerBalance, updatePlayerBalance, recordTransaction, ensureEconomyRecord } = require('../../utils/unifiedPlayerSystem');
const { errorEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('swap')
    .setDescription('Swap currencies between servers'),

  async execute(interaction) {
    try {
      const guildId = interaction.guildId;
      const userId = interaction.user.id;

      // Get all servers for this guild
      const servers = await getServersForGuild(guildId);
      
      // Check if guild has more than one server
      if (servers.length < 2) {
        return interaction.reply({
          embeds: [errorEmbed(
            'Swap Not Available',
            'You need at least 2 servers to use the swap feature.'
          )],
          ephemeral: true
        });
      }

      // Check if user is linked on at least one server
      let linkedServers = [];
      for (const server of servers) {
        const player = await getActivePlayerByDiscordId(guildId, server.id, userId);
        if (player) {
          const balance = await getPlayerBalance(player.id);
          if (balance > 0) {
            linkedServers.push({
              ...server,
              player,
              balance
            });
          }
        }
      }

      if (linkedServers.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed(
            'No Currency Found',
            'You need to have currency on at least one server to use the swap feature.\n\nMake sure you are linked and have currency on any server.'
          )],
          ephemeral: true
        });
      }

      // Create dropdown options for source server
      const sourceOptions = linkedServers.map(server => ({
        label: `${server.nickname} (${server.balance} currency)`,
        description: `Transfer FROM ${server.nickname}`,
        value: server.id
      }));

      // Create dropdown options for destination server
      const destinationOptions = servers.map(server => ({
        label: server.nickname,
        description: `Transfer TO ${server.nickname}`,
        value: server.id
      }));

      // Create the dropdowns
      const sourceRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('swap_source')
            .setPlaceholder('Choose source server')
            .addOptions(sourceOptions)
        );

      const destinationRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('swap_destination')
            .setPlaceholder('Choose destination server')
            .addOptions(destinationOptions)
        );

      const confirmRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('swap_confirm')
            .setLabel('Confirm Swap')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );

      const embed = {
        color: 0x0099FF,
        title: '🔄 Server Currency Swap',
        description: 'Select source and destination servers to swap your currency between them.',
        fields: [
          {
            name: '📤 Source Server',
            value: 'Choose the server to transfer currency FROM',
            inline: true
          },
          {
            name: '📥 Destination Server',
            value: 'Choose the server to transfer currency TO',
            inline: true
          }
        ],
        footer: {
          text: 'You can only swap between different servers'
        }
      };

      const response = await interaction.reply({
        embeds: [embed],
        components: [sourceRow, destinationRow, confirmRow],
        ephemeral: true
      });

      // Create collector for button interactions
      const collector = response.createMessageComponentCollector({
        time: 300000 // 5 minutes
      });

      let selectedSource = null;
      let selectedDestination = null;

      collector.on('collect', async (i) => {
        if (i.user.id !== userId) {
          return i.reply({ content: 'This swap menu is not for you.', ephemeral: true });
        }

        if (i.customId === 'swap_source') {
          selectedSource = i.values[0];
          
          // Update destination options to exclude source
          const filteredDestOptions = destinationOptions.filter(option => option.value !== selectedSource);
          
          const newDestinationRow = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('swap_destination')
                .setPlaceholder('Choose destination server')
                .addOptions(filteredDestOptions)
            );

          // Enable confirm button if both are selected
          const newConfirmRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('swap_confirm')
                .setLabel('Confirm Swap')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!selectedDestination)
            );

          await i.update({
            components: [sourceRow, newDestinationRow, newConfirmRow]
          });

        } else if (i.customId === 'swap_destination') {
          selectedDestination = i.values[0];
          
          // Enable confirm button if both are selected
          const newConfirmRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('swap_confirm')
                .setLabel('Confirm Swap')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!selectedSource)
            );

          await i.update({
            components: [sourceRow, destinationRow, newConfirmRow]
          });

        } else if (i.customId === 'swap_confirm') {
          if (!selectedSource || !selectedDestination) {
            return i.reply({
              content: 'Please select both source and destination servers.',
              ephemeral: true
            });
          }

          if (selectedSource === selectedDestination) {
            return i.reply({
              content: 'You cannot swap to the same server.',
              ephemeral: true
            });
          }

          // Perform the swap
          try {
            // Get source player and balance
            const sourcePlayer = await getActivePlayerByDiscordId(guildId, selectedSource, userId);
            
            // Ensure economy record exists for source player
            await ensureEconomyRecord(sourcePlayer.id, sourcePlayer.guild_id);
            
            const sourceBalance = await getPlayerBalance(sourcePlayer.id);

            if (sourceBalance <= 0) {
              return i.reply({
                content: 'You have no currency to swap on the source server.',
                ephemeral: true
              });
            }

            // Get or create destination player
            let destinationPlayer = await getActivePlayerByDiscordId(guildId, selectedDestination, userId);
            if (!destinationPlayer) {
              // Create a new player record for destination server
              const { createOrUpdatePlayerLink } = require('../../utils/unifiedPlayerSystem');
              destinationPlayer = await createOrUpdatePlayerLink(guildId, selectedDestination, userId, sourcePlayer.ign);
            }

            // Ensure economy record exists for destination player
            await ensureEconomyRecord(destinationPlayer.id, destinationPlayer.guild_id);

            // Get server names for display
            const sourceServer = servers.find(s => s.id === selectedSource);
            const destServer = servers.find(s => s.id === selectedDestination);

            // Perform the transfer
            const newSourceBalance = await updatePlayerBalance(sourcePlayer.id, -sourceBalance);
            const newDestBalance = await updatePlayerBalance(destinationPlayer.id, sourceBalance);

            // Record transactions
            await recordTransaction(sourcePlayer.id, -sourceBalance, 'swap_sent');
            await recordTransaction(destinationPlayer.id, sourceBalance, 'swap_received');

            // Get currency names
            const { getCurrencyName } = require('../../utils/economy');
            const sourceCurrency = await getCurrencyName(selectedSource);
            const destCurrency = await getCurrencyName(selectedDestination);

            const successEmbed = {
              color: 0x00FF00,
              title: '🔄 Swap Successful',
              description: `Successfully swapped **${sourceBalance} ${sourceCurrency}** from **${sourceServer.nickname}** to **${destServer.nickname}**`,
              fields: [
                {
                  name: '📤 From',
                  value: `**${sourceServer.nickname}**\nBalance: **${newSourceBalance} ${sourceCurrency}**`,
                  inline: true
                },
                {
                  name: '📥 To',
                  value: `**${destServer.nickname}**\nBalance: **${newDestBalance} ${destCurrency}**`,
                  inline: true
                }
              ],
              timestamp: new Date().toISOString()
            };

            await i.update({
              embeds: [successEmbed],
              components: []
            });

          } catch (error) {
            console.error('Error in swap:', error);
            await i.reply({
              content: `❌ Error during swap: ${error.message}`,
              ephemeral: true
            });
          }
        }
      });

      collector.on('end', () => {
        // Disable components after timeout
        const disabledRows = [
          new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('swap_source')
                .setPlaceholder('Choose source server')
                .addOptions(sourceOptions)
                .setDisabled(true)
            ),
          new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('swap_destination')
                .setPlaceholder('Choose destination server')
                .addOptions(destinationOptions)
                .setDisabled(true)
            ),
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('swap_confirm')
                .setLabel('Confirm Swap')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            )
        ];

        interaction.editReply({
          components: disabledRows
        }).catch(() => {
          // Message might have been deleted or already updated
        });
      });

    } catch (error) {
      console.error('Error in swap command:', error);
      await interaction.reply({
        embeds: [errorEmbed('Swap Error', `An error occurred: ${error.message}`)],
        ephemeral: true
      });
    }
  }
};
