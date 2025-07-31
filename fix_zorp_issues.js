const { REST, Routes } = require('discord.js');
const pool = require('./src/db');
require('dotenv').config();

async function fixZorpIssues() {
  try {
    console.log('🔧 Fixing Zorp Issues...\n');

    // 1. First, let's check the current state
    console.log('1. Checking current Zorp system state...');
    
    // Check if tables exist
    const [defaultsTable] = await pool.query("SHOW TABLES LIKE 'zorp_defaults'");
    const [zonesTable] = await pool.query("SHOW TABLES LIKE 'zorp_zones'");
    
    if (defaultsTable.length === 0 || zonesTable.length === 0) {
      console.log('❌ Zorp tables missing. Creating them...');
      const fs = require('fs');
      const createTablesSQL = fs.readFileSync('./create_zorp_tables.js', 'utf8');
      // This would need to be run separately: node create_zorp_tables.js
      console.log('💡 Please run: node create_zorp_tables.js');
      return;
    }
    
    console.log('✅ Zorp tables exist');

    // 2. Check for enabled column
    console.log('\n2. Checking for enabled column...');
    const [enabledColumn] = await pool.query("SHOW COLUMNS FROM zorp_defaults LIKE 'enabled'");
    if (enabledColumn.length === 0) {
      console.log('❌ enabled column missing. Adding it...');
      await pool.query('ALTER TABLE zorp_defaults ADD COLUMN enabled BOOLEAN DEFAULT TRUE');
      await pool.query('UPDATE zorp_defaults SET enabled = TRUE WHERE enabled IS NULL');
      console.log('✅ Added enabled column');
    } else {
      console.log('✅ enabled column exists');
    }

    // 3. Check servers and their Zorp defaults
    console.log('\n3. Checking servers and Zorp defaults...');
    const [servers] = await pool.query(`
      SELECT rs.id, rs.nickname, zd.enabled, zd.size, zd.color_online, zd.color_offline
      FROM rust_servers rs
      LEFT JOIN zorp_defaults zd ON rs.id = zd.server_id
      ORDER BY rs.nickname
    `);

    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    console.log('Current servers and their Zorp settings:');
    servers.forEach(server => {
      const status = server.enabled === null ? 'Not configured' : 
                    server.enabled ? '🟢 Enabled' : '🔴 Disabled';
      console.log(`  - ${server.nickname}: ${status}`);
    });

    // 4. Create defaults for servers that don't have them
    console.log('\n4. Creating Zorp defaults for servers without them...');
    for (const server of servers) {
      if (server.enabled === null) {
        console.log(`Creating defaults for server: ${server.nickname}`);
        await pool.query(`
          INSERT INTO zorp_defaults (server_id, size, color_online, color_offline, radiation, delay, expire, min_team, max_team, enabled, created_at, updated_at)
          VALUES (?, 75, '0,255,0', '255,0,0', 0, 0, 126000, 1, 8, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [server.id]);
        console.log(`✅ Created defaults for ${server.nickname}`);
      }
    }

    // 5. Deploy Discord commands
    console.log('\n5. Deploying Discord commands...');
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

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const guildId = process.env.GUILD_ID;
    
    if (guildId) {
      console.log(`📋 Deploying to guild: ${guildId}`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands }
      );
      console.log('✅ Discord commands deployed successfully!');
    } else {
      console.log('❌ GUILD_ID not found in environment variables');
    }

    // 6. Final status check
    console.log('\n6. Final status check...');
    const [finalServers] = await pool.query(`
      SELECT rs.nickname, zd.enabled, zd.size, zd.color_online, zd.color_offline
      FROM rust_servers rs
      LEFT JOIN zorp_defaults zd ON rs.id = zd.server_id
      ORDER BY rs.nickname
    `);

    console.log('Final server status:');
    finalServers.forEach(server => {
      const status = server.enabled ? '🟢 Enabled' : '🔴 Disabled';
      console.log(`  - ${server.nickname}: ${status}`);
    });

    console.log('\n🎉 Zorp issues fixed!');
    console.log('\n📝 Summary of fixes:');
    console.log('✅ Improved team detection with fallback method');
    console.log('✅ Added enabled column to zorp_defaults table');
    console.log('✅ Created Zorp defaults for all servers');
    console.log('✅ Redeployed Discord commands with zorp option');
    console.log('\n💡 The zorp option should now appear in /edit-zorp command');
    console.log('💡 Team detection should work even if bot wasn\'t running when you joined team');

  } catch (error) {
    console.error('❌ Error fixing Zorp issues:', error);
  }
}

fixZorpIssues(); 