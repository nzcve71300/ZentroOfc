const pool = require('./src/db');

async function debugZorpOfflineIssue() {
  try {
    console.log('🔍 Debugging Zorp Offline Issue...');
    
    const playerName = 'nzcve7130';
    
    // 1. Check current active zones
    console.log('\n1. Checking current active zones...');
    const [activeZones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.owner, z.created_at
    `);
    
    console.log(`Found ${activeZones.length} total active zones:`);
    activeZones.forEach(zone => {
      console.log(`  - ${zone.owner} on ${zone.nickname}: ${zone.name} (created: ${zone.created_at})`);
    });

    // 2. Check specific player zones
    console.log(`\n2. Checking zones for ${playerName}...`);
    const [playerZones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.owner = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [playerName]);
    
    console.log(`Found ${playerZones.length} active zones for ${playerName}:`);
    playerZones.forEach(zone => {
      const expireTime = new Date(new Date(zone.created_at).getTime() + zone.expire * 1000);
      console.log(`  - ${zone.name} on ${zone.nickname} (created: ${zone.created_at}, expires: ${expireTime})`);
    });

    // 3. Test the exact query from handlePlayerOffline
    console.log(`\n3. Testing handlePlayerOffline query for ${playerName}...`);
    const [offlineQuery] = await pool.query(
      'SELECT name FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [playerName]
    );
    
    console.log(`handlePlayerOffline query result: ${offlineQuery.length} zones found`);
    offlineQuery.forEach(zone => {
      console.log(`  - ${zone.name}`);
    });

    // 4. Check if there are any zones for this player (including expired)
    console.log(`\n4. Checking ALL zones for ${playerName} (including expired)...`);
    const [allPlayerZones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.owner = ?
      ORDER BY z.created_at DESC
    `, [playerName]);
    
    console.log(`Found ${allPlayerZones.length} total zones for ${playerName}:`);
    allPlayerZones.forEach(zone => {
      const expireTime = new Date(new Date(zone.created_at).getTime() + zone.expire * 1000);
      const isExpired = new Date() > expireTime;
      console.log(`  - ${zone.name} on ${zone.nickname} (created: ${zone.created_at}, expired: ${isExpired})`);
    });

    // 5. Check zorp_defaults for the server
    console.log('\n5. Checking zorp_defaults...');
    const [defaults] = await pool.query('SELECT * FROM zorp_defaults');
    console.log(`Found ${defaults.length} zorp defaults:`);
    defaults.forEach(def => {
      console.log(`  - Server ID: ${def.server_id}, Enabled: ${def.enabled}, Expire: ${def.expire} seconds`);
    });

    // 6. Check if there are any recent zone deletions
    console.log('\n6. Checking recent zone activity...');
    const [recentZones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.owner = ?
      ORDER BY z.created_at DESC
      LIMIT 5
    `, [playerName]);
    
    console.log(`Recent zones for ${playerName}:`);
    recentZones.forEach(zone => {
      const expireTime = new Date(new Date(zone.created_at).getTime() + zone.expire * 1000);
      const isExpired = new Date() > expireTime;
      console.log(`  - ${zone.name} on ${zone.nickname} (created: ${zone.created_at}, expired: ${isExpired})`);
    });

    // 7. Test different query variations
    console.log('\n7. Testing query variations...');
    
    // Test without expire condition
    const [noExpireQuery] = await pool.query(
      'SELECT name FROM zorp_zones WHERE owner = ?',
      [playerName]
    );
    console.log(`Query without expire condition: ${noExpireQuery.length} zones found`);
    
    // Test with current timestamp
    const [currentTimeQuery] = await pool.query(
      'SELECT name, created_at, expire, created_at + INTERVAL expire SECOND as expire_time FROM zorp_zones WHERE owner = ?',
      [playerName]
    );
    console.log(`Query with timestamp details: ${currentTimeQuery.length} zones found`);
    currentTimeQuery.forEach(zone => {
      console.log(`  - ${zone.name}: created=${zone.created_at}, expire_time=${zone.expire_time}`);
    });

    console.log('\n🎉 Debug completed!');
    
    if (playerZones.length === 0) {
      console.log('\n⚠️  ISSUE FOUND: No active zones found for player!');
      console.log('This explains why "has no Zorp zone" message appears when going offline.');
    } else {
      console.log('\n✅ Active zones found - the issue might be elsewhere.');
    }

  } catch (error) {
    console.error('❌ Error debugging Zorp offline issue:', error);
  } finally {
    await pool.end();
  }
}

debugZorpOfflineIssue(); 