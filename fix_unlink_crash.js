const fs = require('fs');
const path = require('path');

const cleanUnlinkContent = `const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');
const { getServerByNickname, getServersForGuild } = require('../../utils/unifiedPlayerSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player from Discord')
    .addStringOption(option =>
      option.setName('identifier')
        .setDescription('Player name or Discord ID')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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
    try {
      const searchTerm = interaction.options.getString('identifier');
      const serverOption = interaction.options.getString('server');
      const guildId = interaction.guildId;
      
      console.log(\`[UNLINK] Attempting to unlink: \${searchTerm} from server: \${serverOption} in guild: \${guildId}\`);

      // Get server using shared helper
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.reply({
          content: \`❌ Server not found: \${serverOption}\`,
          ephemeral: true
        });
      }

      // Get database connection
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      let player = null;
      let searchMethod = '';

      // First, try to search by Discord ID
      try {
        const [rows] = await connection.execute(\`
          SELECT p.*, rs.nickname as server_name
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          WHERE p.discord_id = ? AND p.server_id = ? AND p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
        \`, [searchTerm, server.id, guildId]);

        if (rows.length > 0) {
          player = rows[0];
          searchMethod = 'Discord ID';
          console.log(\`[UNLINK] Found player by Discord ID: \${player.ign} on \${player.server_name}\`);
        }
      } catch (error) {
        console.error('[UNLINK] Error searching by Discord ID:', error);
      }

      // If not found by Discord ID, try searching by IGN
      if (!player) {
        try {
          const [rows] = await connection.execute(\`
            SELECT p.*, rs.nickname as server_name
            FROM players p
            JOIN rust_servers rs ON p.server_id = rs.id
            WHERE p.ign = ? AND p.server_id = ? AND p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
          \`, [searchTerm, server.id, guildId]);

          if (rows.length > 0) {
            player = rows[0];
            searchMethod = 'IGN';
            console.log(\`[UNLINK] Found player by IGN: \${player.ign} on \${player.server_name}\`);
          }
        } catch (error) {
          console.error('[UNLINK] Error searching by IGN:', error);
        }
      }

      if (!player) {
        await interaction.reply({
          content: \`❌ Player not found: \${searchTerm}\\n⚠️ Not found on: \${server.nickname}\`,
          ephemeral: true
        });
        await connection.end();
        return;
      }

      // Check if player is already unlinked
      if (!player.discord_id) {
        await interaction.reply({
          content: \`⚠️ Player \${player.ign || 'Unknown'} is already unlinked on \${server.nickname}!\`,
          ephemeral: true
        });
        await connection.end();
        return;
      }

      // Update the player record
      try {
        await connection.execute(\`
          UPDATE players 
          SET discord_id = NULL, unlinked_at = NOW(), is_active = false
          WHERE id = ? AND server_id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
        \`, [player.id, server.id, guildId]);

        console.log(\`[UNLINK] Successfully unlinked player: \${player.ign} (ID: \${player.id}) from \${server.nickname}\`);

        // Create success message
        const playerName = player.ign || 'Unknown';
        const discordId = player.discord_id || 'Unknown';
        
        const successMessage = \`✅ Unlink Complete\\n\\n**\${playerName}** has been unlinked from **\${server.nickname}**!\\n\\n**Details:**\\n• **Player:** \${playerName}\\n• **Discord ID:** \${discordId}\\n• **Server:** \${server.nickname}\\n• **Found by:** \${searchMethod}\`;

        await interaction.reply({
          content: successMessage,
          ephemeral: true
        });

      } catch (error) {
        console.error('[UNLINK] Error updating player:', error);
        await interaction.reply({
          content: \`❌ Error unlinking player: \${error.message}\`,
          ephemeral: true
        });
      }

      await connection.end();

    } catch (error) {
      console.error('[UNLINK] Unexpected error:', error);
      await interaction.reply({
        content: \`❌ Unexpected error: \${error.message}\`,
        ephemeral: true
      });
    }
  }
};
`;

// Write the clean content to the file
const filePath = path.join(__dirname, 'src', 'commands', 'admin', 'unlink.js');

try {
  fs.writeFileSync(filePath, cleanUnlinkContent, 'utf8');
  console.log('✅ Successfully overwrote unlink.js with server-specific version');
  console.log('📁 File path:', filePath);
} catch (error) {
  console.error('❌ Error writing file:', error);
}
