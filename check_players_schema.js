const pool = require('./src/db');

async function checkPlayersSchema() {
  try {
    console.log('🔍 Checking players table schema...');
    
    // Check the table structure
    const [columns] = await pool.query('DESCRIBE players');
    console.log('\n📋 Players table columns:');
    columns.forEach(col => {
      console.log(`   ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check a few sample records
    console.log('\n📋 Sample player records:');
    const [samplePlayers] = await pool.query(`
      SELECT p.*, s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      LIMIT 5
    `);
    
    if (samplePlayers.length > 0) {
      console.log('Sample data:');
      samplePlayers.forEach((player, index) => {
        console.log(`\n${index + 1}. Player record:`);
        Object.keys(player).forEach(key => {
          console.log(`   ${key}: ${player[key]}`);
        });
      });
    } else {
      console.log('No player records found');
    }
    
    // Check for any duplicate in-game names (using correct column name)
    console.log('\n📋 Checking for duplicates...');
    
    // Try different possible column names
    const possibleNameColumns = ['name', 'player_name', 'in_game_name', 'username', 'steam_name'];
    
    for (const columnName of possibleNameColumns) {
      try {
        const [duplicates] = await pool.query(`
          SELECT 
            p.server_id,
            s.nickname as server_name,
            p.${columnName} as in_game_name,
            COUNT(*) as count
          FROM players p
          JOIN rust_servers s ON p.server_id = s.id
          WHERE p.${columnName} IS NOT NULL AND p.${columnName} != ''
          GROUP BY p.server_id, p.${columnName}
          HAVING COUNT(*) > 1
          LIMIT 5
        `);
        
        if (duplicates.length > 0) {
          console.log(`✅ Found duplicates using column '${columnName}':`);
          duplicates.forEach(dup => {
            console.log(`   ${dup.in_game_name} on ${dup.server_name} (${dup.count} records)`);
          });
          console.log(`\n🎯 The correct column name is: ${columnName}`);
          break;
        }
      } catch (error) {
        // Column doesn't exist, try next one
        continue;
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    await pool.end();
  }
}

checkPlayersSchema(); 