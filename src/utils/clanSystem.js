const pool = require('../db');

// Clan color options with emojis
const CLAN_COLORS = {
  '🔴': '#FF4C4C', // Red
  '🔵': '#4C9EFF', // Blue
  '🟢': '#4CFF72', // Green
  '🟡': '#FFD84C', // Yellow
  '🟣': '#B84CFF', // Purple
  '🟠': '#FF914C', // Orange
  '🔷': '#4CFFF5', // Cyan
  '💖': '#FF4CF0', // Pink
  '🟦': '#4CFFC7', // Teal
  '🟩': '#B9FF4C', // Lime
  '💜': '#FF4CB4', // Magenta
  '⚪': '#FFFFFF'  // White
};

// Get clan color by emoji
function getClanColorByEmoji(emoji) {
  return CLAN_COLORS[emoji] || '#FF8C00';
}

// Get emoji by clan color
function getEmojiByClanColor(color) {
  for (const [emoji, hexColor] of Object.entries(CLAN_COLORS)) {
    if (hexColor.toLowerCase() === color.toLowerCase()) {
      return emoji;
    }
  }
  return '⚪';
}

// Get player by Discord ID
async function getPlayerByDiscordId(discordId, serverId) {
  try {
    // serverId here is the guild_id from rust_servers table
    // We need to find the actual server_id that matches this guild_id
    const [servers] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = ?',
      [serverId]
    );
    
    if (servers.length === 0) {
      console.error('No server found for guild_id:', serverId);
      return null;
    }
    
    const actualServerId = servers[0].id;
    
    const [players] = await pool.query(
      'SELECT * FROM players WHERE discord_id = ? AND server_id = ?',
      [discordId, actualServerId]
    );
    return players[0] || null;
  } catch (error) {
    console.error('Error getting player by Discord ID:', error);
    return null;
  }
}

// Helper function to get guild_id from server nickname
async function getServerGuildId(serverNickname) {
  try {
    const [servers] = await pool.query(
      'SELECT guild_id FROM rust_servers WHERE nickname = ?',
      [serverNickname]
    );
    return servers[0]?.guild_id || null;
  } catch (error) {
    console.error('Error getting server guild ID:', error);
    return null;
  }
}

// Get clan by server and name
async function getClanByServerAndName(serverId, clanName) {
  try {
    // serverId here is the guild_id from rust_servers table
    // We need to find the actual server_id that matches this guild_id
    const [servers] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = ?',
      [serverId]
    );
    
    if (servers.length === 0) {
      console.error('No server found for guild_id:', serverId);
      return null;
    }
    
    const actualServerId = servers[0].id;
    
    const [clans] = await pool.query(
      'SELECT * FROM clans WHERE server_id = ? AND name = ?',
      [actualServerId, clanName]
    );
    return clans[0] || null;
  } catch (error) {
    console.error('Error getting clan by server and name:', error);
    return null;
  }
}

// Get clan by server and tag
async function getClanByServerAndTag(serverId, tag) {
  try {
    // serverId here is the guild_id from rust_servers table
    // We need to find the actual server_id that matches this guild_id
    const [servers] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = ?',
      [serverId]
    );
    
    if (servers.length === 0) {
      console.error('No server found for guild_id:', serverId);
      return null;
    }
    
    const actualServerId = servers[0].id;
    
    const [clans] = await pool.query(
      'SELECT * FROM clans WHERE server_id = ? AND tag = ?',
      [actualServerId, tag]
    );
    return clans[0] || null;
  } catch (error) {
    console.error('Error getting clan by server and tag:', error);
    return null;
  }
}

// Get player's clan
async function getPlayerClan(playerId, serverId) {
  try {
    // serverId here is the guild_id from rust_servers table
    // We need to find the actual server_id that matches this guild_id
    const [servers] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = ?',
      [serverId]
    );
    
    if (servers.length === 0) {
      console.error('No server found for guild_id:', serverId);
      return null;
    }
    
    const actualServerId = servers[0].id;
    
    const [clans] = await pool.query(`
      SELECT c.* FROM clans c
      INNER JOIN clan_members cm ON c.id = cm.clan_id
      WHERE cm.player_id = ? AND c.server_id = ?
    `, [playerId, actualServerId]);
    return clans[0] || null;
  } catch (error) {
    console.error('Error getting player clan:', error);
    return null;
  }
}

