const mysql = require('mysql2/promise');
const { Client, GatewayIntentBits } = require('discord.js');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function testNotefeed() {
  let connection;
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  try {
    console.log('🔍 Testing notefeed functionality...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected');
    
    // Check notefeed channel settings
    console.log('\n📋 Checking notefeed channel settings:');
    const [notefeedSettings] = await connection.execute(
      'SELECT * FROM channel_settings WHERE channel_type = "notefeed"'
    );
    
    if (notefeedSettings.length === 0) {
      console.log('❌ No notefeed channel settings found in database');
      return;
    }
    
    notefeedSettings.forEach(setting => {
      console.log(`   - Server ID: ${setting.server_id}`);
      console.log(`   - Channel ID: ${setting.channel_id}`);
      console.log(`   - Created: ${setting.created_at}`);
      console.log(`   - Updated: ${setting.updated_at}`);
    });
    
    // Connect to Discord
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Discord connected');
    
    // Test each notefeed channel
    for (const setting of notefeedSettings) {
      console.log(`\n🔍 Testing notefeed channel ${setting.channel_id}:`);
      
      try {
        const channel = await client.channels.fetch(setting.channel_id);
        if (channel) {
          console.log(`   ✅ Channel found: #${channel.name}`);
          console.log(`   - Type: ${channel.type}`);
          console.log(`   - Guild: ${channel.guild.name}`);
          
          // Test sending a message
          if (channel.isTextBased()) {
            const testEmbed = {
              color: 0xFF8C00,
              title: 'Notefeed Test',
              description: 'This is a test message to verify notefeed functionality',
              timestamp: new Date().toISOString()
            };
            
            await channel.send({ embeds: [testEmbed] });
            console.log('   ✅ Test message sent successfully');
          } else {
            console.log('   ❌ Channel is not text-based');
          }
        } else {
          console.log(`   ❌ Channel not found`);
        }
      } catch (error) {
        console.log(`   ❌ Error accessing channel: ${error.message}`);
      }
    }
    
    // Check if there are any servers without notefeed configuration
    console.log('\n📋 Checking servers without notefeed configuration:');
    const [allServers] = await connection.execute(
      'SELECT rs.id, rs.nickname, g.discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id'
    );
    
    for (const server of allServers) {
      const [hasNotefeed] = await connection.execute(
        'SELECT * FROM channel_settings WHERE server_id = ? AND channel_type = "notefeed"',
        [server.id]
      );
      
      if (hasNotefeed.length === 0) {
        console.log(`   ❌ Server "${server.nickname}" (${server.id}) has no notefeed configuration`);
      } else {
        console.log(`   ✅ Server "${server.nickname}" (${server.id}) has notefeed configuration`);
      }
    }
    
    console.log('\n✅ Notefeed test completed');
    
  } catch (error) {
    console.error('❌ Error testing notefeed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    await client.destroy();
  }
}

// Run the test
testNotefeed(); 