const pool = require('./src/db');

async function fixEmp2Server() {
  try {
    console.log('🔧 Fixing EMP2 server guild assignment...');
    
    // First, let's see what guilds exist
    const [guilds] = await pool.query('SELECT * FROM guilds ORDER BY id');
    console.log('\n📋 Available guilds:');
    guilds.forEach(guild => {
      console.log(`   ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
    });
    
    // Find the EMP2 server
    const [emp2Server] = await pool.query(
      'SELECT * FROM rust_servers WHERE nickname = ?',
      ['|EMP2|']
    );
    
    if (emp2Server.length === 0) {
      console.log('❌ EMP2 server not found');
      return;
    }
    
    const server = emp2Server[0];
    console.log(`\n📋 Current EMP2 server info:`);
    console.log(`   ID: ${server.id}`);
    console.log(`   Nickname: ${server.nickname}`);
    console.log(`   Current Guild ID: ${server.guild_id}`);
    console.log(`   IP: ${server.ip}:${server.port}`);
    
    // The correct guild should be the same as Emperor 3x (guild_id: 337)
    // Let's update EMP2 to use the same guild
    const correctGuildId = 337; // Emperor 3x guild ID
    
    console.log(`\n🔧 Updating EMP2 server to use guild ID: ${correctGuildId}`);
    
    // Start transaction
    await pool.query('START TRANSACTION');
    
    try {
      // Update the server's guild_id
      await pool.query(
        'UPDATE rust_servers SET guild_id = ? WHERE id = ?',
        [correctGuildId, server.id]
      );
      
      // Commit transaction
      await pool.query('COMMIT');
      
      console.log('✅ Successfully updated EMP2 server guild assignment!');
      
      // Verify the change
      const [updatedServer] = await pool.query(
        'SELECT rs.*, g.discord_id as guild_discord_id, g.name as guild_name FROM rust_servers rs LEFT JOIN guilds g ON rs.guild_id = g.id WHERE rs.id = ?',
        [server.id]
      );
      
      if (updatedServer.length > 0) {
        const updated = updatedServer[0];
        console.log(`\n📋 Updated EMP2 server info:`);
        console.log(`   Guild ID: ${updated.guild_id}`);
        console.log(`   Guild Discord ID: ${updated.guild_discord_id}`);
        console.log(`   Guild Name: ${updated.guild_name}`);
      }
      
      console.log('\n🎉 EMP2 server should now appear in your Discord server!');
      console.log('   Try restarting the bot or using commands that show server lists.');
      
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error fixing EMP2 server:', error);
  } finally {
    await pool.end();
  }
}

fixEmp2Server(); 