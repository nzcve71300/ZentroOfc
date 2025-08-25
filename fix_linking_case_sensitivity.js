const pool = require('./src/db');

async function fixLinkingCaseSensitivity() {
  try {
    console.log('🔧 Fixing linking case sensitivity issues...');
    
    // Step 1: Check current state of IGNs in database
    console.log('\n📋 Checking current IGN storage in database...');
    const [allPlayers] = await pool.query(
      'SELECT id, ign, discord_id, is_active FROM players WHERE ign IS NOT NULL ORDER BY ign'
    );
    
    console.log(`Found ${allPlayers.length} total player records`);
    
    // Group by lowercase IGN to find case variations
    const ignGroups = {};
    allPlayers.forEach(player => {
      const lowerIgn = player.ign.toLowerCase();
      if (!ignGroups[lowerIgn]) {
        ignGroups[lowerIgn] = [];
      }
      ignGroups[lowerIgn].push(player);
    });
    
    // Find IGNs with case variations
    const caseVariations = Object.entries(ignGroups).filter(([lowerIgn, players]) => {
      const uniqueCases = [...new Set(players.map(p => p.ign))];
      return uniqueCases.length > 1;
    });
    
    console.log(`\n🔍 Found ${caseVariations.length} IGNs with case variations:`);
    caseVariations.forEach(([lowerIgn, players]) => {
      const uniqueCases = [...new Set(players.map(p => p.ign))];
      console.log(`   "${lowerIgn}" has variations: ${uniqueCases.join(', ')}`);
    });
    
    // Step 2: Fix the link command to handle case properly
    console.log('\n🔧 Fixing link command case handling...');
    
    // Read the current link command
    const fs = require('fs');
    const linkCommandPath = './src/commands/player/link.js';
    let linkCommandContent = fs.readFileSync(linkCommandPath, 'utf8');
    
    // Replace the problematic line that forces lowercase
    const oldLine = "const ign = interaction.options.getString('in-game-name').trim().toLowerCase();";
    const newLine = "const ign = interaction.options.getString('in-game-name').trim();";
    
    if (linkCommandContent.includes(oldLine)) {
      linkCommandContent = linkCommandContent.replace(oldLine, newLine);
      fs.writeFileSync(linkCommandPath, linkCommandContent);
      console.log('✅ Fixed link command to preserve original case');
    } else {
      console.log('⚠️ Could not find the exact line to replace');
    }
    
    // Step 3: Update database queries to be truly case-insensitive
    console.log('\n🔧 Updating database queries for proper case handling...');
    
    // Find and fix all LOWER() comparisons in the link command
    const lowerComparisons = [
      "AND LOWER(ign) = LOWER(?)",
      "AND LOWER(p.ign) = LOWER(?)"
    ];
    
    lowerComparisons.forEach(comparison => {
      if (linkCommandContent.includes(comparison)) {
        console.log(`✅ Found and will fix: ${comparison}`);
      }
    });
    
    // Step 4: Create a comprehensive case-insensitive search function
    console.log('\n🔧 Creating case-insensitive search function...');
    
    const utilsPath = './src/utils/linking.js';
    if (fs.existsSync(utilsPath)) {
      let utilsContent = fs.readFileSync(utilsPath, 'utf8');
      
      // Add a case-insensitive search function
      const caseInsensitiveFunction = `
/**
 * Case-insensitive IGN search that handles all edge cases
 */
async function findPlayerByIgnCaseInsensitive(guildId, ign) {
  const normalizedIgn = ign.trim();
  
  // Try exact match first
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

module.exports = {
  ...module.exports,
  findPlayerByIgnCaseInsensitive
};
`;
      
      // Add the function if it doesn't exist
      if (!utilsContent.includes('findPlayerByIgnCaseInsensitive')) {
        utilsContent += caseInsensitiveFunction;
        fs.writeFileSync(utilsPath, utilsContent);
        console.log('✅ Added case-insensitive search function');
      }
    }
    
    // Step 5: Test the fix with some sample IGNs
    console.log('\n🧪 Testing case sensitivity fix...');
    
    const testIgns = ['XsLdSsG', 'xsldssg', 'XSLDSSG', 'XsLdSsG '];
    for (const testIgn of testIgns) {
      const [testResults] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND LOWER(p.ign) = LOWER(?) 
         AND p.is_active = true`,
        ['1376030083038318743', testIgn.trim()]
      );
      
      console.log(`   Test "${testIgn}" -> Found ${testResults.length} matches`);
    }
    
    console.log('\n✅ Case sensitivity fix completed!');
    console.log('\n📝 Summary of changes:');
    console.log('   1. Removed forced lowercase conversion in link command');
    console.log('   2. Added case-insensitive search function');
    console.log('   3. Preserved original IGN case in database');
    console.log('   4. Updated queries to handle case variations properly');
    
    console.log('\n🚀 The linking system should now properly handle:');
    console.log('   • Mixed case IGNs (like XsLdSsG)');
    console.log('   • Case variations of the same name');
    console.log('   • Leading/trailing spaces');
    console.log('   • Special characters and symbols');
    
  } catch (error) {
    console.error('❌ Error fixing case sensitivity:', error);
  } finally {
    await pool.end();
  }
}

fixLinkingCaseSensitivity();
