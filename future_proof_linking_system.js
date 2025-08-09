const mysql = require('mysql2/promise');
require('dotenv').config();

async function futureProofLinkingSystem() {
  console.log('🚀 FUTURE-PROOF LINKING SYSTEM');
  console.log('===============================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Create future-proof stored procedures...');
    
    // Create a stored procedure for safe player linking
    const createLinkPlayerProcedure = `
      DROP PROCEDURE IF EXISTS LinkPlayerSafely;
      
      CREATE PROCEDURE LinkPlayerSafely(
        IN p_guild_id BIGINT,
        IN p_server_id VARCHAR(32),
        IN p_discord_id BIGINT,
        IN p_ign TEXT,
        OUT p_player_id INT,
        OUT p_success BOOLEAN,
        OUT p_message TEXT
      )
      BEGIN
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
          ROLLBACK;
          SET p_success = FALSE;
          SET p_message = 'Database error occurred during linking';
          SET p_player_id = 0;
        END;
        
        START TRANSACTION;
        
        -- Validate inputs
        IF p_discord_id <= 0 THEN
          SET p_success = FALSE;
          SET p_message = 'Invalid Discord ID provided';
          SET p_player_id = 0;
          ROLLBACK;
        ELSEIF p_ign = '' OR p_ign IS NULL THEN
          SET p_success = FALSE;
          SET p_message = 'Invalid IGN provided';
          SET p_player_id = 0;
          ROLLBACK;
        ELSE
          -- Check if Discord ID is already linked to different IGN on this server
          IF EXISTS (
            SELECT 1 FROM players 
            WHERE guild_id = p_guild_id 
            AND server_id = p_server_id 
            AND discord_id = p_discord_id 
            AND LOWER(ign) != LOWER(p_ign)
            AND is_active = 1
          ) THEN
            SET p_success = FALSE;
            SET p_message = 'Discord ID already linked to different IGN on this server';
            SET p_player_id = 0;
            ROLLBACK;
          -- Check if IGN is already linked to different Discord ID on this server
          ELSEIF EXISTS (
            SELECT 1 FROM players 
            WHERE guild_id = p_guild_id 
            AND server_id = p_server_id 
            AND LOWER(ign) = LOWER(p_ign)
            AND discord_id != p_discord_id 
            AND is_active = 1
          ) THEN
            SET p_success = FALSE;
            SET p_message = 'IGN already linked to different Discord ID on this server';
            SET p_player_id = 0;
            ROLLBACK;
          ELSE
            -- Safe to link - use INSERT ... ON DUPLICATE KEY UPDATE
            INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
            VALUES (p_guild_id, p_server_id, p_discord_id, p_ign, CURRENT_TIMESTAMP, 1)
            ON DUPLICATE KEY UPDATE
              ign = VALUES(ign),
              linked_at = CURRENT_TIMESTAMP,
              is_active = 1,
              unlinked_at = NULL;
            
            SET p_player_id = LAST_INSERT_ID();
            IF p_player_id = 0 THEN
              -- Get existing player ID for duplicate key update
              SELECT id INTO p_player_id FROM players 
              WHERE guild_id = p_guild_id 
              AND server_id = p_server_id 
              AND discord_id = p_discord_id 
              LIMIT 1;
            END IF;
            
            -- Ensure economy record exists
            INSERT INTO economy (player_id, guild_id, balance)
            VALUES (p_player_id, p_guild_id, 0)
            ON DUPLICATE KEY UPDATE balance = balance;
            
            SET p_success = TRUE;
            SET p_message = 'Player linked successfully';
            COMMIT;
          END IF;
        END IF;
      END;
    `;
    
    await connection.execute(createLinkPlayerProcedure);
    console.log('✅ Created LinkPlayerSafely stored procedure');

    // Create a procedure for safe player unlinking
    const createUnlinkPlayerProcedure = `
      DROP PROCEDURE IF EXISTS UnlinkPlayerSafely;
      
      CREATE PROCEDURE UnlinkPlayerSafely(
        IN p_guild_id BIGINT,
        IN p_server_id VARCHAR(32),
        IN p_discord_id BIGINT,
        OUT p_success BOOLEAN,
        OUT p_message TEXT
      )
      BEGIN
        DECLARE player_count INT DEFAULT 0;
        
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
          ROLLBACK;
          SET p_success = FALSE;
          SET p_message = 'Database error occurred during unlinking';
        END;
        
        START TRANSACTION;
        
        -- Check if player exists and is active
        SELECT COUNT(*) INTO player_count 
        FROM players 
        WHERE guild_id = p_guild_id 
        AND server_id = p_server_id 
        AND discord_id = p_discord_id 
        AND is_active = 1;
        
        IF player_count = 0 THEN
          SET p_success = FALSE;
          SET p_message = 'No active link found for this Discord ID on this server';
          ROLLBACK;
        ELSE
          -- Deactivate the player link
          UPDATE players 
          SET is_active = 0, unlinked_at = CURRENT_TIMESTAMP 
          WHERE guild_id = p_guild_id 
          AND server_id = p_server_id 
          AND discord_id = p_discord_id;
          
          SET p_success = TRUE;
          SET p_message = 'Player unlinked successfully';
          COMMIT;
        END IF;
      END;
    `;
    
    await connection.execute(createUnlinkPlayerProcedure);
    console.log('✅ Created UnlinkPlayerSafely stored procedure');

    console.log('\n📋 Step 2: Create auto-setup trigger for new servers...');
    
    // Create trigger to automatically setup autokits for new servers
    const createAutoSetupTrigger = `
      DROP TRIGGER IF EXISTS auto_setup_new_server;
      
      CREATE TRIGGER auto_setup_new_server
      AFTER INSERT ON rust_servers
      FOR EACH ROW
      BEGIN
        -- Insert all standard autokits for the new server
        INSERT INTO autokits (server_id, kit_name, game_name, cooldown, enabled) VALUES
        (NEW.id, 'FREEkit1', 'Free Kit 1', 60, 0),
        (NEW.id, 'FREEkit2', 'Free Kit 2', 60, 0),
        (NEW.id, 'VIPkit', 'VIP Kit', 60, 0),
        (NEW.id, 'ELITEkit1', 'Elite Kit 1', 60, 0),
        (NEW.id, 'ELITEkit2', 'Elite Kit 2', 60, 0),
        (NEW.id, 'ELITEkit3', 'Elite Kit 3', 60, 0),
        (NEW.id, 'ELITEkit4', 'Elite Kit 4', 60, 0),
        (NEW.id, 'ELITEkit5', 'Elite Kit 5', 60, 0),
        (NEW.id, 'ELITEkit6', 'Elite Kit 6', 60, 0),
        (NEW.id, 'ELITEkit7', 'Elite Kit 7', 60, 0),
        (NEW.id, 'ELITEkit8', 'Elite Kit 8', 60, 0),
        (NEW.id, 'ELITEkit9', 'Elite Kit 9', 60, 0),
        (NEW.id, 'ELITEkit10', 'Elite Kit 10', 60, 0),
        (NEW.id, 'ELITEkit11', 'Elite Kit 11', 60, 0),
        (NEW.id, 'ELITEkit12', 'Elite Kit 12', 60, 0),
        (NEW.id, 'ELITEkit13', 'Elite Kit 13', 60, 0);
        
        -- Insert default eco_games_config for the new server
        INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES
        (NEW.id, 'starting_balance', '1000'),
        (NEW.id, 'daily_reward', '100'),
        (NEW.id, 'max_daily_claims', '1');
      END;
    `;
    
    await connection.execute(createAutoSetupTrigger);
    console.log('✅ Created auto_setup_new_server trigger');

    console.log('\n📋 Step 3: Create data validation triggers...');
    
    // Create trigger to validate player data before insert/update
    const createValidationTrigger = `
      DROP TRIGGER IF EXISTS validate_player_data;
      
      CREATE TRIGGER validate_player_data
      BEFORE INSERT ON players
      FOR EACH ROW
      BEGIN
        -- Ensure discord_id is valid
        IF NEW.discord_id <= 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Discord ID must be a positive number';
        END IF;
        
        -- Ensure IGN is not empty
        IF NEW.ign = '' OR NEW.ign IS NULL THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IGN cannot be empty';
        END IF;
        
        -- Set default values if not provided
        IF NEW.is_active IS NULL THEN
          SET NEW.is_active = 1;
        END IF;
        
        IF NEW.linked_at IS NULL THEN
          SET NEW.linked_at = CURRENT_TIMESTAMP;
        END IF;
      END;
    `;
    
    await connection.execute(createValidationTrigger);
    console.log('✅ Created validate_player_data trigger');

    console.log('\n📋 Step 4: Create maintenance procedures...');
    
    // Create procedure to clean up inactive players
    const createCleanupProcedure = `
      DROP PROCEDURE IF EXISTS CleanupInactivePlayers;
      
      CREATE PROCEDURE CleanupInactivePlayers(
        IN days_inactive INT,
        OUT p_cleaned_count INT
      )
      BEGIN
        DECLARE cleaned_players INT DEFAULT 0;
        
        -- Delete players inactive for specified days
        DELETE FROM players 
        WHERE is_active = 0 
        AND unlinked_at < DATE_SUB(NOW(), INTERVAL days_inactive DAY);
        
        SET p_cleaned_count = ROW_COUNT();
      END;
    `;
    
    await connection.execute(createCleanupProcedure);
    console.log('✅ Created CleanupInactivePlayers maintenance procedure');

    console.log('\n📋 Step 5: Test the future-proof system...');
    
    // Test the stored procedure with a dummy call
    const [testResult] = await connection.execute(`
      CALL LinkPlayerSafely(999999, 'test_server', 123456789012345678, 'TestPlayer', @player_id, @success, @message);
      SELECT @player_id as player_id, @success as success, @message as message;
    `);
    
    console.log('Test procedure result:', testResult[0]);
    
    // Clean up test data
    await connection.execute('DELETE FROM players WHERE guild_id = 999999');

    console.log('\n📋 Step 6: Create monitoring views...');
    
    // Create view for easy monitoring of linking health
    const createMonitoringView = `
      CREATE OR REPLACE VIEW linking_health AS
      SELECT 
        g.name as guild_name,
        g.discord_id as guild_discord_id,
        rs.nickname as server_name,
        COUNT(p.id) as total_linked_players,
        COUNT(CASE WHEN p.is_active = 1 THEN 1 END) as active_players,
        COUNT(CASE WHEN p.is_active = 0 THEN 1 END) as inactive_players,
        COUNT(e.id) as players_with_economy
      FROM guilds g
      LEFT JOIN rust_servers rs ON g.id = rs.guild_id
      LEFT JOIN players p ON rs.id = p.server_id
      LEFT JOIN economy e ON p.id = e.player_id
      GROUP BY g.id, rs.id
      ORDER BY g.name, rs.nickname;
    `;
    
    await connection.execute(createMonitoringView);
    console.log('✅ Created linking_health monitoring view');

    await connection.end();

    console.log('\n🎯 FUTURE-PROOFING COMPLETE!');
    console.log('✅ Created safe linking stored procedures');
    console.log('✅ Added auto-setup trigger for new servers');
    console.log('✅ Added data validation triggers');
    console.log('✅ Created maintenance procedures');
    console.log('✅ Added monitoring views');

    console.log('\n🚀 FUTURE-PROOF FEATURES:');
    console.log('• New servers automatically get all 16 kits configured');
    console.log('• New servers automatically get economy settings');
    console.log('• Player linking is validated at database level');
    console.log('• Duplicate prevention built into the database');
    console.log('• Automatic cleanup procedures available');
    console.log('• Health monitoring views for diagnostics');

    console.log('\n📊 USAGE:');
    console.log('• Use CALL LinkPlayerSafely() for safe linking');
    console.log('• Use CALL UnlinkPlayerSafely() for safe unlinking');
    console.log('• Use SELECT * FROM linking_health for monitoring');
    console.log('• Use CALL CleanupInactivePlayers(30) for maintenance');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

futureProofLinkingSystem();