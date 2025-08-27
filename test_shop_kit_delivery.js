const pool = require('./src/db');

async function testShopKitDelivery() {
  console.log('🧪 Testing Shop Kit Delivery System...');
  console.log('==========================================');
  
  let connection;
  
  try {
    connection = await pool.getConnection();
    console.log('✅ Connected to database');
    
    // Check if kit_delivery_queue table exists
    const [tableResult] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'kit_delivery_queue'
    `);
    
    if (tableResult[0].count === 0) {
      console.log('❌ kit_delivery_queue table does not exist!');
      console.log('💡 Run the deploy_kit_delivery_system.js script to create it.');
      return;
    }
    
    console.log('✅ kit_delivery_queue table exists');
    
    // Check current delivery queue
    const [queueResult] = await connection.execute(`
      SELECT 
        kdq.id,
        kdq.player_id,
        kdq.kit_name,
        kdq.display_name,
        kdq.remaining_quantity,
        kdq.original_quantity,
        kdq.created_at,
        p.ign as player_name
      FROM kit_delivery_queue kdq
      LEFT JOIN players p ON kdq.player_id = p.id
      WHERE kdq.remaining_quantity > 0
      ORDER BY kdq.created_at DESC
      LIMIT 10
    `);
    
    if (queueResult.length === 0) {
      console.log('📋 No pending kit deliveries in queue');
    } else {
      console.log(`📋 Found ${queueResult.length} pending kit delivery(ies):\n`);
      
      for (const delivery of queueResult) {
        const timeAgo = Math.floor((Date.now() - new Date(delivery.created_at)) / (1000 * 60));
        console.log(`🔧 Delivery ID: ${delivery.id}`);
        console.log(`   Player: ${delivery.player_name || 'Unknown'} (ID: ${delivery.player_id})`);
        console.log(`   Kit: ${delivery.display_name} (${delivery.kit_name})`);
        console.log(`   Quantity: ${delivery.remaining_quantity}/${delivery.original_quantity} remaining`);
        console.log(`   Created: ${timeAgo} minutes ago`);
        console.log('');
      }
    }
    
    // Check shop kits configuration
    const [shopKitsResult] = await connection.execute(`
      SELECT 
        sk.id,
        sk.display_name,
        sk.kit_name,
        sk.price,
        sk.quantity,
        sk.timer,
        sc.name as category_name,
        rs.nickname as server_name
      FROM shop_kits sk
      JOIN shop_categories sc ON sk.category_id = sc.id
      JOIN rust_servers rs ON sc.server_id = rs.id
      ORDER BY rs.nickname, sc.name, sk.display_name
    `);
    
    if (shopKitsResult.length === 0) {
      console.log('❌ No shop kits configured');
    } else {
      console.log(`📋 Found ${shopKitsResult.length} shop kit(s) configured:\n`);
      
      for (const kit of shopKitsResult) {
        console.log(`🛒 ${kit.display_name} (${kit.kit_name})`);
        console.log(`   Server: ${kit.server_name}`);
        console.log(`   Category: ${kit.category_name}`);
        console.log(`   Price: ${kit.price}`);
        console.log(`   Quantity: ${kit.quantity}`);
        console.log(`   Timer: ${kit.timer || 'None'} minutes`);
        console.log('');
      }
    }
    
    console.log('📝 How the Shop Kit Delivery System Works:');
    console.log('==========================================');
    console.log('1. Player purchases a kit from /shop');
    console.log('2. Kit is added to kit_delivery_queue table');
    console.log('3. Player receives message: "Use the Here take this emote to claim each kit!"');
    console.log('4. Player uses "Here take this" emote in-game');
    console.log('5. Kit is delivered via RCON command');
    console.log('6. Queue entry is updated/deleted');
    console.log('');
    console.log('✅ Shop kit delivery system is ready!');
    console.log('💡 Players must use the "Here take this" emote to claim their purchased kits.');
    
  } catch (error) {
    console.error('❌ Error testing shop kit delivery:', error);
  } finally {
    if (connection) {
      connection.release();
      console.log('🔌 Database connection released');
    }
  }
}

// Run the test
testShopKitDelivery();
