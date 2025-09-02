const pool = require('../db');

/**
 * Automatically links all existing players from other servers in the same guild to a new server
 * @param {string} guildDiscordId - The Discord guild ID
 * @param {string} newServerId - The ID of the newly added server
 * @param {string} newServerNickname - The nickname of the newly added server
 * @returns {Promise<{success: boolean, linkedCount: number, errors: string[]}>}
 */
async function autoLinkPlayersToNewServer(guildDiscordId, newServerId, newServerNickname) {
  const result = {
    success: true,
    linkedCount: 0,
    errors: []
  };

  try {
    console.log(`🔗 Auto-linking players to new server: ${newServerNickname} in guild ${guildDiscordId}`);

    // Get the guild ID from the database
    const [guildResult] = await pool.query(
      'SELECT id FROM guilds WHERE discord_id = ?',
      [guildDiscordId]
    );

    if (guildResult.length === 0) {
      console.log(`❌ Guild not found for Discord ID: ${guildDiscordId}`);
      result.success = false;
      result.errors.push('Guild not found in database');
      return result;
    }

    const guildId = guildResult[0].id;

    // Get all servers in this guild (excluding the new one)
    const [existingServers] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = ? AND id != ?',
      [guildId, newServerId]
    );

    if (existingServers.length === 0) {
      console.log(`ℹ️ No existing servers found in guild ${guildId} - nothing to auto-link`);
      return result;
    }

    console.log(`📋 Found ${existingServers.length} existing servers in guild ${guildId}`);

    // For each existing server, get all active players and link them to the new server
    for (const existingServer of existingServers) {
      console.log(`🔍 Processing server: ${existingServer.nickname} (ID: ${existingServer.id})`);

      // Get all active players from this existing server
      const [players] = await pool.query(
        'SELECT discord_id, ign, guild_id, is_active FROM players WHERE server_id = ? AND is_active = true',
        [existingServer.id]
      );

      if (players.length === 0) {
        console.log(`ℹ️ No active players found on ${existingServer.nickname}`);
        continue;
      }

      console.log(`👥 Found ${players.length} active players on ${existingServer.nickname}`);

      // Link each player to the new server
      for (const player of players) {
        try {
          // Check if player is already linked to the new server
          const [existingLink] = await pool.query(
            'SELECT id FROM players WHERE guild_id = ? AND discord_id = ? AND server_id = ? AND is_active = true',
            [player.guild_id, player.discord_id, newServerId]
          );

          if (existingLink.length > 0) {
            console.log(`ℹ️ Player ${player.ign} already linked to ${newServerNickname}`);
            continue;
          }

          // Insert the player link to the new server
          await pool.query(
            'INSERT INTO players (guild_id, discord_id, ign, server_id, is_active) VALUES (?, ?, ?, ?, ?)',
            [player.guild_id, player.discord_id, player.ign, newServerId, player.is_active]
          );

          // Get the newly created player ID for economy record
          const [newPlayer] = await pool.query(
            'SELECT id FROM players WHERE guild_id = ? AND discord_id = ? AND server_id = ?',
            [player.guild_id, player.discord_id, newServerId]
          );

          if (newPlayer.length > 0) {
            // Create economy record for the new server (starting with 0 balance)
            await pool.query(
              'INSERT INTO economy (player_id, balance) VALUES (?, 0)',
              [newPlayer[0].id]
            );
          }

          console.log(`✅ Linked ${player.ign} (${player.discord_id}) to ${newServerNickname}`);
          result.linkedCount++;

        } catch (error) {
          const errorMsg = `Failed to link ${player.ign}: ${error.message}`;
          console.error(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
          result.success = false;
        }
      }
    }

    console.log(`🎉 Auto-linking completed for ${newServerNickname}`);
    console.log(`📊 Total players linked: ${result.linkedCount}`);
    if (result.errors.length > 0) {
      console.log(`⚠️ Errors encountered: ${result.errors.length}`);
    }

  } catch (error) {
    console.error('❌ Error during auto-linking:', error);
    result.success = false;
    result.errors.push(`Auto-linking failed: ${error.message}`);
  }

  return result;
}

module.exports = {
  autoLinkPlayersToNewServer
};
