const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { cleanupZorpDuplicates } = require('../../rcon');
const pool = require('../../db');
const WebSocket = require('ws');

// Server-specific cleanup function
async function cleanupZorpDuplicatesForServer(server) {
  try {
    console.log(`🧹 [ZORP CLEANUP] Starting cleanup for server: ${server.nickname}`);
    
    let duplicatesRemoved = 0;
    let orphanedRemoved = 0;
    let missingAdded = 0;
    
    // Get zones from game server
    const gameZones = await getZonesFromGameServer(server);
    console.log(`   🎮 Found ${gameZones.length} zones in game`);
    
    // Get zones from database
    const [dbZones] = await pool.query(
      'SELECT id, name, owner FROM zorp_zones WHERE server_id = ?',
      [server.id]
    );
    console.log(`   📊 Found ${dbZones.length} zones in database`);
    
    // Find duplicates in database (same name)
    const zoneCounts = {};
    const duplicates = [];
    
    for (const zone of dbZones) {
      if (zoneCounts[zone.name]) {
        zoneCounts[zone.name].push(zone);
        if (zoneCounts[zone.name].length === 2) {
          duplicates.push(zoneCounts[zone.name]);
        }
      } else {
        zoneCounts[zone.name] = [zone];
      }
    }
    
    console.log(`   🔍 Found ${duplicates.length} duplicate zone names`);
    
    // Remove duplicates (keep the most recent one)
    for (const duplicateGroup of duplicates) {
      console.log(`   🗑️  Removing duplicates for zone: ${duplicateGroup[0].name}`);
      
      // Sort by ID (assuming higher ID = more recent)
      duplicateGroup.sort((a, b) => a.id - b.id);
      
      // Keep the last one, delete the rest
      const toKeep = duplicateGroup.pop();
      const toDelete = duplicateGroup;
      
      for (const zone of toDelete) {
        await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
        console.log(`      ❌ Deleted duplicate zone ID: ${zone.id}`);
        duplicatesRemoved++;
      }
      
      console.log(`      ✅ Kept zone ID: ${toKeep.id}`);
    }
    
    // Remove zones from database that don't exist in game
    const gameZoneNames = new Set(gameZones);
    const zonesToRemove = [];
    
    for (const zone of dbZones) {
      if (!gameZoneNames.has(zone.name)) {
        zonesToRemove.push(zone);
      }
    }
    
    console.log(`   🧹 Found ${zonesToRemove.length} zones in database but not in game`);
    
    for (const zone of zonesToRemove) {
      await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
      console.log(`      🗑️  Removed orphaned zone: ${zone.name} (ID: ${zone.id})`);
      orphanedRemoved++;
    }
    
    // Add zones to database that exist in game but not in database
    const dbZoneNames = new Set(dbZones.map(z => z.name));
    const zonesToAdd = [];
    
    for (const zoneName of gameZones) {
      if (!dbZoneNames.has(zoneName)) {
        zonesToAdd.push(zoneName);
      }
    }
    
    console.log(`   ➕ Found ${zonesToAdd.length} zones in game but not in database`);
    
    for (const zoneName of zonesToAdd) {
      // Extract owner from zone name (assuming format: ZORP_PlayerName)
      const owner = zoneName.replace('ZORP_', '') || 'Unknown';
      
      await pool.query(
        'INSERT INTO zorp_zones (name, owner, server_id, created_at, expire) VALUES (?, ?, ?, NOW(), 86400)',
        [zoneName, owner, server.id]
      );
      console.log(`      ➕ Added missing zone: ${zoneName} (owner: ${owner})`);
      missingAdded++;
    }
    
    console.log(`   ✅ Server ${server.nickname} processed successfully`);
    
    return {
      duplicatesRemoved,
      orphanedRemoved,
      missingAdded,
      totalOperations: duplicatesRemoved + orphanedRemoved + missingAdded
    };
    
  } catch (error) {
    console.error(`   ❌ Error processing server ${server.nickname}:`, error.message);
    throw error;
  }
}

async function getZonesFromGameServer(server) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve([]); // Return empty array on timeout
    }, 10000); // 10 second timeout
    
    ws.on('open', () => {
      const zonesCommand = JSON.stringify({ 
        Identifier: 1, 
        Message: 'zones.listcustomzones', 
        Name: 'WebRcon' 
      });
      ws.send(zonesCommand);
    });
    
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.Message) {
          const zones = parsed.Message.split('\n').filter(line => line.trim());
          
          // Extract ZORP zones
          const zorpZones = zones.filter(zone => zone.includes('ZORP_'));
          
          // Extract zone names
          const gameZoneNames = zorpZones.map(zone => {
            const match = zone.match(/Name \[([^\]]+)\]/);
            return match ? match[1] : null;
          }).filter(name => name);
          
          clearTimeout(timeout);
          ws.close();
          resolve(gameZoneNames);
        }
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        resolve([]); // Return empty array on error
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      ws.close();
      resolve([]); // Return empty array on error
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleanup-zorps')
    .setDescription('Clean up duplicate and orphaned ZORP zones in the database')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to cleanup ZORPs for')
        .setRequired(true)
        .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    
    try {
      // Get all servers for this guild
      const [servers] = await pool.query(`
        SELECT rs.nickname 
        FROM rust_servers rs
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = ?
        ORDER BY rs.nickname
      `, [interaction.guildId]);

      const filtered = servers
        .filter(server => server.nickname.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25)
        .map(server => ({
          name: server.nickname,
          value: server.nickname
        }));

      await interaction.respond(filtered);
    } catch (error) {
      console.error('Error in cleanup-zorps autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    console.log(`🧹 CLEANUP-ZORPS: Admin ${interaction.user.id} triggered ZORP cleanup`);
    
    try {
      await interaction.deferReply({ flags: 64 });
      
      if (!hasAdminPermissions(interaction.member)) {
        return sendAccessDeniedMessage(interaction, false);
      }

      const serverName = interaction.options.getString('server');
      console.log(`🧹 CLEANUP-ZORPS: Starting cleanup for server: ${serverName}`);
      
      // Get server info
      const [serverResult] = await pool.query(`
        SELECT rs.id, rs.nickname, rs.ip, rs.port, rs.password
        FROM rust_servers rs
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = ? AND rs.nickname = ?
      `, [interaction.guildId, serverName]);

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', `The server "${serverName}" was not found.`)]
        });
      }

      const server = serverResult[0];
      
      // Run server-specific cleanup
      const cleanupResult = await cleanupZorpDuplicatesForServer(server);
      
      const embed = successEmbed(
        'ZORP Cleanup Complete', 
        `✅ **ZORP cleanup completed for ${serverName}!**\n\n` +
        `**Results:**\n` +
        `• Duplicates removed: ${cleanupResult.duplicatesRemoved}\n` +
        `• Orphaned zones removed: ${cleanupResult.orphanedRemoved}\n` +
        `• Missing zones added: ${cleanupResult.missingAdded}\n` +
        `• Total operations: ${cleanupResult.totalOperations}\n\n` +
        'Check the console logs for detailed information about what was cleaned up.'
      );
      
      await interaction.editReply({ embeds: [embed] });
      
      console.log(`🧹 CLEANUP-ZORPS: Cleanup completed for ${serverName}`);

    } catch (error) {
      console.error('❌ CLEANUP-ZORPS: Error in cleanup-zorps command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', '❌ **Error:** Failed to cleanup ZORP zones. Please check the console logs for details.')]
      });
    }
  }
};
