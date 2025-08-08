const pool = require('../db');
const { getKillfeedClanNames } = require('./clanSystem');

class KillfeedProcessor {
  constructor() {
    this.npcKeywords = [
      'npc', 'scientist', 'bandit', 'bradley', 'heli', 'helicopter', 
      'turret', 'bear', 'wolf', 'boar', 'chicken', 'deer', 'horse',
      'shark', 'dolphin', 'whale', 'polar bear', 'arctic wolf',
      'stag', 'rabbit', 'pig', 'cow', 'sheep', 'goat'
    ];
  }

  async processKill(killMessage, serverId) {
    try {
      console.log('Processing kill message:', killMessage);
      
      // Extract killer and victim from kill message
      const { killer, victim } = this.parseKillMessage(killMessage);
      
      console.log('Parsed killer:', killer, 'victim:', victim);
      
      if (!killer || !victim) {
        console.log('Could not parse kill message:', killMessage);
        return null;
      }

      // Check if killfeed is enabled for this server
      const killfeedConfig = await this.getKillfeedConfig(serverId);
      if (!killfeedConfig.enabled) {
        return null;
      }

      // Process the kill for K/D tracking
      await this.processKillStats(killer, victim, serverId);

      // Get stats for both players
      const killerStats = await this.getPlayerStats(killer, serverId);
      const victimStats = await this.getPlayerStats(victim, serverId);

      // Format the killfeed message
      const formattedMessage = await this.formatKillfeedMessage(killMessage, killfeedConfig.format_string, killer, victim, serverId);

      return {
        message: formattedMessage,
        killer,
        victim,
        killerStats,
        victimStats,
        isPlayerKill: await this.isPlayerKill(victim, serverId),
        isScientistKill: await this.isScientistKill(victim, serverId)
      };

    } catch (error) {
      console.error('Error processing kill:', error);
      return null;
    }
  }

  parseKillMessage(killMessage) {
    // Common kill message formats:
    // "PlayerA killed PlayerB"
    // "PlayerA killed PlayerB with AK47"
    // "PlayerA killed PlayerB at distance 150m"
    // "PlayerA killed 5148727" (scientist ID)
    // "PlayerA was killed by PlayerB" (reverse format)
    
    console.log('Parsing kill message:', killMessage);
    
    // Try reverse format first: "Victim was killed by Killer"
    if (killMessage.includes('was killed by')) {
      const parts = killMessage.split(' was killed by ');
      if (parts.length === 2) {
        let victim = parts[0].trim();
        let killer = parts[1].trim();
        
        console.log('Reverse format split - victim:', victim, 'killer:', killer);
        
        // Remove any extra words like "with" or "at"
        killer = killer.replace(/\s+(with|at).*$/i, '').trim();
        
        console.log('After cleanup - victim:', victim, 'killer:', killer);
        
        // Check if victim is a scientist ID (any numeric value = scientist)
        if (/^\d+$/.test(victim)) {
          victim = 'Scientist';
        }
        
        // Check if killer is a scientist ID (any numeric value = scientist)
        if (/^\d+$/.test(killer)) {
          killer = 'Scientist';
        }
        
        return {
          killer,
          victim
        };
      }
    }
    
    // Try normal format: "Killer killed Victim" - but be more specific to avoid matching reverse format
    if (!killMessage.includes('was killed by')) {
      let killPattern = /^(.+?)\s+killed\s+(.+?)(?:\s+with|\s+at|$)/i;
      let match = killMessage.match(killPattern);
      
      if (match) {
        let killer = match[1].trim();
        let victim = match[2].trim();
        
        console.log('Normal format match - killer:', killer, 'victim:', victim);
        
        // Check if victim is a scientist ID (any numeric value = scientist)
        if (/^\d+$/.test(victim)) {
          victim = 'Scientist';
        }
        
        // Check if killer is a scientist ID (any numeric value = scientist)
        if (/^\d+$/.test(killer)) {
          killer = 'Scientist';
        }
        
        return {
          killer,
          victim
        };
      }
    }
    
    console.log('No pattern matched for kill message:', killMessage);
    return { killer: null, victim: null };
  }

    async getKillfeedConfig(serverId) {
    try {
      const [result] = await pool.query(
        'SELECT enabled, format_string FROM killfeed_configs WHERE server_id = ?',
        [serverId]
      );
      
      if (result.length > 0) {
        return result[0];
      } else {
        // Return default config if none exists
        return {
          enabled: true, // Default to enabled
          format_string: '{Killer} ☠️ {Victim}'
        };
      }
    } catch (error) {
      console.error('Error getting killfeed config:', error);
      // Return default config on error
      return {
        enabled: true,
        format_string: '{Killer} ☠️ {Victim}'
      };
    }
  }

