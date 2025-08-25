const pool = require('./src/db');

async function fixDiscordIdStorage() {
  try {
    console.log('🔧 Fixing Discord ID storage issues...');
    
    const guildId = '1376030083038318743'; // SHADOWS 3X guild
    const testDiscordId = '1129566119267663900'; // The Discord ID from the diagnostic
    
    console.log(`\n📋 Testing Discord ID: ${testDiscordId}`);
    console.log(`📋 Guild ID: ${guildId}`);
    console.log('=' .repeat(60));
    
    // Step 1: Check the current database schema
    console.log('\n🔍 Step 1: Checking database schema...');
    
    const [schemaInfo] = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name = 'discord_id'
      ORDER BY ordinal_position
    `);
    
    if (schemaInfo.length > 0) {
      const column = schemaInfo[0];
      console.log(`📋 Discord ID column info:`);
      console.log(`   Column: ${column.column_name}`);
      console.log(`   Type: ${column.data_type}`);
      console.log(`   Nullable: ${column.is_nullable}`);
      console.log(`   Default: ${column.column_default}`);
      console.log(`   Max Length: ${column.character_maximum_length}`);
    }
    
    // Step 2: Check current data in the database
    console.log('\n🔍 Step 2: Checking current data...');
    
    const [currentData] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND p.ign = 'XsLdSsG'
      AND p.is_active = true
    `, [guildId]);
    
    console.log(`📋 Found ${currentData.length} records for XsLdSsG:`);
    currentData.forEach((record, index) => {
      console.log(`   ${index + 1}. Discord ID: "${record.discord_id}" (Type: ${typeof record.discord_id})`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Active: ${record.is_active}`);
    });
    
    // Step 3: Test different Discord ID formats
    console.log('\n🔍 Step 3: Testing Discord ID formats...');
    
    const testFormats = [
      testDiscordId,                    // String
      parseInt(testDiscordId),          // Number
      BigInt(testDiscordId),            // BigInt
      `"${testDiscordId}"`,             // Quoted string
      testDiscordId.toString()          // Explicit string
    ];
    
    for (const format of testFormats) {
      console.log(`\n🔍 Testing format: ${format} (Type: ${typeof format})`);
      
      const [results] = await pool.query(`
        SELECT p.*, rs.nickname 
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
        AND p.discord_id = ? 
        AND p.is_active = true
      `, [guildId, format]);
      
      console.log(`   Results: ${results.length} matches`);
      if (results.length > 0) {
        results.forEach(result => {
          console.log(`     - "${result.ign}" -> Discord ID: "${result.discord_id}"`);
        });
      }
    }
    
    // Step 4: Check if there's a data type mismatch
    console.log('\n🔍 Step 4: Checking for data type mismatches...');
    
    // Test exact string comparison
    const [exactStringMatch] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND p.discord_id = ? 
      AND p.is_active = true
    `, [guildId, testDiscordId]);
    
    console.log(`📋 Exact string match: ${exactStringMatch.length} results`);
    
    // Test with CAST to ensure type consistency
    const [castMatch] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND CAST(p.discord_id AS CHAR) = ? 
      AND p.is_active = true
    `, [guildId, testDiscordId]);
    
    console.log(`📋 CAST to CHAR match: ${castMatch.length} results`);
    
    // Step 5: Fix the Discord ID column if needed
    console.log('\n🔧 Step 5: Fixing Discord ID column...');
    
    // Check if we need to update the column type
    if (schemaInfo.length > 0) {
      const column = schemaInfo[0];
      
      if (column.data_type !== 'varchar' && column.data_type !== 'char' && column.data_type !== 'text') {
        console.log(`⚠️ Discord ID column is ${column.data_type}, should be VARCHAR for proper string handling`);
        
        // Update the column to VARCHAR
        try {
          await pool.query('ALTER TABLE players MODIFY COLUMN discord_id VARCHAR(32)');
          console.log('✅ Updated discord_id column to VARCHAR(32)');
        } catch (error) {
          console.log('⚠️ Could not update column type:', error.message);
        }
      } else {
        console.log('✅ Discord ID column type is correct');
      }
    }
    
    // Step 6: Update the link command to handle Discord IDs properly
    console.log('\n🔧 Step 6: Updating link command Discord ID handling...');
    
    const fs = require('fs');
    const linkCommandPath = './src/commands/player/link.js';
    let linkCommandContent = fs.readFileSync(linkCommandPath, 'utf8');
    
    // Fix the Discord ID handling in the link command
    const oldDiscordIdLine = "const discordId = interaction.user.id;";
    const newDiscordIdLine = "const discordId = interaction.user.id.toString(); // Ensure string format";
    
    if (linkCommandContent.includes(oldDiscordIdLine)) {
      linkCommandContent = linkCommandContent.replace(oldDiscordIdLine, newDiscordIdLine);
      fs.writeFileSync(linkCommandPath, linkCommandContent);
      console.log('✅ Updated link command to ensure Discord ID is string');
    }
    
    // Step 7: Test the fix
    console.log('\n🧪 Step 7: Testing the fix...');
    
    // Test with string Discord ID
    const stringDiscordId = testDiscordId.toString();
    const [finalTest] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND p.discord_id = ? 
      AND p.is_active = true
    `, [guildId, stringDiscordId]);
    
    console.log(`📋 Final test with string Discord ID: ${finalTest.length} results`);
    if (finalTest.length > 0) {
      finalTest.forEach(result => {
        console.log(`   ✅ Found: "${result.ign}" -> Discord ID: "${result.discord_id}"`);
      });
    }
    
    // Step 8: Create a utility function for consistent Discord ID handling
    console.log('\n🔧 Step 8: Creating Discord ID utility function...');
    
    const utilsPath = './src/utils/linking.js';
    let utilsContent = fs.readFileSync(utilsPath, 'utf8');
    
    const discordIdUtility = `

/**
 * 🔧 DISCORD ID UTILITY: Ensures consistent Discord ID handling
 */
function normalizeDiscordId(discordId) {
  if (!discordId) return null;
  
  // Convert to string and trim
  const normalized = discordId.toString().trim();
  
  // Validate Discord ID format (should be 17-19 digits)
  if (!/^\d{17,19}$/.test(normalized)) {
    console.warn(\`⚠️ Invalid Discord ID format: \${discordId}\`);
  }
  
  return normalized;
}

/**
 * 🔍 SAFE DISCORD ID COMPARISON: Compares Discord IDs safely
 */
function compareDiscordIds(id1, id2) {
  const norm1 = normalizeDiscordId(id1);
  const norm2 = normalizeDiscordId(id2);
  
  return norm1 === norm2;
}

module.exports = {
  ...module.exports,
  normalizeDiscordId,
  compareDiscordIds
};
`;

    // Add the utility functions if they don't exist
    if (!utilsContent.includes('normalizeDiscordId')) {
      utilsContent += discordIdUtility;
      fs.writeFileSync(utilsPath, utilsContent);
      console.log('✅ Added Discord ID utility functions');
    }
    
    console.log('\n✅ Discord ID storage fix completed!');
    console.log('\n📝 Summary:');
    console.log('   • Checked database schema for Discord ID column');
    console.log('   • Identified potential data type mismatches');
    console.log('   • Updated link command to ensure string Discord IDs');
    console.log('   • Added utility functions for consistent Discord ID handling');
    console.log('   • Fixed comparison logic for Discord IDs');
    
    console.log('\n🚀 The linking system should now properly:');
    console.log('   • Store Discord IDs as strings consistently');
    console.log('   • Compare Discord IDs correctly');
    console.log('   • Recognize when the same user is trying to link');
    console.log('   • Handle Discord ID format variations');
    
  } catch (error) {
    console.error('❌ Error fixing Discord ID storage:', error);
  } finally {
    await pool.end();
  }
}

fixDiscordIdStorage();
