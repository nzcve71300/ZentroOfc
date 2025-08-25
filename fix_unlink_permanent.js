const fs = require('fs');
const path = require('path');

const cleanUnlinkContent = `const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player from Discord')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to unlink (mention)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Player name or Discord ID to unlink')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const mentionedUser = interaction.options.getUser('user');
      const input = interaction.options.getString('name');
      
      let searchTerm;
      
      if (mentionedUser) {
        searchTerm = mentionedUser.id;
      } else if (input) {
        // Remove mention format if present
        searchTerm = input.replace(/<@!?(\d+)>/g, '$1').trim();
      } else {
        return await interaction.reply({
          content: '❌ Please provide either a user mention or a player name/Discord ID.',
          ephemeral: true
        });
      }

      if (!searchTerm) {
        return await interaction.reply({
          content: '❌ Invalid input provided.',
          ephemeral: true
        });
      }

      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      // Check if it's a Discord ID (numeric)
      const isDiscordId = /^\d+$/.test(searchTerm);
      
      let players = [];
      
      if (isDiscordId) {
        // Search by Discord ID
        const [rows] = await connection.execute(`
          SELECT p.*, rs.nickname as server_name, g.discord_id as guild_discord_id
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          JOIN guilds g ON rs.guild_id = g.id
          WHERE p.discord_id = ? AND g.discord_id = ?
        `, [searchTerm, interaction.guildId]);
        players = rows;
      } else {
        // Search by IGN
        const [rows] = await connection.execute(`
          SELECT p.*, rs.nickname as server_name, g.discord_id as guild_discord_id
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          JOIN guilds g ON rs.guild_id = g.id
          WHERE p.ign = ? AND g.discord_id = ?
        `, [searchTerm, interaction.guildId]);
        players = rows;
      }

      if (players.length === 0) {
        await connection.end();
        return await interaction.reply({
          content: \`❌ No linked players found for "\${searchTerm}" on this server.\`,
          ephemeral: true
        });
      }

      // Update players to unlink them
      let updatedCount = 0;
      for (const player of players) {
        await connection.execute(`
          UPDATE players 
          SET discord_id = NULL, unlinked_at = NOW(), is_active = false
          WHERE id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
        `, [player.id, interaction.guildId]);
        updatedCount++;
      }

      // Remove roles if user was mentioned
      if (mentionedUser) {
        try {
          const member = await interaction.guild.members.fetch(mentionedUser.id);
          const rolesToRemove = member.roles.cache.filter(role => 
            role.name.toLowerCase().includes('linked') || 
            role.name.toLowerCase().includes('verified')
          );
          
          if (rolesToRemove.size > 0) {
            await member.roles.remove(rolesToRemove);
          }
        } catch (error) {
          console.error('Error removing roles:', error);
        }
      }

      await connection.end();

      const playerNames = players.map(p => p.ign || p.nickname || 'Unknown').join(', ');
      
      await interaction.reply({
        content: \`✅ Successfully unlinked \${updatedCount} player(s): \${playerNames}\`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in unlink command:', error);
      await interaction.reply({
        content: '❌ An error occurred while unlinking the player.',
        ephemeral: true
      });
    }
  },
};
`;

// Write the clean content to unlink.js
const unlinkPath = path.join(__dirname, 'src', 'commands', 'admin', 'unlink.js');

try {
  fs.writeFileSync(unlinkPath, cleanUnlinkContent, 'utf8');
  console.log('✅ Successfully overwrote src/commands/admin/unlink.js with clean version');
  console.log('✅ All merge conflicts resolved permanently');
  console.log('📝 Next steps:');
  console.log('   1. Run: git add src/commands/admin/unlink.js');
  console.log('   2. Run: git commit -m "Permanent fix for unlink.js conflicts"');
  console.log('   3. Run: git push origin main');
} catch (error) {
  console.error('❌ Error writing file:', error);
}
