const { REST, Routes } = require('discord.js');
require('dotenv').config();

async function deployZorpCommands() {
  try {
    console.log('🔄 Deploying Zorp commands...');
    
    // You'll need to replace these with your actual values
    const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
    const CLIENT_ID = process.env.CLIENT_ID;
    const GUILD_ID = process.env.GUILD_ID;
    
    if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
      console.log('❌ Missing environment variables:');
      console.log(`DISCORD_TOKEN: ${DISCORD_TOKEN ? '✅' : '❌'}`);
      console.log(`CLIENT_ID: ${CLIENT_ID ? '✅' : '❌'}`);
      console.log(`GUILD_ID: ${GUILD_ID ? '✅' : '❌'}`);
      console.log('\n💡 Please check your .env file or set these values manually');
      return;
    }
    
    const commands = [
      {
        name: 'edit-zorp',
        description: 'Edit ZORP zone configuration for a server',
        options: [
          {
            name: 'server',
            description: 'Select the server to update zones for',
            type: 3, // STRING
            required: true,
            autocomplete: true
          },
          {
            name: 'size',
            description: 'Zone size (default: 75)',
            type: 4, // INTEGER
            required: false
          },
          {
            name: 'color_online',
            description: 'Online color (R,G,B format, default: 0,255,0)',
            type: 3, // STRING
            required: false
          },
          {
            name: 'color_offline',
            description: 'Offline color (R,G,B format, default: 255,0,0)',
            type: 3, // STRING
            required: false
          },
          {
            name: 'radiation',
            description: 'Radiation level (default: 0)',
            type: 4, // INTEGER
            required: false
          },
          {
            name: 'delay',
            description: 'Delay in seconds (default: 0)',
            type: 4, // INTEGER
            required: false
          },
          {
            name: 'expire',
            description: 'Expiration time in hours (default: 35 hours)',
            type: 4, // INTEGER
            required: false
          },
          {
            name: 'min_team',
            description: 'Minimum team size (default: 1)',
            type: 4, // INTEGER
            required: false
          },
          {
            name: 'max_team',
            description: 'Maximum team size (default: 8)',
            type: 4, // INTEGER
            required: false
          },
          {
            name: 'zorp',
            description: 'Enable or disable ZORP system (default: true)',
            type: 5, // BOOLEAN
            required: false
          }
        ]
      },
      {
        name: 'delete-zorp',
        description: 'Delete a ZORP zone',
        options: [
          {
            name: 'zone_name',
            description: 'Name of the zone to delete',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'list-zones',
        description: 'List all active ZORP zones',
        options: [
          {
            name: 'server',
            description: 'Select the server to list zones for',
            type: 3, // STRING
            required: true,
            autocomplete: true
          }
        ]
      }
    ];

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    
    console.log(`📋 Deploying to guild: ${GUILD_ID}`);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Discord commands deployed successfully!');
    console.log('\n💡 The zorp option should now appear in /edit-zorp command');

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

deployZorpCommands(); 