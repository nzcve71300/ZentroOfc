const pool = require('./src/db');

async function debugZorpZoneIssue() {
  try {
    console.log('🔍 Debugging Zorp Zone Issue...');
    
    // Check zorp_zones table structure
    console.log('\n1. Checking zorp_zones table structure...');
    const [columns] = await pool.query('DESCRIBE zorp_zones');
    console.log('Columns in zorp_zones:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

    // Check all active zones
    console.log('\n2. Checking all active zones...');
    const [activeZones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.owner, z.created_at
    `);
    
    console.log(`Found ${activeZones.length} active zones:`);
    activeZones.forEach(zone => {
      console.log(`  - ${zone.owner} on ${zone.nickname}: ${zone.name} (created: ${zone.created_at})`);
    });

    // Check specific player zones
    const playerName = 'nzcve7130';
    console.log(`\n3. Checking zones for player: ${playerName}`);
    
    const [playerZones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.owner = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [playerName]);
    
    console.log(`Found ${playerZones.length} active zones for ${playerName}:`);
    playerZones.forEach(zone => {
      console.log(`  - ${zone.name} on ${zone.nickname} (created: ${zone.created_at}, expires: ${new Date(new Date(zone.created_at).getTime() + zone.expire * 1000)})`);
    });

    // Check all zones for this player (including expired)
    console.log(`\n4. Checking ALL zones for player: ${playerName} (including expired)`);
    const [allPlayerZones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.owner = ?
      ORDER BY z.created_at DESC
    `, [playerName]);
    
    console.log(`Found ${allPlayerZones.length} total zones for ${playerName}:`);
    allPlayerZones.forEach(zone => {
      const isExpired = new Date() > new Date(new Date(zone.created_at).getTime() + zone.expire * 1000);
      console.log(`  - ${zone.name} on ${zone.nickname} (created: ${zone.created_at}, expired: ${isExpired})`);
    });

    // Check zorp_defaults
    console.log('\n5. Checking zorp_defaults...');
    const [defaults] = await pool.query('SELECT * FROM zorp_defaults');
    console.log(`Found ${defaults.length} zorp defaults:`);
    defaults.forEach(def => {
      console.log(`  - Server ID: ${def.server_id}, Enabled: ${def.enabled}, Expire: ${def.expire} seconds`);
    });

    // Test the exact query used in handlePlayerOffline
    console.log(`\n6. Testing handlePlayerOffline query for ${playerName}...`);
    const [offlineQuery] = await pool.query(
      'SELECT name FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [playerName]
    );
    
    console.log(`Query result: ${offlineQuery.length} zones found`);
    offlineQuery.forEach(zone => {
      console.log(`  - ${zone.name}`);
    });

    console.log('\n🎉 Debug completed!');

  } catch (error) {
    console.error('❌ Error debugging Zorp zone issue:', error);
  } finally {
    await pool.end();
  }
}

debugZorpZoneIssue(); 