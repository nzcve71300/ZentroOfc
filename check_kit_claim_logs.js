const pool = require('./src/db');

async function checkKitClaimLogs() {
  try {
    console.log('🔍 Checking kit claim logs and cooldowns...\n');
    
    // Check recent kit cooldowns to see if duplicates are being recorded
    const [recentClaims] = await pool.query(`
      SELECT 
        kc.kit_name,
        kc.player_name,
        rs.nickname as server,
        kc.claimed_at,
        TIMESTAMPDIFF(SECOND, LAG(kc.claimed_at) OVER (PARTITION BY kc.kit_name, kc.player_name, kc.server_id ORDER BY kc.claimed_at), kc.claimed_at) as seconds_since_last
      FROM kit_cooldowns kc
      JOIN rust_servers rs ON kc.server_id = rs.id
      WHERE kc.claimed_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      ORDER BY kc.claimed_at DESC
      LIMIT 20
    `);
    
    console.log('📊 Recent kit claims (last hour):');
    recentClaims.forEach((claim, index) => {
      console.log(`  ${index + 1}. ${claim.player_name} claimed ${claim.kit_name} on ${claim.server}`);
      console.log(`     Time: ${claim.claimed_at}`);
      if (claim.seconds_since_last !== null && claim.seconds_since_last < 10) {
        console.log(`     ⚠️  DUPLICATE? Only ${claim.seconds_since_last}s since last claim!`);
      }
    });
    
    // Check for potential duplicate claims (same player, same kit, within 10 seconds)
    const [duplicateClaims] = await pool.query(`
      SELECT 
        kc1.kit_name,
        kc1.player_name,
        rs.nickname as server,
        kc1.claimed_at as claim1,
        kc2.claimed_at as claim2,
        TIMESTAMPDIFF(SECOND, kc1.claimed_at, kc2.claimed_at) as seconds_between
      FROM kit_cooldowns kc1
      JOIN kit_cooldowns kc2 ON kc1.kit_name = kc2.kit_name 
        AND kc1.player_name = kc2.player_name 
        AND kc1.server_id = kc2.server_id
        AND kc1.id < kc2.id
      JOIN rust_servers rs ON kc1.server_id = rs.id
      WHERE TIMESTAMPDIFF(SECOND, kc1.claimed_at, kc2.claimed_at) < 10
      AND kc1.claimed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY kc2.claimed_at DESC
    `);
    
    if (duplicateClaims.length > 0) {
      console.log(`\n❌ Found ${duplicateClaims.length} potential duplicate claims:`);
      duplicateClaims.forEach((dup, index) => {
        console.log(`  ${index + 1}. ${dup.player_name} claimed ${dup.kit_name} on ${dup.server}`);
        console.log(`     First: ${dup.claim1}`);
        console.log(`     Second: ${dup.claim2} (${dup.seconds_between}s later)`);
      });
    } else {
      console.log('\n✅ No duplicate claims found in last 24 hours');
    }
    
    // Check autokit configurations
    const [autokitConfigs] = await pool.query(`
      SELECT 
        rs.nickname as server,
        a.kit_name,
        a.enabled,
        a.cooldown,
        a.game_name
      FROM autokits a
      JOIN rust_servers rs ON a.server_id = rs.id
      WHERE a.enabled = 1
      ORDER BY rs.nickname, a.kit_name
    `);
    
    console.log(`\n⚙️ Enabled autokit configurations:`);
    autokitConfigs.forEach(config => {
      console.log(`  ${config.server}: ${config.kit_name} (${config.game_name}) - ${config.cooldown}min cooldown`);
    });
    
  } catch (error) {
    console.error('❌ Error checking kit claims:', error);
  } finally {
    await pool.end();
  }
}

checkKitClaimLogs();