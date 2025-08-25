const fs = require('fs');
const path = require('path');

const cleanUnlinkContent = `const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player from Discord')
    .addStringOption(option =>
      option.setName('identifier')
        .setDescription('Player name or Discord ID')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const searchTerm = interaction.options.getString('identifier');
      console.log(\`[UNLINK] Attempting to unlink: \${searchTerm} from guild: \${interaction.guildId}\`);

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
          SELECT p.*, rs.nickname as server_name, g.discord_id as guild_discord_id
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          JOIN guilds g ON rs.guild_id = g.id
          WHERE p.discord_id = ? AND g.discord_id = ?
        \`, [searchTerm, interaction.guildId]);

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
            SELECT p.*, rs.nickname as server_name, g.discord_id as guild_discord_id
            FROM players p
            JOIN rust_servers rs ON p.server_id = rs.id
            JOIN guilds g ON rs.guild_id = g.id
            WHERE p.ign = ? AND g.discord_id = ?
          \`, [searchTerm, interaction.guildId]);

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
          content: \`❌ Player not found: \${searchTerm}\\n⚠️ Not found on: \${interaction.guild?.name || 'Unknown Server'}\`,
          ephemeral: true
        });
        await connection.end();
        return;
      }

      // Check if player is already unlinked
      if (!player.discord_id) {
        await interaction.reply({
          content: \`⚠️ Player \${player.ign || 'Unknown'} is already unlinked!\`,
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
          WHERE id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
        \`, [player.id, interaction.guildId]);

        console.log(\`[UNLINK] Successfully unlinked player: \${player.ign} (ID: \${player.id})\`);

        // Create success message
        const playerName = player.ign || 'Unknown';
        const serverName = player.server_name || 'Unknown Server';
        const discordId = player.discord_id || 'Unknown';
        
        const successMessage = \`✅ Unlink Complete\\n\\n**\${playerName}** has been unlinked!\\n\\n**Details:**\\n• **Player:** \${playerName}\\n• **Discord ID:** \${discordId}\\n• **Server:** \${serverName}\\n• **Found by:** \${searchMethod}\`;

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
  console.log('✅ Successfully overwrote unlink.js with clean version');
  console.log('📁 File path:', filePath);
} catch (error) {
  console.error('❌ Error writing file:', error);
}
