const pool = require('./src/db');

async function activateSubscription(guildId, allowedServers = 1) {
  try {
    console.log(`🔧 Activating subscription for guild: ${guildId}`);
    console.log(`📊 Setting allowed servers to: ${allowedServers}`);
    
    // Check if subscription already exists
    const [existingResult] = await pool.query(
      'SELECT * FROM subscriptions WHERE guild_id = ?',
      [guildId]
    );
    
    if (existingResult.length > 0) {
      // Update existing subscription
      await pool.query(
        'UPDATE subscriptions SET allowed_servers = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?',
        [allowedServers, guildId]
      );
      console.log('✅ Updated existing subscription');
    } else {
      // Create new subscription
      await pool.query(
        'INSERT INTO subscriptions (guild_id, allowed_servers, active_servers) VALUES (?, ?, 0)',
        [guildId, allowedServers]
      );
      console.log('✅ Created new subscription');
    }
    
    // Verify the change
    const [verifyResult] = await pool.query(
      'SELECT * FROM subscriptions WHERE guild_id = ?',
      [guildId]
    );
    
    if (verifyResult.length > 0) {
      const subscription = verifyResult[0];
      console.log('📊 Updated Subscription Status:');
      console.log(`   Guild ID: ${subscription.guild_id}`);
      console.log(`   Allowed Servers: ${subscription.allowed_servers}`);
      console.log(`   Active Servers: ${subscription.active_servers}`);
      console.log(`   Updated At: ${subscription.updated_at}`);
      
      if (subscription.allowed_servers > 0) {
        console.log('✅ Subscription is now ACTIVE');
        console.log('💡 You should now be able to use bot commands');
      }
    }
    
  } catch (error) {
    console.error('❌ Error activating subscription:', error);
  } finally {
    await pool.end();
  }
}

// Get guild ID and allowed servers from command line arguments
const guildId = process.argv[2];
const allowedServers = parseInt(process.argv[3]) || 1;

if (!guildId) {
  console.log('❌ Please provide a guild ID as an argument');
  console.log('Usage: node activate_subscription.js <guild_id> [allowed_servers]');
  console.log('Example: node activate_subscription.js 123456789 2');
  process.exit(1);
}

activateSubscription(guildId, allowedServers); 