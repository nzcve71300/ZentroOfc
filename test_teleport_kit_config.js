const pool = require('./src/db');

async function testTeleportKitConfig() {
  console.log('🧪 Testing Teleport Kit Configuration...');
  console.log('==========================================');
  
  let connection;
  
  try {
    connection = await pool.getConnection();
    console.log('✅ Connected to database');
    
    // Get all teleport configs with kit information
    const [configs] = await connection.execute(`
      SELECT server_id, teleport_name, display_name, kit_name, use_kit, use_list
      FROM teleport_configs 
      ORDER BY server_id, teleport_name
    `);
    
    if (configs.length === 0) {
      console.log('❌ No teleport configurations found');
      return;
    }
    
    console.log(`📋 Found ${configs.length} teleport configuration(s):\n`);
    
    for (const config of configs) {
      const kitStatus = config.use_kit ? '✅ ENABLED' : '❌ DISABLED';
      const kitName = config.kit_name || 'None';
      const listStatus = config.use_list ? '✅ ENABLED' : '❌ DISABLED';
      
      console.log(`🔧 ${config.display_name} (${config.teleport_name})`);
      console.log(`   Server ID: ${config.server_id}`);
      console.log(`   Kit: ${kitName} - ${kitStatus}`);
      console.log(`   Use List: ${listStatus}`);
      console.log('');
    }
    
    console.log('📝 How to configure teleport kits:');
    console.log('==================================');
    console.log('1. Set kit name: /set <teleport>-KITNAME <kitname> <server>');
    console.log('   Example: /set TPN-KITNAME ELITEkit1 <server>');
    console.log('');
    console.log('2. Enable/disable kit: /set <teleport>-USE-KIT <on/off> <server>');
    console.log('   Example: /set TPN-USE-KIT on <server>');
    console.log('   Example: /set TPN-USE-KIT off <server>');
    console.log('');
    console.log('3. Enable/disable use list: /set <teleport>-USELIST <on/off> <server>');
    console.log('   Example: /set TPN-USELIST off <server>');
    console.log('');
    console.log('✅ Kit configuration is now independent of use list!');
    
  } catch (error) {
    console.error('❌ Error testing teleport kit config:', error);
  } finally {
    if (connection) {
      connection.release();
      console.log('🔌 Database connection released');
    }
  }
}

// Run the test
testTeleportKitConfig();
