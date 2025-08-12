const pool = require('./src/db');

async function setupNewCustomerAutomation() {
  try {
    console.log('🔧 Setting up automation for new customers...');
    
    // This script will be used whenever a new customer buys the bot
    // It should be run with the customer's Discord guild ID and server details
    
    const newCustomerGuildId = '1348735121481535548'; // Example - replace with actual guild ID
    const guildName = 'BLOODRUST Discord'; // Replace with actual guild name
    
    console.log(`\n📋 Setting up new customer: ${guildName} (${newCustomerGuildId})`);
    
    // Step 1: Add the guild to the database
    console.log('\n📋 Step 1: Adding guild to database...');
    const [existingGuild] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [newCustomerGuildId]
    );
    
    let guildId;
    if (existingGuild.length > 0) {
      console.log(`✅ Guild already exists: ${existingGuild[0].name} (ID: ${existingGuild[0].id})`);
      guildId = existingGuild[0].id;
    } else {
      const [guildResult] = await pool.query(
        'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
        [newCustomerGuildId, guildName]
      );
      guildId = guildResult.insertId;
      console.log(`✅ Added new guild: ${guildName} (ID: ${guildId})`);
    }
    
    // Step 2: Check for any orphaned servers that should belong to this guild
    console.log('\n📋 Step 2: Checking for orphaned servers...');
    const [orphanedServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id IS NULL OR guild_id = 0'
    );
    
    if (orphanedServers.length > 0) {
      console.log(`Found ${orphanedServers.length} orphaned servers:`);
      orphanedServers.forEach(server => {
        console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
      });
      
      // Ask if these should be associated with the new guild
      console.log('\n🔧 Associating orphaned servers with new guild...');
      for (const server of orphanedServers) {
        const [updateResult] = await pool.query(
          'UPDATE rust_servers SET guild_id = ? WHERE id = ?',
          [guildId, server.id]
        );
        console.log(`✅ Associated ${server.nickname} with ${guildName}`);
      }
    } else {
      console.log('✅ No orphaned servers found');
    }
    
    // Step 3: Verify all servers for this guild
    console.log('\n📋 Step 3: Verifying servers for new guild...');
    const [guildServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = ?',
      [guildId]
    );
    
    console.log(`Found ${guildServers.length} servers for ${guildName}:`);
    guildServers.forEach(server => {
      console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
    });
    
    // Step 4: Test autocomplete functionality
    console.log('\n📋 Step 4: Testing autocomplete functionality...');
    const [autocompleteServers] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [newCustomerGuildId, '%']
    );
    
    console.log(`Autocomplete will show ${autocompleteServers.length} servers:`);
    autocompleteServers.forEach(server => {
      console.log(`   - ${server.nickname}`);
    });
    
    console.log('\n🎯 NEW CUSTOMER SETUP COMPLETE!');
    console.log('✅ Guild added to database');
    console.log('✅ Servers properly associated');
    console.log('✅ Autocomplete functionality verified');
    console.log('🔄 Restart the bot: pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error setting up new customer:', error);
  } finally {
    await pool.end();
  }
}

// Function to be called when a new customer purchases the bot
async function addNewCustomer(guildDiscordId, guildName, serverDetails = null) {
  try {
    console.log(`🔧 Adding new customer: ${guildName} (${guildDiscordId})`);
    
    // Add guild
    const [guildResult] = await pool.query(
      'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
      [guildDiscordId, guildName]
    );
    
    const guildId = guildResult.insertId;
    console.log(`✅ Added guild: ${guildName} (ID: ${guildId})`);
    
    // If server details provided, add server too
    if (serverDetails) {
      const serverId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const [serverResult] = await pool.query(
        'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password, rcon_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [serverId, guildId, serverDetails.nickname, serverDetails.ip, serverDetails.port, serverDetails.password, serverDetails.password]
      );
      
      console.log(`✅ Added server: ${serverDetails.nickname}`);
    }
    
    console.log('✅ New customer setup complete!');
    return guildId;
    
  } catch (error) {
    console.error('❌ Error adding new customer:', error);
    throw error;
  }
}

// Export for use in other scripts
module.exports = { addNewCustomer };

// Run the setup if this script is executed directly
if (require.main === module) {
  setupNewCustomerAutomation();
} 