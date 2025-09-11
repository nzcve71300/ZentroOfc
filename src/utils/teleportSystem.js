const mysql = require('mysql2/promise');
require('dotenv').config();

class TeleportSystem {
  constructor() {
    this.activeTeleports = new Map(); // Track active teleport requests
  }

  async handleTeleportRequest(playerName, serverId, serverIp, serverPort, serverPassword, teleportName = 'default') {
    try {
      console.log(`[TELEPORT SYSTEM] Starting teleport request for ${playerName} on server ${serverId}`);
      
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      // Get teleport configuration
      console.log(`[TELEPORT SYSTEM] Querying config for server ${serverId}, teleport: ${teleportName}`);
      const [configs] = await connection.execute(`
        SELECT * FROM teleport_configs 
        WHERE server_id = ? AND teleport_name = ?
      `, [serverId.toString(), teleportName]);
      
      console.log(`[TELEPORT SYSTEM] Found ${configs.length} configs`);

      if (configs.length === 0) {
        await connection.end();
        return { success: false, message: 'No teleport configuration found.' };
      }

      const config = configs[0];

      // Check if teleport system is enabled
      if (!config.enabled) {
        await connection.end();
        return { success: false, message: 'Teleport system is disabled.' };
      }

      // Get player info (optional - player can use teleport without being linked)
      console.log(`[TELEPORT SYSTEM] Looking up player ${playerName} on server ${serverId}`);
      const [players] = await connection.execute(`
        SELECT discord_id, ign FROM players 
        WHERE ign = ? AND server_id = ?
      `, [playerName, serverId.toString()]);
      
      console.log(`[TELEPORT SYSTEM] Found ${players.length} players`);

      const discordId = players.length > 0 ? players[0].discord_id : null;
      console.log(`[TELEPORT SYSTEM] Player ${playerName} - Discord ID: ${discordId || 'Not linked'}`);

      // Check if player is banned
      if (config.use_list) {
        const [banned] = await connection.execute(`
          SELECT * FROM teleport_banned_users 
          WHERE server_id = ? AND teleport_name = ? 
          AND (discord_id = ? OR ign = ?)
        `, [serverId.toString(), teleportName, discordId, playerName]);

        if (banned.length > 0) {
          await connection.end();
          return { success: false, message: 'You are banned from using teleports.' };
        }

        // Check if player is allowed
        const [allowed] = await connection.execute(`
          SELECT * FROM teleport_allowed_users 
          WHERE server_id = ? AND teleport_name = ? 
          AND (discord_id = ? OR ign = ?)
        `, [serverId.toString(), teleportName, discordId, playerName]);

        if (allowed.length === 0) {
          await connection.end();
          return { success: false, message: 'You are not allowed to use teleports.' };
        }
      }

      // Check cooldown - use Discord ID if available, otherwise use IGN for unlinked players
      const cooldownIdentifier = discordId || playerName;
      const [lastUsage] = await connection.execute(`
        SELECT used_at FROM teleport_usage 
        WHERE server_id = ? AND teleport_name = ? AND (discord_id = ? OR (discord_id IS NULL AND ign = ?))
        ORDER BY used_at DESC LIMIT 1
      `, [serverId.toString(), teleportName, discordId, playerName]);

      if (lastUsage.length > 0) {
        const lastUsed = new Date(lastUsage[0].used_at);
        const now = new Date();
        const minutesSinceLastUse = (now - lastUsed) / (1000 * 60);
        
        if (minutesSinceLastUse < config.cooldown_minutes) {
          const remainingMinutes = Math.ceil(config.cooldown_minutes - minutesSinceLastUse);
          await connection.end();
          return { 
            success: false, 
            message: `Teleport cooldown: ${remainingMinutes} minutes remaining.` 
          };
        }
      }

      // Record usage
      await connection.execute(`
        INSERT INTO teleport_usage (server_id, teleport_name, discord_id, ign)
        VALUES (?, ?, ?, ?)
      `, [serverId.toString(), teleportName, discordId, playerName]);

      await connection.end();

      // Return teleport commands
      const commands = [];
      
      // Kill player if enabled
      if (config.kill_before_teleport) {
        commands.push(`global.killplayer "${playerName}"`);
      }

      // Teleport command
      const teleportCommand = `global.teleportposrot "${config.position_x},${config.position_y},${config.position_z}" "${playerName}" "1"`;
      commands.push(teleportCommand);
      console.log(`[TELEPORT SYSTEM] Generated teleport command: ${teleportCommand}`);

      // Give kit if enabled
      if (config.use_kit && config.kit_name) {
        commands.push(`kit givetoplayer ${config.kit_name} ${playerName}`);
      }

      console.log(`[TELEPORT SYSTEM] Returning success with ${commands.length} commands`);
      return {
        success: true,
        commands: commands,
        displayName: config.display_name || 'Teleport Location'
      };

    } catch (error) {
      console.error('Error in teleport system:', error);
      return { success: false, message: 'An error occurred while processing teleport.' };
    }
  }

  async getTeleportConfig(serverId) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      const [configs] = await connection.execute(`
        SELECT * FROM teleport_configs 
        WHERE server_id = ? AND teleport_name = 'default'
      `, [serverId]);

      await connection.end();
      return configs.length > 0 ? configs[0] : null;

    } catch (error) {
      console.error('Error getting teleport config:', error);
      return null;
    }
  }
}

module.exports = new TeleportSystem();
