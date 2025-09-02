const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixConstraint() {
  console.log('🔧 Fixing Database Constraint');
  console.log('=============================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('📋 Current constraint causing the issue:');
    console.log('  UNIQUE KEY `unique_active_ign_link_per_guild` (`ign`,`guild_id`,`is_active`)');
    console.log('');
    console.log('This prevents the same player (IGN) from being active on multiple servers in the same guild.');
    console.log('');

    // Remove the problematic constraint
    console.log('🗑️  Removing problematic constraint...');
    
    try {
      await connection.execute(`
        ALTER TABLE players 
        DROP INDEX unique_active_ign_link_per_guild
      `);
      console.log('✅ Successfully removed unique_active_ign_link_per_guild constraint');
    } catch (error) {
      console.log('❌ Failed to remove constraint:', error.message);
      console.log('Trying alternative approach...');
      
      // Try to drop by constraint name if index name doesn't work
      try {
        await connection.execute(`
          ALTER TABLE players 
          DROP INDEX unique_active_ign_link_per_guild
        `);
        console.log('✅ Successfully removed constraint using alternative method');
      } catch (error2) {
        console.log('❌ Alternative method also failed:', error2.message);
        console.log('You may need to manually remove this constraint from your database.');
        return;
      }
    }

    // Verify the constraint is removed
    console.log('\n🔍 Verifying constraint removal...');
    
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM players 
      WHERE Key_name = 'unique_active_ign_link_per_guild'
    `);
    
    if (indexes.length === 0) {
      console.log('✅ Constraint successfully removed!');
    } else {
      console.log('❌ Constraint still exists:', indexes.length, 'entries found');
    }

    // Now try the auto-linking again
    console.log('\n🔄 Testing auto-linking with fixed constraint...');
    
    // Get USA-DeadOps server ID
    const [usaServer] = await connection.execute(`
      SELECT id FROM rust_servers WHERE nickname = 'USA-DeadOps' AND guild_id = 609
    `);
    
    if (usaServer.length === 0) {
      console.log('❌ USA-DeadOps server not found');
      return;
    }
    
    const usaServerId = usaServer[0].id;
    console.log(`USA-DeadOps Server ID: ${usaServerId}`);
    
    // Try to link nzcve7130 to USA-DeadOps
    try {
      await connection.execute(`
        INSERT INTO players (
          guild_id, 
          discord_id, 
          ign, 
          server_id, 
          is_active
        ) VALUES (?, ?, ?, ?, ?)
      `, [609, '1252993829007528086', 'nzcve7130', usaServerId, 1]);
      
      console.log('✅ SUCCESS: nzcve7130 linked to USA-DeadOps!');
      
      // Create economy record
      const [newPlayer] = await connection.execute(`
        SELECT id FROM players 
        WHERE guild_id = ? AND discord_id = ? AND server_id = ?
      `, [609, '1252993829007528086', usaServerId]);
      
      if (newPlayer.length > 0) {
        await connection.execute(`
          INSERT INTO economy (player_id, balance)
          VALUES (?, 0)
        `, [newPlayer[0].id]);
        console.log('✅ Economy record created for nzcve7130 on USA-DeadOps');
      }
      
    } catch (error) {
      console.log('❌ Still failed to link:', error.message);
    }

    console.log('\n🎉 Constraint fix completed!');
    console.log('You can now run the auto-linking script again.');

  } catch (error) {
    console.error('❌ Error during constraint fix:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

fixConstraint();