  async isPlayerKill(victimName, serverId) {
    try {
      // Sanitize the victim name to remove null bytes and invalid characters
      const sanitizedName = victimName.replace(/\0/g, '').trim();
      
      if (!sanitizedName) {
        return false;
      }
      
      // Check if victim is a linked player
      const [result] = await pool.query(
        `SELECT p.id FROM players p 
         JOIN rust_servers rs ON p.server_id = rs.id 
         WHERE rs.id = ? AND LOWER(p.ign) = LOWER(?)`,
        [serverId, sanitizedName]
      );
      
      return result.length > 0;
    } catch (error) {
      console.error('Error checking if victim is player:', error);
      return false;
    }
  }

  async isScientistKill(victimName, serverId) {
    try {
      // Sanitize the victim name to remove null bytes and invalid characters
      const sanitizedName = victimName.replace(/\0/g, '').trim();
      
      if (!sanitizedName) {
        return false;
      }
      
      // Check if victim is a scientist (numeric ID or "Scientist")
      if (sanitizedName === 'Scientist' || /^\d+$/.test(sanitizedName)) {
        return true;
      }
      
      // Also check if it's a known NPC/scientist name
      const scientistNames = ['scientist', 'bandit', 'bradley', 'heli', 'helicopter'];
      const lowerVictim = sanitizedName.toLowerCase();
      
      return scientistNames.some(name => lowerVictim.includes(name));
    } catch (error) {
      console.error('Error checking if scientist kill:', error);
      return false;
    }
  }

  isNPCorAnimal(victimName) {
    const lowerVictim = victimName.toLowerCase();
    return this.npcKeywords.some(keyword => lowerVictim.includes(keyword)) || lowerVictim === 'scientist';
  }

  async processKillStats(killerName, victimName, serverId) {
    try {
      // Sanitize names to remove null bytes and invalid characters
      const sanitizedKiller = killerName.replace(/\0/g, '').trim();
      const sanitizedVictim = victimName.replace(/\0/g, '').trim();
      
      if (!sanitizedKiller || !sanitizedVictim) {
        console.log('Invalid names after sanitization:', { killerName, victimName });
        return;
      }
      
      // Get killer player record
      const [killerResult] = await pool.query(
        `SELECT p.id FROM players p 
         JOIN rust_servers rs ON p.server_id = rs.id 
         WHERE rs.id = ? AND LOWER(p.ign) = LOWER(?)`,
        [serverId, sanitizedKiller]
      );

      if (killerResult.length === 0) {
        console.log('Killer not found in database:', killerName);
        console.log('Searching for killer in server:', serverId);
        return;
      }

      const killerPlayerId = killerResult[0].id;
      const isPlayerKill = await this.isPlayerKill(sanitizedVictim, serverId);
      const isNPCorAnimal = this.isNPCorAnimal(sanitizedVictim);

      // Get or create killer stats
      let killerStats = await this.getOrCreatePlayerStats(killerPlayerId);

      if (isPlayerKill) {
        // Player kill - increase stats
        await this.updatePlayerStats(killerPlayerId, {
          kills: killerStats.kills + 1,
          kill_streak: killerStats.kill_streak + 1,
          highest_streak: Math.max(killerStats.highest_streak, killerStats.kill_streak + 1),
          last_kill_time: new Date()
        });

        // Process victim death
        await this.processVictimDeath(sanitizedVictim, serverId);

      } else if (isNPCorAnimal) {
        // NPC/Animal kill - NO CHANGE to KD (as per requirements)
        // Only update last kill time, don't affect kills/deaths
        await this.updatePlayerStats(killerPlayerId, {
          last_kill_time: new Date()
        });
      }

    } catch (error) {
      console.error('Error processing kill stats:', error);
    }
  }

  async processVictimDeath(victimName, serverId) {
    try {
      // Get victim player record
      const [victimResult] = await pool.query(
        `SELECT p.id FROM players p 
         JOIN rust_servers rs ON p.server_id = rs.id 
         WHERE rs.id = ? AND LOWER(p.ign) = LOWER(?)`,
        [serverId, victimName]
      );

      if (victimResult.length === 0) {
        return; // Not a linked player
      }

      const victimPlayerId = victimResult[0].id;
      const victimStats = await this.getOrCreatePlayerStats(victimPlayerId);

      // Update victim stats (all deaths count)
      await this.updatePlayerStats(victimPlayerId, {
        deaths: victimStats.deaths + 1,
        kill_streak: 0 // Reset streak on death
      });

    } catch (error) {
      console.error('Error processing victim death:', error);
    }
  }

  async getOrCreatePlayerStats(playerId) {
    try {
      let [result] = await pool.query(
        'SELECT * FROM player_stats WHERE player_id = ?',
        [playerId]
      );

      if (result.length === 0) {
        // Create new stats record
        await pool.query(
          'INSERT INTO player_stats (player_id) VALUES (?)',
          [playerId]
        );
        
        return {
          kills: 0,
          deaths: 0,
          kill_streak: 0,
          highest_streak: 0
        };
      }

      return result[0];
    } catch (error) {
      console.error('Error getting/creating player stats:', error);
      return { kills: 0, deaths: 0, kill_streak: 0, highest_streak: 0 };
    }
  }

