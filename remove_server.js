const pool = require('./src/db');

async function removeServer() {
  try {
    console.log('🔍 Looking for server with IP 81.0.247.39 and port 29816...');
    
    // First, let's find the server
    const [servers] = await pool.query(
      'SELECT * FROM rust_servers WHERE ip = ? AND port = ?',
      ['81.0.247.39', 29816]
    );
    
    if (servers.length === 0) {
      console.log('❌ No server found with IP 81.0.247.39 and port 29816');
      return;
    }
    
    const server = servers[0];
    console.log('📋 Found server:');
    console.log(`   ID: ${server.id}`);
    console.log(`   Nickname: ${server.nickname}`);
    console.log(`   IP: ${server.ip}`);
    console.log(`   Port: ${server.port}`);
    console.log(`   Guild ID: ${server.guild_id}`);
    
    // Check what data will be affected
    console.log('\n🔍 Checking related data...');
    
    // Check players linked to this server
    const [players] = await pool.query(
      'SELECT COUNT(*) as count FROM players WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Players linked to this server: ${players[0].count}`);
    
    // Check economy data
    const [economy] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM economy e 
      JOIN players p ON e.player_id = p.id 
      WHERE p.server_id = ?
    `, [server.id]);
    console.log(`   Economy records: ${economy[0].count}`);
    
    // Check shop data
    const [shopItems] = await pool.query(
      'SELECT COUNT(*) as count FROM shop_items WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Shop items: ${shopItems[0].count}`);
    
    const [shopKits] = await pool.query(
      'SELECT COUNT(*) as count FROM shop_kits WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Shop kits: ${shopKits[0].count}`);
    
    // Check other related data
    const [zones] = await pool.query(
      'SELECT COUNT(*) as count FROM zones WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Zones: ${zones[0].count}`);
    
    const [transactions] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM transactions t 
      JOIN players p ON t.player_id = p.id 
      WHERE p.server_id = ?
    `, [server.id]);
    console.log(`   Transactions: ${transactions[0].count}`);
    
    console.log('\n⚠️  WARNING: This will permanently delete all data related to this server!');
    console.log('   This includes:');
    console.log('   - All player links');
    console.log('   - All economy balances');
    console.log('   - All shop items and kits');
    console.log('   - All zones');
    console.log('   - All transactions');
    console.log('   - The server configuration itself');
    
    console.log('\n🔧 Proceeding with server removal...');
    
    // Start transaction
    await pool.query('START TRANSACTION');
    
    try {
      // Delete related data first (due to foreign key constraints)
      
      // Delete transactions
      await pool.query(`
        DELETE t FROM transactions t 
        JOIN players p ON t.player_id = p.id 
        WHERE p.server_id = ?
      `, [server.id]);
      console.log('✅ Deleted transactions');
      
      // Delete economy records
      await pool.query(`
        DELETE e FROM economy e 
        JOIN players p ON e.player_id = p.id 
        WHERE p.server_id = ?
      `, [server.id]);
      console.log('✅ Deleted economy records');
      
      // Delete players
      await pool.query('DELETE FROM players WHERE server_id = ?', [server.id]);
      console.log('✅ Deleted players');
      
      // Delete shop items
      await pool.query('DELETE FROM shop_items WHERE server_id = ?', [server.id]);
      console.log('✅ Deleted shop items');
      
      // Delete shop kits
      await pool.query('DELETE FROM shop_kits WHERE server_id = ?', [server.id]);
      console.log('✅ Deleted shop kits');
      
      // Delete shop categories
      await pool.query('DELETE FROM shop_categories WHERE server_id = ?', [server.id]);
      console.log('✅ Deleted shop categories');
      
      // Delete zones
      await pool.query('DELETE FROM zones WHERE server_id = ?', [server.id]);
      console.log('✅ Deleted zones');
      
      // Delete channel settings
      await pool.query('DELETE FROM channel_settings WHERE server_id = ?', [server.id]);
      console.log('✅ Deleted channel settings');
      
      // Delete position coordinates
      await pool.query('DELETE FROM position_coordinates WHERE server_id = ?', [server.id]);
      console.log('✅ Deleted position coordinates');
      
      // Delete link requests
      await pool.query('DELETE FROM link_requests WHERE server_id = ?', [server.id]);
      console.log('✅ Deleted link requests');
      
      // Finally, delete the server itself
      await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
      console.log('✅ Deleted server configuration');
      
      // Commit transaction
      await pool.query('COMMIT');
      
      console.log('\n🎉 Server successfully removed!');
      console.log(`   Server "${server.nickname}" (${server.ip}:${server.port}) has been completely removed from the database.`);
      console.log('\n📝 Next steps:');
      console.log('   1. Add this server to your main bot using the server setup commands');
      console.log('   2. Configure the server settings in your main bot');
      console.log('   3. The server will now be managed from your main Discord server');
      
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error removing server:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
removeServer(); 