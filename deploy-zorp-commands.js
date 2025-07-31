const { REST, Routes } = require('discord.js');
require('dotenv').config();

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

async function deployCommands() {
  try {
    console.log('🔄 Deploying Zorp commands...');
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    // Deploy to all guilds
    const guildId = process.env.GUILD_ID;
    if (guildId) {
      console.log(`📋 Deploying to guild: ${guildId}`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands }
      );
      console.log('✅ Zorp commands deployed successfully!');
    } else {
      console.log('❌ GUILD_ID not found in environment variables');
    }
    
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

deployCommands(); 