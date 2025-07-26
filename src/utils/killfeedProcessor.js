const pool = require('../db');

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

      // Format the killfeed message
      const formattedMessage = await this.formatKillfeedMessage(killMessage, killfeedConfig.format_string, killer, victim, serverId);

      return {
        message: formattedMessage,
        killer,
        victim,
        isPlayerKill: await this.isPlayerKill(victim, serverId)
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
    
    // Try normal format first: "Killer killed Victim"
    let killPattern = /^(.+?)\s+killed\s+(.+?)(?:\s+with|\s+at|$)/i;
    let match = killMessage.match(killPattern);
    
    if (match) {
      let killer = match[1].trim();
      let victim = match[2].trim();
      
      // Check if victim is a scientist ID (numeric)
      if (/^\d+$/.test(victim)) {
        victim = 'Scientist';
      }
      
      // Check if killer is a scientist ID (numeric)
      if (/^\d+$/.test(killer)) {
        killer = 'Scientist';
      }
      
      return {
        killer,
        victim
      };
    }
    
    // Try reverse format: "Victim was killed by Killer"
    killPattern = /^(.+?)\s+was\s+killed\s+by\s+(.+?)(?:\s+with|\s+at|$)/i;
    match = killMessage.match(killPattern);
    
    if (match) {
      let victim = match[1].trim();
      let killer = match[2].trim();
      
      // Check if victim is a scientist ID (numeric)
      if (/^\d+$/.test(victim)) {
        victim = 'Scientist';
      }
      
      // Check if killer is a scientist ID (numeric)
      if (/^\d+$/.test(killer)) {
        killer = 'Scientist';
      }
      
      return {
        killer,
        victim
      };
    }
    
    return { killer: null, victim: null };
  }

  async getKillfeedConfig(serverId) {
    try {
      const result = await pool.query(
        'SELECT enabled, format_string FROM killfeed_configs WHERE server_id = $1',
        [serverId]
      );
      
             if (result.rows.length > 0) {
         return result.rows[0];
       } else {
         // Return default config if none exists
         return {
           enabled: true, // Default to enabled
           format_string: '<color=#ff0000> {Killer} {KillerKD}<color=#99aab5> Killed<color=green> {Victim} {VictimKD}'
         };
       }
     } catch (error) {
       console.error('Error getting killfeed config:', error);
       // Return default config on error
       return {
         enabled: true,
         format_string: '<color=#ff0000> {Killer} {KillerKD}<color=#99aab5> Killed<color=green> {Victim} {VictimKD}'
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
      const result = await pool.query(
        `SELECT p.id FROM players p 
         JOIN rust_servers rs ON p.server_id = rs.id 
         WHERE rs.id = $1 AND LOWER(p.ign) = LOWER($2)`,
        [serverId, sanitizedName]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking if victim is player:', error);
      return false;
    }
  }

  isNPCorAnimal(victimName) {
    const lowerVictim = victimName.toLowerCase();
    return this.npcKeywords.some(keyword => lowerVictim.includes(keyword)) || lowerVictim === 'scientist';
  }

  async processKillStats(killerName, victimName, serverId) {
    try {
      // Get killer player record
      const killerResult = await pool.query(
        `SELECT p.id FROM players p 
         JOIN rust_servers rs ON p.server_id = rs.id 
         WHERE rs.id = $1 AND LOWER(p.ign) = LOWER($2)`,
        [serverId, killerName]
      );

      if (killerResult.rows.length === 0) {
        console.log('Killer not found in database:', killerName);
        console.log('Searching for killer in server:', serverId);
        return;
      }

      const killerPlayerId = killerResult.rows[0].id;
      const isPlayerKill = await this.isPlayerKill(victimName, serverId);
      const isNPCorAnimal = this.isNPCorAnimal(victimName);

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
        await this.processVictimDeath(victimName, serverId);

      } else if (isNPCorAnimal) {
        // NPC/Animal kill - decrease stats (penalty)
        const newKills = Math.max(0, killerStats.kills - 1); // Don't go below 0
        await this.updatePlayerStats(killerPlayerId, {
          kills: newKills,
          kill_streak: 0, // Reset streak
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
      const victimResult = await pool.query(
        `SELECT p.id FROM players p 
         JOIN rust_servers rs ON p.server_id = rs.id 
         WHERE rs.id = $1 AND LOWER(p.ign) = LOWER($2)`,
        [serverId, victimName]
      );

      if (victimResult.rows.length === 0) {
        return; // Not a linked player
      }

      const victimPlayerId = victimResult.rows[0].id;
      const victimStats = await this.getOrCreatePlayerStats(victimPlayerId);

      // Update victim stats
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
      let result = await pool.query(
        'SELECT * FROM player_stats WHERE player_id = $1',
        [playerId]
      );

      if (result.rows.length === 0) {
        // Create new stats record
        await pool.query(
          'INSERT INTO player_stats (player_id) VALUES ($1)',
          [playerId]
        );
        
        return {
          kills: 0,
          deaths: 0,
          kill_streak: 0,
          highest_streak: 0
        };
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting/creating player stats:', error);
      return { kills: 0, deaths: 0, kill_streak: 0, highest_streak: 0 };
    }
  }

  async updatePlayerStats(playerId, updates) {
    try {
      const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [playerId, ...Object.values(updates)];
      
      await pool.query(
        `UPDATE player_stats SET ${setClause} WHERE player_id = $1`,
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
      
      const result = await pool.query(
        `SELECT ps.* FROM player_stats ps
         JOIN players p ON ps.player_id = p.id
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE rs.id = $1 AND LOWER(p.ign) = LOWER($2)`,
        [serverId, sanitizedName]
      );

      if (result.rows.length === 0) {
        return { kills: 0, deaths: 0, kill_streak: 0, highest_streak: 0 };
      }

      const stats = result.rows[0];
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

      // Replace variables in format string
      let formatted = formatString
        .replace(/{Killer}/g, killer)
        .replace(/{Victim}/g, victim)
        .replace(/{KillerKD}/g, killerStats.kd_ratio)
        .replace(/{VictimKD}/g, victimStats.kd_ratio)
        .replace(/{KillerStreak}/g, killerStats.kill_streak.toString())
        .replace(/{VictimStreak}/g, victimStats.kill_streak.toString())
        .replace(/{KillerHighest}/g, killerStats.highest_streak.toString())
        .replace(/{VictimHighest}/g, victimStats.highest_streak.toString());

      return formatted;
    } catch (error) {
      console.error('Error formatting killfeed message:', error);
      return originalMessage;
    }
  }
}

module.exports = new KillfeedProcessor(); 