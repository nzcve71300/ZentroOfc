const pool = require('./src/db');

async function fixTeleportKitIssue() {
  console.log('🔧 Fixing Teleport Kit Issue...');
  console.log('=====================================');
  
  let connection;
  
  try {
    // Get connection from pool
    connection = await pool.getConnection();
    console.log('✅ Connected to database');
    
    // Find teleport configs where kit_name is set but use_kit is 0
    const [configs] = await connection.execute(`
      SELECT server_id, teleport_name, kit_name, use_kit, display_name
      FROM teleport_configs 
      WHERE kit_name IS NOT NULL 
      AND kit_name != '' 
      AND use_kit = 0
    `);
    
    if (configs.length === 0) {
      console.log('✅ No teleport configs found with kit_name set but use_kit disabled');
      return;
    }
    
    console.log(`📋 Found ${configs.length} teleport config(s) with kit_name but use_kit disabled:`);
    
    for (const config of configs) {
      console.log(`  - Server: ${config.server_id}, Teleport: ${config.teleport_name} (${config.display_name})`);
      console.log(`    Kit: ${config.kit_name}, Use Kit: ${config.use_kit}`);
    }
    
    console.log('\n🔧 Fixing use_kit for these configs...');
    
    // Update use_kit to 1 for all configs with kit_name set
    const [updateResult] = await connection.execute(`
      UPDATE teleport_configs 
      SET use_kit = 1 
      WHERE kit_name IS NOT NULL 
      AND kit_name != '' 
      AND use_kit = 0
    `);
    
    console.log(`✅ Updated ${updateResult.affectedRows} teleport config(s)`);
    
    // Verify the fix
    const [verifyConfigs] = await connection.execute(`
      SELECT server_id, teleport_name, kit_name, use_kit, display_name
      FROM teleport_configs 
      WHERE kit_name IS NOT NULL 
      AND kit_name != '' 
      AND use_kit = 1
    `);
    
    console.log('\n📋 Teleport configs with kits now enabled:');
    for (const config of verifyConfigs) {
      console.log(`  - Server: ${config.server_id}, Teleport: ${config.teleport_name} (${config.display_name})`);
      console.log(`    Kit: ${config.kit_name}, Use Kit: ${config.use_kit}`);
    }
    
    console.log('\n✅ Teleport kit issue fixed!');
    console.log('📝 Players will now receive kits when teleporting to these locations.');
    console.log('💡 You can now use /set <teleport>-USE-KIT <on/off> <server> to control kit delivery independently.');
    
  } catch (error) {
    console.error('❌ Error fixing teleport kit issue:', error);
  } finally {
    if (connection) {
      connection.release();
      console.log('🔌 Database connection released');
    }
  }
}

// Run the fix
fixTeleportKitIssue();
