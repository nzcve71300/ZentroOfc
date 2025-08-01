const pool = require('./src/db');

async function checkSubscriptionStatus(guildId) {
  try {
    console.log(`🔍 Checking subscription status for guild: ${guildId}`);
    
    // Check if guild exists in subscriptions table
    const [subscriptionResult] = await pool.query(
      'SELECT * FROM subscriptions WHERE guild_id = ?',
      [guildId]
    );
    
    if (subscriptionResult.length === 0) {
      console.log('❌ Guild not found in subscriptions table');
      console.log('💡 This means the subscription needs to be initialized');
      return;
    }
    
    const subscription = subscriptionResult[0];
    console.log('📊 Subscription Status:');
    console.log(`   Guild ID: ${subscription.guild_id}`);
    console.log(`   Allowed Servers: ${subscription.allowed_servers}`);
    console.log(`   Active Servers: ${subscription.active_servers}`);
    console.log(`   Updated At: ${subscription.updated_at}`);
    
    if (subscription.allowed_servers > 0) {
      console.log('✅ Subscription is ACTIVE');
    } else {
      console.log('❌ Subscription is INACTIVE (allowed_servers = 0)');
      console.log('💡 Contact the bot owner to activate your subscription');
    }
    
    // Check if guild exists in guilds table (legacy)
    const [guildResult] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guildResult.length > 0) {
      console.log('📋 Guild found in legacy guilds table');
    } else {
      console.log('📋 Guild not found in legacy guilds table');
    }
    
  } catch (error) {
    console.error('❌ Error checking subscription status:', error);
  } finally {
    await pool.end();
  }
}

// Get guild ID from command line argument
const guildId = process.argv[2];

if (!guildId) {
  console.log('❌ Please provide a guild ID as an argument');
  console.log('Usage: node check_subscription_status.js <guild_id>');
  process.exit(1);
}

checkSubscriptionStatus(guildId); 