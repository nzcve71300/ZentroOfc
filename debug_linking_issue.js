const pool = require('./src/db');
const { compareDiscordIds, normalizeDiscordId } = require('./src/utils/discordUtils');

async function debugLinkingIssue() {
  try {
    console.log('🔍 Debugging Linking System Issues...\n');

    // Test cases from the error messages
    const testCases = [
      { guildId: '1403300500719538227', discordId: '1241672654193426434', ign: 'Hamstercookie0' },
      { guildId: '1403300500719538227', discordId: 'some_discord_id', ign: 'TTVjoshy3871' }
    ];

    console.log('1. Testing Discord ID normalization...');
    const testDiscordIds = [
      '1241672654193426434',
      1241672654193426434,
      '1241672654193426434n',
      ' 1241672654193426434 ',
      null,
      undefined
    ];

    testDiscordIds.forEach(id => {
      const normalized = normalizeDiscordId(id);
      console.log(`   Input: "${id}" (${typeof id}) -> Normalized: "${normalized}"`);
    });

    console.log('\n2. Testing Discord ID comparison...');
    const comparisonTests = [
      ['1241672654193426434', '1241672654193426434'],
      ['1241672654193426434', 1241672654193426434],
      ['1241672654193426434', ' 1241672654193426434 '],
      ['1241672654193426434', '1241672654193426435'],
      [null, '1241672654193426434'],
      [undefined, '1241672654193426434']
    ];

    comparisonTests.forEach(([id1, id2]) => {
      const result = compareDiscordIds(id1, id2);
      console.log(`   "${id1}" vs "${id2}" -> ${result}`);
    });

    console.log('\n3. Checking database Discord ID storage...');
    const [discordIdSamples] = await pool.query(`
      SELECT discord_id, LENGTH(discord_id) as length
      FROM players 
      WHERE discord_id IS NOT NULL 
      LIMIT 10
    `);

         console.log(`Found ${discordIdSamples.length} Discord ID samples:`);
     discordIdSamples.forEach(sample => {
       console.log(`   Discord ID: "${sample.discord_id}" (Length: ${sample.length})`);
     });

    console.log('\n4. Testing the exact queries from link command...');
    
    // Test the first error case
    const guildId = '1403300500719538227';
    const discordId = '1241672654193426434';
    const ign = 'Hamstercookie0';

    console.log(`Testing for Guild: ${guildId}, Discord ID: ${discordId}, IGN: ${ign}`);

    // Test Discord ID check
    const [activeDiscordLinks] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND p.discord_id = ? 
       AND p.is_active = true`,
      [guildId, discordId]
    );

    console.log(`Discord ID check found ${activeDiscordLinks.length} active links`);
    activeDiscordLinks.forEach(link => {
      console.log(`   - IGN: "${link.ign}", Server: ${link.nickname}, Discord ID: "${link.discord_id}"`);
    });

    // Test IGN check
    const [activeIgnLinks] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(p.ign) = LOWER(?) 
       AND p.is_active = true`,
      [guildId, ign]
    );

    console.log(`IGN check found ${activeIgnLinks.length} active links`);
    activeIgnLinks.forEach(link => {
      console.log(`   - IGN: "${link.ign}", Server: ${link.nickname}, Discord ID: "${link.discord_id}"`);
      const isSameUser = compareDiscordIds(link.discord_id, discordId);
      console.log(`     Same user check: ${isSameUser}`);
    });

    console.log('\n5. Checking for potential issues...');
    
    // Check if there are any Discord IDs stored as numbers instead of strings
    const [numberDiscordIds] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM players 
      WHERE discord_id IS NOT NULL 
      AND discord_id REGEXP '^[0-9]+$' 
      AND LENGTH(discord_id) < 17
    `);
    
    console.log(`Discord IDs that might be stored as numbers: ${numberDiscordIds[0].count}`);

    // Check for case sensitivity issues
    const [caseSensitiveTest] = await pool.query(`
      SELECT ign, COUNT(*) as count
      FROM players 
      WHERE ign IS NOT NULL 
      GROUP BY LOWER(ign)
      HAVING COUNT(*) > 1
      LIMIT 5
    `);

    console.log(`Potential case sensitivity issues: ${caseSensitiveTest.length} IGNs with different cases`);
    caseSensitiveTest.forEach(test => {
      console.log(`   - IGN pattern: "${test.ign}" (${test.count} variations)`);
    });

    console.log('\n6. Recommendations:');
    console.log('   - Check if Discord IDs are stored consistently as strings');
    console.log('   - Verify case sensitivity in IGN comparisons');
    console.log('   - Ensure proper trimming of whitespace');
    console.log('   - Add more detailed logging to track the exact failure point');

  } catch (error) {
    console.error('❌ Error debugging linking issue:', error);
  } finally {
    await pool.end();
  }
}

debugLinkingIssue(); 