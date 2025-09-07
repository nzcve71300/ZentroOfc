const pool = require('./src/db');

async function debugUser() {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Check for the specific Discord user and server
      const discordId = '699310271449006141';
      const serverId = '1756845346677_j63z09una-1';
      
      console.log('🔍 Debugging Discord user:', discordId, 'on server:', serverId);
      
      // Check all records for this Discord user on this server
      const [records] = await connection.query(
        'SELECT id, discord_id, ign, normalized_ign, is_active, linked_at, unlinked_at FROM players WHERE discord_id = ? AND server_id = ?',
        [discordId, serverId]
      );
      
      console.log('\nRecords found:', records.length);
      records.forEach((record, i) => {
        console.log(`Record ${i+1}:`);
        console.log(`  ID: ${record.id}`);
        console.log(`  IGN: ${record.ign}`);
        console.log(`  Normalized: ${record.normalized_ign}`);
        console.log(`  Active: ${record.is_active}`);
        console.log(`  Linked: ${record.linked_at}`);
        console.log(`  Unlinked: ${record.unlinked_at}`);
        console.log('');
      });
      
      // Check the constraint
      const [constraints] = await connection.query('SHOW INDEX FROM players WHERE Key_name = "unique_active_discord_link_per_server"');
      console.log('Constraint details:', constraints);
      
      // Check if there are any active records for this Discord user on this server
      const [activeRecords] = await connection.query(
        'SELECT COUNT(*) as count FROM players WHERE discord_id = ? AND server_id = ? AND is_active = true',
        [discordId, serverId]
      );
      
      console.log(`\nActive records for this Discord user on this server: ${activeRecords[0].count}`);
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

debugUser();