  async updatePlayerStats(playerId, updates) {
    try {
      const setClause = Object.keys(updates).map((key, index) => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), playerId];
      
      await pool.query(
        `UPDATE player_stats SET ${setClause} WHERE player_id = ?`,
        values
      );
    } catch (error) {
      console.error('Error updating player stats:', error);
    }
  }

  async getPlayerStats(playerName, serverId) {
    try {
      // Sanitize the player name to remove null bytes and invalid characters
      const sanitizedName = playerName.replace(/\0/g, '').trim();
      
      if (!sanitizedName) {
        return { kills: 0, deaths: 0, kill_streak: 0, highest_streak: 0, kd_ratio: '0' };
      }
      
      // If it's a scientist, return default stats
      if (sanitizedName.toLowerCase() === 'scientist') {
        return { kills: 0, deaths: 0, kill_streak: 0, highest_streak: 0, kd_ratio: '0' };
      }
      
      const [result] = await pool.query(
        `SELECT ps.* FROM player_stats ps
         JOIN players p ON ps.player_id = p.id
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE rs.id = ? AND LOWER(p.ign) = LOWER(?)`,
        [serverId, sanitizedName]
      );

      if (result.length === 0) {
        return { kills: 0, deaths: 0, kill_streak: 0, highest_streak: 0 };
      }

      const stats = result[0];
      const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toString();
      
      return {
        ...stats,
        kd_ratio: kd
      };
    } catch (error) {
      console.error('Error getting player stats:', error);
      return { kills: 0, deaths: 0, kill_streak: 0, highest_streak: 0, kd_ratio: '0' };
    }
  }

  async formatKillfeedMessage(originalMessage, formatString, killer, victim, serverId) {
    try {
      // Get stats for both players
      const killerStats = await this.getPlayerStats(killer, serverId);
      const victimStats = await this.getPlayerStats(victim, serverId);

      // Get clan names for both players
      const killerPlayerId = await this.getPlayerIdByName(killer, serverId);
      const victimPlayerId = await this.getPlayerIdByName(victim, serverId);
      const { killerClanName, victimClanName } = await getKillfeedClanNames(killerPlayerId, victimPlayerId, serverId);

      // Replace variables in format string
      let formatted = formatString
        .replace(/{Killer}/g, killer)
        .replace(/{Victim}/g, victim)
        .replace(/{KillerKD}/g, killerStats.kd_ratio)
        .replace(/{VictimKD}/g, victimStats.kd_ratio)
        .replace(/{KillerStreak}/g, killerStats.kill_streak.toString())
        .replace(/{VictimStreak}/g, victimStats.kill_streak.toString())
        .replace(/{KillerHighest}/g, killerStats.highest_streak.toString())
        .replace(/{VictimHighest}/g, victimStats.highest_streak.toString())
        .replace(/{KillerClanName}/g, killerClanName || '')
        .replace(/{VictimClanName}/g, victimClanName || '');

      // Apply randomizer if enabled
      const killfeedConfig = await this.getKillfeedConfig(serverId);
      if (killfeedConfig.randomizer_enabled) {
        formatted = this.applyKillPhraseRandomizer(formatted);
      }

      return formatted;
    } catch (error) {
      console.error('Error formatting killfeed message:', error);
      return originalMessage;
    }
  }

  async getPlayerIdByName(playerName, serverId) {
    try {
      // Sanitize the player name to remove null bytes and invalid characters
      const sanitizedName = playerName.replace(/\0/g, '').trim();
      
      if (!sanitizedName) {
        return null;
      }
      
      // If it's a scientist, return null
      if (sanitizedName.toLowerCase() === 'scientist') {
        return null;
      }
      
      // serverId here is the rust_servers.id (string like '176', '337')
      // We need to find the actual server_id for the players table
      const [servers] = await pool.query(
        'SELECT id FROM rust_servers WHERE id = ?',
        [serverId]
      );
      
      if (servers.length === 0) {
        console.error('No server found for server_id:', serverId);
        return null;
      }
      
      const actualServerId = servers[0].id;
      
      const [result] = await pool.query(
        `SELECT p.id FROM players p
         WHERE p.server_id = ? AND LOWER(p.ign) = LOWER(?)`,
        [actualServerId, sanitizedName]
      );

      return result.length > 0 ? result[0].id : null;
    } catch (error) {
      console.error('Error getting player ID by name:', error);
      return null;
    }
  }

  applyKillPhraseRandomizer(formattedMessage) {
    const killPhrases = [
      'eliminated',
      'gunned down',
      'slaughtered',
      'destroyed',
      'took out',
      'obliterated',
      'dropped',
      'annihilated',
      'wrecked',
      'snapped',
      'ended',
      'demolished',
      'neutralized',
      'wiped out',
      'punished',
      'executed',
      'blasted',
      'crushed',
      'flattened',
      'smoked'
    ];

    // Replace "killed" with a random phrase
    const randomPhrase = killPhrases[Math.floor(Math.random() * killPhrases.length)];
    return formattedMessage.replace(/\bkilled\b/gi, randomPhrase);
  }
}

module.exports = new KillfeedProcessor(); 