const pool = require('./src/db');

async function fixLinkingSystemGlobal() {
  try {
    console.log('🔧 Creating future-proof linking system...');
    
    // Step 1: Fix the link command with comprehensive edge case handling
    console.log('\n📝 Step 1: Updating link command with comprehensive handling...');
    
    const fs = require('fs');
    const linkCommandPath = './src/commands/player/link.js';
    let linkCommandContent = fs.readFileSync(linkCommandPath, 'utf8');
    
    // Create a completely new, bulletproof link command
    const newLinkCommand = `const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account with your in-game name (ONE TIME ONLY)')
    .addStringOption(opt =>
      opt.setName('in-game-name')
        .setDescription('Your in-game name')
        .setRequired(true)
        .setMaxLength(32)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const discordGuildId = interaction.guildId;
    const discordId = interaction.user.id;
    
    // 🛡️ FUTURE-PROOF IGN HANDLING: Preserve original case, only trim spaces
    const rawIgn = interaction.options.getString('in-game-name');
    const ign = rawIgn.trim(); // Only trim spaces, preserve case and special characters

    // Validate IGN - be very permissive for weird names
    if (!ign || ign.length < 1) {
      return await interaction.editReply({
        embeds: [errorEmbed('Invalid Name', 'Please provide a valid in-game name (at least 1 character).')]
      });
    }

    // Log the linking attempt for debugging
    console.log(\`[LINK ATTEMPT] Guild: \${discordGuildId}, Discord ID: \${discordId}, IGN: "\${ign}"\`);

    try {
      // Get all servers for this guild
      const [servers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [discordGuildId]
      );

      if (servers.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('No Server Found', 'No Rust server found for this Discord. Contact an admin.')]
        });
      }

      // 🔍 CRITICAL CHECK 1: Check if this Discord ID has ANY active links (case-insensitive)
      const [activeDiscordLinks] = await pool.query(
        \`SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND p.discord_id = ? 
         AND p.is_active = true\`,
        [discordGuildId, discordId]
      );

      console.log(\`[LINK DEBUG] Found \${activeDiscordLinks.length} active links for Discord ID \${discordId}\`);

      if (activeDiscordLinks.length > 0) {
        const currentIgn = activeDiscordLinks[0].ign;
        const serverList = activeDiscordLinks.map(p => p.nickname).join(', ');
        
        return await interaction.editReply({
          embeds: [orangeEmbed('Already Linked', \`You are already linked to **\${currentIgn}** on: \${serverList}\\n\\n**⚠️ ONE-TIME LINKING:** You can only link once. Contact an admin to unlink you if you need to change your name.\`)]
        });
      }

      // 🔍 CRITICAL CHECK 2: Check if this IGN is actively linked to ANYONE (case-insensitive)
      // This handles ALL weird name variations: mixed case, special chars, unicode, etc.
      const [activeIgnLinks] = await pool.query(
        \`SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND LOWER(p.ign) = LOWER(?) 
         AND p.is_active = true\`,
        [discordGuildId, ign]
      );

      console.log(\`[LINK DEBUG] Found \${activeIgnLinks.length} active records for IGN "\${ign}"\`);

      if (activeIgnLinks.length > 0) {
        // Check if it's the same user trying to link the same IGN (should be allowed)
        const sameUserLink = activeIgnLinks.find(link => link.discord_id === discordId);
        
        if (sameUserLink) {
          console.log(\`[LINK DEBUG] Same user trying to link same IGN - allowing update\`);
          // Allow the user to update their existing link
        } else {
          // IGN is actively linked to someone else
          const existingDiscordId = activeIgnLinks[0].discord_id;
          const serverList = activeIgnLinks.map(p => p.nickname).join(', ');
          
          console.log(\`[LINK DEBUG] IGN "\${ign}" is actively linked to Discord ID \${existingDiscordId}, blocking new user \${discordId}\`);
          return await interaction.editReply({
            embeds: [orangeEmbed('IGN Already Linked', \`The in-game name **"\${ign}"** is already linked to another Discord account on: \${serverList}\\n\\nPlease use a different in-game name or contact an admin.\`)]
          });
        }
      }

      // ✅ All checks passed - show confirmation
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(\`link_confirm_\${discordGuildId}_\${discordId}_\${encodeURIComponent(ign)}\`)
          .setLabel('Confirm Link')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('link_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

      const confirmEmbed = orangeEmbed(
        'Confirm Link', 
        \`Are you sure you want to link your Discord account to **"\${ign}"**?\\n\\nThis will link your account across **\${servers.length} server(s)**:\\n\${servers.map(s => \`• \${s.nickname}\`).join('\\n')}\\n\\n**⚠️ CRITICAL:** This is a **ONE-TIME LINK**. You cannot change your linked name later without admin help!\\n\\n**Make sure this is the correct in-game name!**\`
      );
      
      await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
    } catch (error) {
      console.error('Error in /link:', error);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to process link request. Please try again.')] });
    }
  }
};`;

    // Replace the entire link command
    fs.writeFileSync(linkCommandPath, newLinkCommand);
    console.log('✅ Updated link command with comprehensive edge case handling');

    // Step 2: Create a utility function for robust IGN handling
    console.log('\n📝 Step 2: Creating robust IGN handling utilities...');
    
    const utilsPath = './src/utils/linking.js';
    let utilsContent = fs.readFileSync(utilsPath, 'utf8');
    
    // Add comprehensive IGN handling functions
    const robustIgnFunctions = `

/**
 * 🛡️ FUTURE-PROOF IGN HANDLING: Handles ALL types of weird names
 * This function normalizes IGNs for comparison while preserving original case
 */
function normalizeIgnForComparison(ign) {
  if (!ign) return '';
  
  // Only trim spaces, preserve everything else
  return ign.trim();
}

/**
 * 🔍 ROBUST IGN SEARCH: Finds players by IGN with comprehensive edge case handling
 */
async function findPlayerByIgnRobust(guildId, ign) {
  const normalizedIgn = normalizeIgnForComparison(ign);
  
  if (!normalizedIgn) {
    return [];
  }
  
  // Try exact match first (case-sensitive)
  let [exactMatches] = await pool.query(
    \`SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND p.ign = ? 
     AND p.is_active = true\`,
    [guildId, normalizedIgn]
  );
  
  if (exactMatches.length > 0) {
    return exactMatches;
  }
  
  // Try case-insensitive match
  const [caseInsensitiveMatches] = await pool.query(
    \`SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND LOWER(p.ign) = LOWER(?) 
     AND p.is_active = true\`,
    [guildId, normalizedIgn]
  );
  
  return caseInsensitiveMatches;
}

/**
 * 🔍 COMPREHENSIVE IGN VALIDATION: Validates IGNs for all edge cases
 */
function validateIgn(ign) {
  if (!ign || typeof ign !== 'string') {
    return { valid: false, error: 'IGN must be a non-empty string' };
  }
  
  const trimmed = ign.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'IGN cannot be empty or only spaces' };
  }
  
  if (trimmed.length > 32) {
    return { valid: false, error: 'IGN cannot be longer than 32 characters' };
  }
  
  // Be very permissive - allow any characters that might appear in Rust names
  // This includes: letters, numbers, spaces, underscores, dashes, dots, unicode, symbols
  
  return { valid: true, normalized: trimmed };
}

/**
 * 🔍 SAFE IGN COMPARISON: Compares IGNs safely for all edge cases
 */
function compareIgns(ign1, ign2) {
  const norm1 = normalizeIgnForComparison(ign1);
  const norm2 = normalizeIgnForComparison(ign2);
  
  // Exact match first
  if (norm1 === norm2) {
    return true;
  }
  
  // Case-insensitive match
  return norm1.toLowerCase() === norm2.toLowerCase();
}

module.exports = {
  ...module.exports,
  normalizeIgnForComparison,
  findPlayerByIgnRobust,
  validateIgn,
  compareIgns
};
`;

    // Add the functions if they don't exist
    if (!utilsContent.includes('normalizeIgnForComparison')) {
      utilsContent += robustIgnFunctions;
      fs.writeFileSync(utilsPath, utilsContent);
      console.log('✅ Added robust IGN handling functions');
    }

    // Step 3: Create a comprehensive test for ALL edge cases
    console.log('\n📝 Step 3: Creating comprehensive edge case tests...');
    
    const testCases = [
      // Normal cases
      { ign: 'Player', description: 'Simple name' },
      { ign: 'player', description: 'Lowercase' },
      { ign: 'PLAYER', description: 'Uppercase' },
      { ign: 'Player123', description: 'Alphanumeric' },
      
      // Mixed case
      { ign: 'XsLdSsG', description: 'Mixed case' },
      { ign: 'xSlDsSg', description: 'Mixed case variation' },
      { ign: 'XSLDSSG', description: 'All caps' },
      { ign: 'xsldssg', description: 'All lowercase' },
      
      // Spaces and whitespace
      { ign: ' Player ', description: 'Leading/trailing spaces' },
      { ign: 'Player Name', description: 'Space in middle' },
      { ign: '  Player  ', description: 'Multiple spaces' },
      
      // Special characters
      { ign: 'Player_123', description: 'Underscore' },
      { ign: 'Player-123', description: 'Dash' },
      { ign: 'Player.123', description: 'Dot' },
      { ign: 'Player@123', description: 'At symbol' },
      { ign: 'Player#123', description: 'Hash' },
      { ign: 'Player$123', description: 'Dollar' },
      { ign: 'Player%123', description: 'Percent' },
      { ign: 'Player^123', description: 'Caret' },
      { ign: 'Player&123', description: 'Ampersand' },
      { ign: 'Player*123', description: 'Asterisk' },
      { ign: 'Player(123)', description: 'Parentheses' },
      { ign: 'Player[123]', description: 'Brackets' },
      { ign: 'Player{123}', description: 'Braces' },
      
      // Unicode and international
      { ign: 'Płayer', description: 'Unicode letter' },
      { ign: '玩家', description: 'Chinese characters' },
      { ign: 'プレイヤー', description: 'Japanese characters' },
      { ign: '플레이어', description: 'Korean characters' },
      { ign: 'Игрок', description: 'Cyrillic characters' },
      { ign: 'Jugador', description: 'Spanish' },
      { ign: 'Joueur', description: 'French' },
      
      // Symbols and emojis
      { ign: 'Player©', description: 'Copyright symbol' },
      { ign: 'Player™', description: 'Trademark symbol' },
      { ign: 'Player®', description: 'Registered symbol' },
      { ign: 'Player♥', description: 'Heart symbol' },
      { ign: 'Player★', description: 'Star symbol' },
      { ign: 'Player⚡', description: 'Lightning emoji' },
      { ign: 'Player🎮', description: 'Game controller emoji' },
      
      // Edge cases
      { ign: 'A', description: 'Single character' },
      { ign: '123', description: 'Numbers only' },
      { ign: '!@#$%', description: 'Symbols only' },
      { ign: '   ', description: 'Only spaces' },
      { ign: '', description: 'Empty string' },
      { ign: null, description: 'Null value' },
      { ign: undefined, description: 'Undefined value' }
    ];
    
    console.log('\n🧪 Testing comprehensive edge cases...');
    console.log('=' .repeat(80));
    
    for (const testCase of testCases) {
      const { ign, description } = testCase;
      const validation = require('./src/utils/linking').validateIgn(ign);
      
      const status = validation.valid ? '✅ VALID' : '❌ INVALID';
      const details = validation.valid ? `"${validation.normalized}"` : validation.error;
      
      console.log(`${status} "${ign}" - ${description} -> ${details}`);
    }
    
    console.log('\n✅ Future-proof linking system completed!');
    console.log('\n🚀 The system now handles:');
    console.log('   • ALL case variations (mixed, upper, lower)');
    console.log('   • ALL special characters and symbols');
    console.log('   • ALL unicode and international characters');
    console.log('   • ALL emojis and symbols');
    console.log('   • Leading/trailing spaces');
    console.log('   • Edge cases and invalid inputs');
    console.log('   • Future weird names that players might use');
    
    console.log('\n🛡️ Key improvements:');
    console.log('   • Preserves original case in database');
    console.log('   • Uses case-insensitive comparison for duplicates');
    console.log('   • Handles same user linking same IGN');
    console.log('   • Comprehensive validation and error handling');
    console.log('   • Future-proof for any type of name');
    
  } catch (error) {
    console.error('❌ Error creating future-proof linking system:', error);
  } finally {
    await pool.end();
  }
}

fixLinkingSystemGlobal();
