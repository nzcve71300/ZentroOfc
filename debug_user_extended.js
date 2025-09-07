const pool = require('./src/db');

async function debugUserExtended() {
  try {
    const connection = await pool.getConnection();
    
    try {
      const discordId = '699310271449006141';
      const serverId = '1756845346677_j63z09una-1';
      
      console.log('🔍 Extended debugging for Discord user:', discordId, 'on server:', serverId);
      
      // Check ALL records (including inactive) for this Discord user on this server
      const [allRecords] = await connection.query(
        'SELECT id, discord_id, ign, normalized_ign, is_active, linked_at, unlinked_at, unlinked_by, unlink_reason FROM players WHERE discord_id = ? AND server_id = ?',
        [discordId, serverId]
      );
      
      console.log('\nAll records (including inactive):', allRecords.length);
      allRecords.forEach((record, i) => {
        console.log(`Record ${i+1}:`);
        console.log(`  ID: ${record.id}`);
        console.log(`  IGN: ${record.ign}`);
        console.log(`  Normalized: ${record.normalized_ign}`);
        console.log(`  Active: ${record.is_active}`);
        console.log(`  Linked: ${record.linked_at}`);
        console.log(`  Unlinked: ${record.unlinked_at}`);
        console.log(`  Unlinked by: ${record.unlinked_by}`);
        console.log(`  Unlink reason: ${record.unlink_reason}`);
        console.log('');
      });
      
      // Check if there are any records with is_active = false
      const [inactiveRecords] = await connection.query(
        'SELECT COUNT(*) as count FROM players WHERE discord_id = ? AND server_id = ? AND is_active = false',
        [discordId, serverId]
      );
      
      console.log(`Inactive records for this Discord user on this server: ${inactiveRecords[0].count}`);
      
      // Check the exact constraint violation by trying to understand what's happening
      console.log('\n🔍 Checking constraint violation scenario...');
      
      // Simulate what the INSERT would be trying to do
      const testData = {
        discord_id: discordId,
        server_id: serverId,
        is_active: true
      };
      
      console.log('Test data that would cause constraint violation:', testData);
      
      // Check if there's a record with these exact values
      const [conflictCheck] = await connection.query(
        'SELECT id, discord_id, server_id, is_active FROM players WHERE discord_id = ? AND server_id = ? AND is_active = ?',
        [discordId, serverId, true]
      );
      
      console.log(`Records with discord_id=${discordId}, server_id=${serverId}, is_active=true: ${conflictCheck.length}`);
      if (conflictCheck.length > 0) {
        console.log('Conflicting record:', conflictCheck[0]);
      }
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

debugUserExtended();
