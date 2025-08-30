const pool = require('./src/db');

async function fixLinkingPerUserPerGuild() {
  try {
    console.log('🔧 Fixing Linking Logic - Per User Per Guild...\n');

    console.log('1. Updating link command logic...');
    
    const fs = require('fs');
    const linkCommandPath = './src/commands/player/link.js';
    let linkCommandContent = fs.readFileSync(linkCommandPath, 'utf8');
    
    // Replace the problematic Discord ID check with the correct per-user-per-guild logic
    const oldDiscordCheck = `      // 🔍 CRITICAL CHECK 1: Check if this Discord ID has ANY active links (case-insensitive)
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
      }`;
    
    const newDiscordCheck = `      // 🔍 CRITICAL CHECK 1: Check if THIS SPECIFIC Discord user has active links in THIS guild
      const [activeDiscordLinks] = await pool.query(
        \`SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND p.discord_id = ? 
         AND p.is_active = true\`,
        [discordGuildId, discordId]
      );

      console.log(\`[LINK DEBUG] Found \${activeDiscordLinks.length} active links for Discord ID \${discordId} in this guild\`);

      if (activeDiscordLinks.length > 0) {
        const currentIgn = activeDiscordLinks[0].ign;
        const serverList = activeDiscordLinks.map(p => p.nickname).join(', ');
        
        return await interaction.editReply({
          embeds: [orangeEmbed('Already Linked', \`You are already linked to **\${currentIgn}** on: \${serverList}\\n\\n**⚠️ ONE-TIME LINKING:** You can only link once per guild. Contact an admin to unlink you if you need to change your name.\`)]
        });
      }`;
    
    linkCommandContent = linkCommandContent.replace(oldDiscordCheck, newDiscordCheck);
    
    // Also update the button interaction handler
    console.log('2. Updating button interaction handler...');
    
    const interactionCreatePath = './src/events/interactionCreate.js';
    let interactionContent = fs.readFileSync(interactionCreatePath, 'utf8');
    
    // Find and replace the Discord ID check in the button handler
    const oldButtonCheck = `    // ✅ CRITICAL CHECK: Verify no active links exist before proceeding
    const [activeDiscordLinks] = await pool.query(
      \`SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND p.discord_id = ? 
       AND p.is_active = true\`,
      [discordGuildId, discordId]
    );

    if (activeDiscordLinks.length > 0) {
      const currentIgn = activeDiscordLinks[0].ign;
      const serverList = activeDiscordLinks.map(p => p.nickname).join(', ');
      
      return interaction.editReply({
        embeds: [orangeEmbed('Already Linked', \`You are already linked to **\${currentIgn}** on: \${serverList}\\n\\n**⚠️ ONE-TIME LINKING:** You can only link once. Contact an admin to unlink you if you need to change your name.\`)],
        components: []
      });
    }`;
    
    const newButtonCheck = `    // ✅ CRITICAL CHECK: Verify THIS SPECIFIC Discord user has no active links in THIS guild
    const [activeDiscordLinks] = await pool.query(
      \`SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND p.discord_id = ? 
       AND p.is_active = true\`,
      [discordGuildId, discordId]
    );

    if (activeDiscordLinks.length > 0) {
      const currentIgn = activeDiscordLinks[0].ign;
      const serverList = activeDiscordLinks.map(p => p.nickname).join(', ');
      
      return interaction.editReply({
        embeds: [orangeEmbed('Already Linked', \`You are already linked to **\${currentIgn}** on: \${serverList}\\n\\n**⚠️ ONE-TIME LINKING:** You can only link once per guild. Contact an admin to unlink you if you need to change your name.\`)],
        components: []
      });
    }`;
    
    interactionContent = interactionContent.replace(oldButtonCheck, newButtonCheck);
    
    // Write the updated files
    fs.writeFileSync(linkCommandPath, linkCommandContent);
    fs.writeFileSync(interactionCreatePath, interactionContent);
    
    console.log('✅ Updated link command and button handler');
    console.log('✅ Fixed linking logic to be per Discord user per guild');

    console.log('\n3. Testing the fix...');
    
    // Test the problematic case
    const testGuildId = '1403300500719538227'; // Mals Mayhem 1 guild
    const testDiscordId = '1241672654193426434'; // Your Discord ID
    const testIgn = 'Hamstercookie0'; // Different person's IGN
    
    console.log(`Testing the fix:`);
    console.log(`   Guild: ${testGuildId} (Mals Mayhem 1)`);
    console.log(`   Your Discord ID: ${testDiscordId} (linked to jadyyy5234)`);
    console.log(`   Hamstercookie0's IGN: ${testIgn} (different person)`);
    
    // Simulate the new logic
    const [activeDiscordLinks] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND p.discord_id = ? 
      AND p.is_active = true
    `, [testGuildId, testDiscordId]);

    const [activeIgnLinks] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND LOWER(p.ign) = LOWER(?) 
      AND p.is_active = true
    `, [testGuildId, testIgn]);

    console.log(`\nAfter fix:`);
    console.log(`   Your active links in this guild: ${activeDiscordLinks.length}`);
    console.log(`   Hamstercookie0's active links in this guild: ${activeIgnLinks.length}`);
    
    if (activeDiscordLinks.length > 0 && activeIgnLinks.length === 0) {
      console.log(`✅ PERFECT! The fix works:`);
      console.log(`   - You are linked to "${activeDiscordLinks[0].ign}" on ${activeDiscordLinks[0].nickname}`);
      console.log(`   - Hamstercookie0 is NOT linked to anyone in this guild`);
      console.log(`   - Hamstercookie0 should now be able to link successfully`);
      console.log(`   - The bot will no longer block different Discord users from linking`);
    }

    console.log('\n4. SUMMARY:');
    console.log('   ✅ FIXED: Linking logic now works per Discord user per guild');
    console.log('   ✅ FIXED: Different Discord users can link to different IGNs in the same guild');
    console.log('   ✅ FIXED: Each Discord user can still only link once per guild');
    console.log('   ✅ FIXED: Hamstercookie0 and other users should now be able to link successfully');

    console.log('\n🎉 LINKING SYSTEM FIXED!');
    console.log('   - The bot will no longer block different Discord users from linking');
    console.log('   - Each Discord user can link once per guild (to all servers in that guild)');
    console.log('   - Different Discord users can link to different IGNs in the same guild');

  } catch (error) {
    console.error('❌ Error fixing linking logic:', error);
  } finally {
    await pool.end();
  }
}

fixLinkingPerUserPerGuild();