// Check if player is clan owner or co-owner
async function isPlayerClanOwner(playerId, clanId) {
  try {
    const [clans] = await pool.query(
      'SELECT * FROM clans WHERE id = ? AND (owner_id = ? OR co_owner_id = ?)',
      [clanId, playerId, playerId]
    );
    return clans.length > 0;
  } catch (error) {
    console.error('Error checking if player is clan owner:', error);
    return false;
  }
}

// Check if player is clan owner only
async function isPlayerClanOwnerOnly(playerId, clanId) {
  try {
    const [clans] = await pool.query(
      'SELECT * FROM clans WHERE id = ? AND owner_id = ?',
      [clanId, playerId]
    );
    return clans.length > 0;
  } catch (error) {
    console.error('Error checking if player is clan owner only:', error);
    return false;
  }
}

// Check if player is in clan
async function isPlayerInClan(playerId, clanId) {
  try {
    const [members] = await pool.query(
      'SELECT * FROM clan_members WHERE clan_id = ? AND player_id = ?',
      [clanId, playerId]
    );
    return members.length > 0;
  } catch (error) {
    console.error('Error checking if player is in clan:', error);
    return false;
  }
}

// Get clan members
async function getClanMembers(clanId) {
  try {
    const [members] = await pool.query(`
      SELECT p.*, cm.joined_at FROM players p
      INNER JOIN clan_members cm ON p.id = cm.player_id
      WHERE cm.clan_id = ?
      ORDER BY cm.joined_at ASC
    `, [clanId]);
    return members;
  } catch (error) {
    console.error('Error getting clan members:', error);
    return [];
  }
}

// Get clan invite
async function getClanInvite(clanId, playerId) {
  try {
    const [invites] = await pool.query(
      'SELECT * FROM clan_invites WHERE clan_id = ? AND invited_player_id = ? AND expires_at > NOW()',
      [clanId, playerId]
    );
    return invites[0] || null;
  } catch (error) {
    console.error('Error getting clan invite:', error);
    return null;
  }
}

// Get clan settings
async function getClanSettings(serverId) {
  try {
    // serverId here is the guild_id from rust_servers table
    // We need to find the actual server_id that matches this guild_id
    const [servers] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = ?',
      [serverId]
    );
    
    if (servers.length === 0) {
      console.error('No server found for guild_id:', serverId);
      return { enabled: false, max_members: 10 };
    }
    
    const actualServerId = servers[0].id;
    
    const [settings] = await pool.query(
      'SELECT enabled, max_members FROM clan_settings WHERE server_id = ?',
      [actualServerId]
    );
    return settings[0] || { enabled: false, max_members: 10 };
  } catch (error) {
    console.error('Error getting clan settings:', error);
    return { enabled: false, max_members: 10 };
  }
}

// Get killer and victim clan names for killfeed
async function getKillfeedClanNames(killerId, victimId, serverId) {
  try {
    const killerClan = killerId ? await getPlayerClan(killerId, serverId) : null;
    const victimClan = victimId ? await getPlayerClan(victimId, serverId) : null;
    
    return {
      killerClanName: killerClan ? killerClan.name : '',
      victimClanName: victimClan ? victimClan.name : ''
    };
  } catch (error) {
    console.error('Error getting killfeed clan names:', error);
    return { killerClanName: '', victimClanName: '' };
  }
}

module.exports = {
  CLAN_COLORS,
  getClanColorByEmoji,
  getEmojiByClanColor,
  getPlayerByDiscordId,
  getClanByServerAndName,
  getClanByServerAndTag,
  getPlayerClan,
  isPlayerClanOwner,
  isPlayerClanOwnerOnly,
  isPlayerInClan,
  getClanMembers,
  getClanInvite,
  getClanSettings,
  getKillfeedClanNames
}; 