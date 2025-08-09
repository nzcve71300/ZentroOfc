const fs = require('fs');
const path = require('path');

async function updateBotLinkingCode() {
  console.log('🔧 UPDATE BOT LINKING CODE');
  console.log('===========================\n');

  console.log('📋 Creating updated linking utility functions...');

  // Create new safe linking utility
  const safeLinkingUtilCode = `// Safe linking utilities using future-proof stored procedures
const pool = require('../db');

/**
 * Safely link a player using stored procedure
 */
async function linkPlayerSafely(guildId, serverId, discordId, ign) {
  try {
    const [result] = await pool.execute(
      'CALL LinkPlayerSafely(?, ?, ?, ?, @player_id, @success, @message)',
      [guildId, serverId, discordId, ign]
    );
    
    const [status] = await pool.execute('SELECT @player_id as player_id, @success as success, @message as message');
    const { player_id, success, message } = status[0];
    
    return {
      success: !!success,
      playerId: player_id,
      message: message
    };
  } catch (error) {
    console.error('Error in linkPlayerSafely:', error);
    return {
      success: false,
      playerId: 0,
      message: 'Database error occurred during linking'
    };
  }
}

/**
 * Safely unlink a player using stored procedure
 */
async function unlinkPlayerSafely(guildId, serverId, discordId) {
  try {
    await pool.execute(
      'CALL UnlinkPlayerSafely(?, ?, ?, @success, @message)',
      [guildId, serverId, discordId]
    );
    
    const [status] = await pool.execute('SELECT @success as success, @message as message');
    const { success, message } = status[0];
    
    return {
      success: !!success,
      message: message
    };
  } catch (error) {
    console.error('Error in unlinkPlayerSafely:', error);
    return {
      success: false,
      message: 'Database error occurred during unlinking'
    };
  }
}

/**
 * Get linked player info
 */
async function getLinkedPlayer(guildId, serverId, discordId) {
  try {
    const [players] = await pool.execute(
      \`SELECT p.*, e.balance 
       FROM players p 
       LEFT JOIN economy e ON p.id = e.player_id 
       WHERE p.guild_id = ? AND p.server_id = ? AND p.discord_id = ? AND p.is_active = 1\`,
      [guildId, serverId, discordId]
    );
    
    return players.length > 0 ? players[0] : null;
  } catch (error) {
    console.error('Error in getLinkedPlayer:', error);
    return null;
  }
}

/**
 * Get all linked players for a Discord user across all servers in a guild
 */
async function getAllLinkedPlayers(guildId, discordId) {
  try {
    const [players] = await pool.execute(
      \`SELECT p.*, rs.nickname as server_name, e.balance 
       FROM players p 
       JOIN rust_servers rs ON p.server_id = rs.id
       LEFT JOIN economy e ON p.id = e.player_id 
       WHERE p.guild_id = ? AND p.discord_id = ? AND p.is_active = 1\`,
      [guildId, discordId]
    );
    
    return players;
  } catch (error) {
    console.error('Error in getAllLinkedPlayers:', error);
    return [];
  }
}

/**
 * Check linking health for monitoring
 */
async function getLinkingHealth() {
  try {
    const [health] = await pool.execute('SELECT * FROM linking_health');
    return health;
  } catch (error) {
    console.error('Error in getLinkingHealth:', error);
    return [];
  }
}

module.exports = {
  linkPlayerSafely,
  unlinkPlayerSafely,
  getLinkedPlayer,
  getAllLinkedPlayers,
  getLinkingHealth
};
`;

  // Write the new utility file
  const utilPath = path.join(__dirname, 'src', 'utils', 'safeLinking.js');
  fs.writeFileSync(utilPath, safeLinkingUtilCode);
  console.log('✅ Created src/utils/safeLinking.js');

  // Create updated link command
  const updatedLinkCommandCode = `const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { linkPlayerSafely, getAllLinkedPlayers } = require('../../utils/safeLinking');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account with your in-game name')
    .addStringOption(opt =>
      opt.setName('in-game-name')
        .setDescription('Your in-game name')
        .setRequired(true)
    ),
    
  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
    const ign = interaction.options.getString('in-game-name');

    try {
      // Get all servers for this guild
      const [servers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guildId]
      );

      if (servers.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('No Server Found', 'No Rust server found for this Discord. Contact an admin.')]
        });
      }

      // Check existing links
      const existingLinks = await getAllLinkedPlayers(guildId, discordId);
      
      if (existingLinks.length > 0) {
        const differentIgn = existingLinks.find(link => link.ign.toLowerCase() !== ign.toLowerCase());
        if (differentIgn) {
          return await interaction.editReply({
            embeds: [orangeEmbed('Already Linked', \`You are already linked to a different IGN (\${differentIgn.ign}) on \${differentIgn.server_name}. Use /unlink first.\`)]
          });
        }
        
        const sameIgn = existingLinks.find(link => link.ign.toLowerCase() === ign.toLowerCase());
        if (sameIgn) {
          const serverList = existingLinks.map(p => p.server_name).join(', ');
          return await interaction.editReply({
            embeds: [orangeEmbed('Already Linked', \`You are already linked to **\${ign}** on: \${serverList}\`)]
          });
        }
      }

      // Show confirmation buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(\`link_confirm_\${discordId}_\${ign}\`)
          .setLabel(\`Link to \${ign}\`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('link_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [orangeEmbed('Confirm Link', \`Are you sure you want to link your Discord account to **\${ign}** across all servers?\`)],
        components: [row]
      });

    } catch (error) {
      console.error('Error in link command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'An error occurred while processing your link request.')]
      });
    }
  }
};
`;

  const linkCommandPath = path.join(__dirname, 'src', 'commands', 'player', 'link_updated.js');
  fs.writeFileSync(linkCommandPath, updatedLinkCommandCode);
  console.log('✅ Created updated link command: src/commands/player/link_updated.js');

  // Create updated interaction handler for link confirmation
  const updatedInteractionHandlerCode = `// Add this to your existing interactionCreate.js file

const { linkPlayerSafely } = require('../utils/safeLinking');

async function handleLinkConfirmUpdated(interaction) {
  await interaction.deferUpdate();
  
  try {
    const [, , discordId, ign] = interaction.customId.split('_');
    const guildId = interaction.guildId;
    
    // Get all servers for this guild
    const [servers] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
      [guildId]
    );
    
    if (servers.length === 0) {
      return await interaction.editReply({
        embeds: [errorEmbed('Error', 'No servers found for this guild.')],
        components: []
      });
    }
    
    const linkedServers = [];
    const failedServers = [];
    
    // Link to all servers using safe procedure
    for (const server of servers) {
      const result = await linkPlayerSafely(
        guildId,
        server.id, 
        discordId, 
        ign
      );
      
      if (result.success) {
        linkedServers.push(server.nickname);
      } else {
        failedServers.push({ server: server.nickname, error: result.message });
      }
    }
    
    let responseEmbed;
    if (linkedServers.length > 0 && failedServers.length === 0) {
      responseEmbed = successEmbed(
        'Successfully Linked!', 
        \`**\${ign}** has been linked to your Discord account across \${linkedServers.length} server(s): \${linkedServers.join(', ')}\`
      );
    } else if (linkedServers.length > 0) {
      responseEmbed = orangeEmbed(
        'Partially Linked', 
        \`**\${ign}** was linked to: \${linkedServers.join(', ')}\\n\\nFailed on: \${failedServers.map(f => f.server).join(', ')}\`
      );
    } else {
      responseEmbed = errorEmbed(
        'Link Failed', 
        \`Failed to link **\${ign}** to any servers. \${failedServers[0]?.error || 'Unknown error'}\`
      );
    }
    
    await interaction.editReply({
      embeds: [responseEmbed],
      components: []
    });
    
  } catch (error) {
    console.error('Error in handleLinkConfirmUpdated:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'An error occurred while linking your account.')],
      components: []
    });
  }
}

// Export this function to be used in your main interactionCreate.js
module.exports = { handleLinkConfirmUpdated };
`;

  const interactionHandlerPath = path.join(__dirname, 'src', 'utils', 'linkInteractionHandler.js');
  fs.writeFileSync(interactionHandlerPath, updatedInteractionHandlerCode);
  console.log('✅ Created updated interaction handler: src/utils/linkInteractionHandler.js');

  console.log('\n🎯 BOT CODE UPDATE COMPLETE!');
  console.log('✅ Created safe linking utilities');
  console.log('✅ Created updated link command');
  console.log('✅ Created updated interaction handler');
  
  console.log('\n📝 MANUAL STEPS NEEDED:');
  console.log('1. Replace src/commands/player/link.js with link_updated.js');
  console.log('2. Update src/events/interactionCreate.js to use handleLinkConfirmUpdated');
  console.log('3. Update other commands to use safeLinking utilities');
  console.log('4. Test the new linking system');
  
  console.log('\n🚀 BENEFITS:');
  console.log('• Database-level validation prevents bad data');
  console.log('• Automatic duplicate prevention');
  console.log('• Consistent error handling');
  console.log('• Future-proof for new servers');
  console.log('• Built-in monitoring and health checks');
}

updateBotLinkingCode();