const mysql = require('mysql2/promise');
const { Client, GatewayIntentBits } = require('discord.js');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function simulateNotefeed() {
  let connection;
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  try {
    console.log('🔍 Simulating notefeed message...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected');
    
    // Get the first server with notefeed configuration
    const [notefeedSettings] = await connection.execute(
      `SELECT cs.*, rs.nickname, g.discord_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE cs.channel_type = "notefeed" 
       LIMIT 1`
    );
    
    if (notefeedSettings.length === 0) {
      console.log('❌ No notefeed channel settings found');
      return;
    }
    
    const setting = notefeedSettings[0];
    console.log(`📋 Using server: ${setting.nickname}`);
    console.log(`📋 Channel ID: ${setting.channel_id}`);
    console.log(`📋 Guild ID: ${setting.discord_id}`);
    
    // Connect to Discord
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Discord connected');
    
    // Test the sendFeedEmbed function directly
    const { sendFeedEmbed } = require('./src/rcon/index.js');
    
    // Simulate a note panel message
    const testMessage = `**TestPlayer** says: This is a test note message to verify notefeed functionality is working!`;
    
    console.log(`📝 Sending test message: ${testMessage}`);
    
    await sendFeedEmbed(client, setting.discord_id, setting.nickname, 'notefeed', testMessage);
    
    console.log('✅ Test message sent successfully');
    
  } catch (error) {
    console.error('❌ Error simulating notefeed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    await client.destroy();
  }
}

// Run the simulation
simulateNotefeed(); 