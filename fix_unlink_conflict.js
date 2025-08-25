const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing merge conflict in unlink.js');
console.log('====================================\n');

const unlinkPath = path.join(__dirname, 'src/commands/admin/unlink.js');

// Clean version of unlink.js without merge conflict markers
const cleanUnlinkContent = `const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');
const { normalizeDiscordId, compareDiscordIds, normalizeIgnForComparison } = require('../../utils/linking');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player from all servers (Admin only)')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Discord ID or in-game name of the player to unlink')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const identifier = interaction.options.getString('name').trim();

    // Validate input
    if (!identifier || identifier.length < 2) {
      return await interaction.editReply({
        embeds: [errorEmbed('Invalid Input', 'Please provide a valid Discord ID or in-game name (at least 2 characters).')]
      });
    }

    try {
      // Check if identifier is a Discord ID (numeric)
      const isDiscordId = /^\\d+$/.test(identifier);
      const normalizedDiscordId = isDiscordId ? normalizeDiscordId(identifier) : null;
      
      let result;
      let playerInfo = [];
      
      if (isDiscordId) {
        // ✅ Unlink by Discord ID - MARK AS INACTIVE (not delete) - UNIVERSAL
        const [players] = await pool.query(
          \`SELECT p.*, rs.nickname, g.name as guild_name
           FROM players p
           JOIN rust_servers rs ON p.server_id = rs.id
           JOIN guilds g ON p.guild_id = g.id
           WHERE p.discord_id = ? 
           AND p.is_active = true\`,
          [normalizedDiscordId]
        );
        
        if (players.length === 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('No Players Found', \`❌ No active players found with Discord ID **\${identifier}** across all servers.\\n\\nMake sure you're using the correct Discord ID.\`)]
          });
        }
        
        // Store player info before deactivation
        playerInfo = players.map(p => {
          console.log(\`[UNLINK DEBUG] Player data:\`, p);
          return \`\${p.ign || 'Unknown'} (\${p.nickname || 'Unknown'} - \${p.guild_name || 'Unknown'})\`;
        });
        
        // ✅ Mark all player records as inactive for this Discord ID - UNIVERSAL
        const [updateResult] = await pool.query(
          \`UPDATE players 
           SET is_active = false, unlinked_at = CURRENT_TIMESTAMP
           WHERE discord_id = ? 
           AND is_active = true\`,
          [normalizedDiscordId]
        );
        
        result = { rowCount: updateResult.affectedRows };
      } else {
        // ✅ NORMALIZE IGN: use utility function for proper handling
        const normalizedIgn = normalizeIgnForComparison(identifier);
        
        // ✅ Unlink by IGN - MARK AS INACTIVE (not delete) - case-insensitive - UNIVERSAL
        const [players] = await pool.query(
          \`SELECT p.*, rs.nickname, g.name as guild_name
           FROM players p
           JOIN rust_servers rs ON p.server_id = rs.id
           JOIN guilds g ON p.guild_id = g.id
           WHERE LOWER(p.ign) = LOWER(?) 
           AND p.is_active = true\`,
          [normalizedIgn]
        );
        
        if (players.length === 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('No Players Found', \`❌ No active players found with in-game name **\${identifier}** across all servers.\\n\\nMake sure you're using the correct in-game name.\`)]
          });
        }
        
        // Store player info before deactivation
        playerInfo = players.map(p => {
          console.log(\`[UNLINK DEBUG] Player data:\`, p);
          return \`\${p.ign || 'Unknown'} (\${p.nickname || 'Unknown'} - \${p.guild_name || 'Unknown'})\`;
        });
        
        // ✅ Mark all player records as inactive for this IGN (case-insensitive) - UNIVERSAL
        const [updateResult] = await pool.query(
          \`UPDATE players 
           SET is_active = false, unlinked_at = CURRENT_TIMESTAMP
           WHERE LOWER(ign) = LOWER(?) 
           AND is_active = true\`,
          [normalizedIgn]
        );
        
        result = { rowCount: updateResult.affectedRows };
      }

      // Remove ZentroLinked role from the user if they were unlinked by Discord ID
      if (isDiscordId) {
        try {
          const guild = interaction.guild;
          const zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
          
          if (zentroLinkedRole) {
            const member = await guild.members.fetch(normalizedDiscordId);
            if (member && member.roles.cache.has(zentroLinkedRole.id)) {
              await member.roles.remove(zentroLinkedRole);
              console.log(\`[ROLE] Removed ZentroLinked role from user: \${member.user.username}\`);
            }
          }
        } catch (roleError) {
          console.log('Could not remove ZentroLinked role:', roleError.message);
        }
      }

      // Debug logging
      console.log(\`[UNLINK DEBUG] Identifier: \${identifier}\`);
      console.log(\`[UNLINK DEBUG] Is Discord ID: \${isDiscordId}\`);
      console.log(\`[UNLINK DEBUG] Player info array:\`, playerInfo);
      console.log(\`[UNLINK DEBUG] Result row count: \${result.rowCount}\`);

      // Ensure we have valid player info
      if (playerInfo.length === 0) {
        playerInfo = [\`Unknown player (\${identifier})\`];
      }

      // Extract just the player names for the success message
      const playerNames = playerInfo.map(info => {
        const match = info.match(/^([^(]+)/);
        const name = match ? match[1].trim() : info;
        console.log(\`[UNLINK DEBUG] Extracted name: "\${name}" from info: "\${info}"\`);
        return name;
      });

      const playerList = playerNames.join(', ');
      console.log(\`[UNLINK DEBUG] Final player list: "\${playerList}"\`);
      const embed = successEmbed(
        'Players Unlinked', 
        \`✅ Successfully unlinked **\${result.rowCount} player(s)** for **\${identifier}**.\\n\\n**Unlinked players:**\\n\${playerList}\\n\\n**Note:** Players have been marked as inactive and can now link again with new names.\`
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in unlink:', error);
      await interaction.editReply({ 
        embeds: [errorEmbed('Error', 'Failed to unlink player. Please try again.')] 
      });
    }
  }
};`;

try {
  // Write the clean version
  fs.writeFileSync(unlinkPath, cleanUnlinkContent);
  console.log('✅ Successfully wrote clean unlink.js file');
  console.log('✅ Removed all merge conflict markers');
  console.log('✅ Added debugging for null player name issue');
  
  console.log('\\n📋 Next steps:');
  console.log('1. Restart the bot: pm2 restart zentro-bot');
  console.log('2. Test the unlink command');
  console.log('3. Check logs for debugging output');
  
} catch (error) {
  console.error('❌ Error fixing unlink.js:', error);
}
