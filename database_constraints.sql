-- Database Constraints to Prevent Corrupted Discord ID Records
-- This script adds constraints to prevent null/empty Discord IDs from being inserted

-- 1. Add constraint to prevent null Discord IDs
ALTER TABLE players 
ADD CONSTRAINT valid_discord_id_not_null 
CHECK (discord_id IS NOT NULL);

-- 2. Add constraint to prevent empty string Discord IDs
ALTER TABLE players 
ADD CONSTRAINT valid_discord_id_not_empty 
CHECK (discord_id != '');

-- 3. Add constraint to prevent 'null' string Discord IDs
ALTER TABLE players 
ADD CONSTRAINT valid_discord_id_not_null_string 
CHECK (discord_id != 'null');

-- 4. Add constraint to prevent 'undefined' string Discord IDs
ALTER TABLE players 
ADD CONSTRAINT valid_discord_id_not_undefined_string 
CHECK (discord_id != 'undefined');

-- 5. Add constraint to ensure Discord ID is numeric (17-19 digits)
ALTER TABLE players 
ADD CONSTRAINT valid_discord_id_format 
CHECK (discord_id REGEXP '^[0-9]{17,19}$');

-- 6. Add constraint to prevent null IGNs
ALTER TABLE players 
ADD CONSTRAINT valid_ign_not_null 
CHECK (ign IS NOT NULL);

-- 7. Add constraint to prevent empty IGNs
ALTER TABLE players 
ADD CONSTRAINT valid_ign_not_empty 
CHECK (ign != '');

-- 8. Add constraint to ensure IGN length is reasonable
ALTER TABLE players 
ADD CONSTRAINT valid_ign_length 
CHECK (LENGTH(ign) >= 1 AND LENGTH(ign) <= 32);

-- 9. Add constraint to prevent null server_id
ALTER TABLE players 
ADD CONSTRAINT valid_server_id_not_null 
CHECK (server_id IS NOT NULL);

-- 10. Add constraint to prevent null guild_id
ALTER TABLE players 
ADD CONSTRAINT valid_guild_id_not_null 
CHECK (guild_id IS NOT NULL);

-- 11. Add unique constraint to prevent duplicate active links per Discord user per guild
ALTER TABLE players 
ADD CONSTRAINT unique_active_discord_link_per_guild 
UNIQUE (discord_id, guild_id, is_active);

-- 12. Add unique constraint to prevent duplicate active IGN links per guild
ALTER TABLE players 
ADD CONSTRAINT unique_active_ign_link_per_guild 
UNIQUE (ign, guild_id, is_active);

-- 13. Add index for better performance on common queries
CREATE INDEX idx_players_discord_id_guild_active ON players(discord_id, guild_id, is_active);
CREATE INDEX idx_players_ign_guild_active ON players(ign, guild_id, is_active);
CREATE INDEX idx_players_server_id_active ON players(server_id, is_active);

-- 14. Add trigger to log all insertions for monitoring
DELIMITER //
CREATE TRIGGER log_player_insertion
AFTER INSERT ON players
FOR EACH ROW
BEGIN
    INSERT INTO player_audit_log (
        action, 
        discord_id, 
        ign, 
        server_id, 
        guild_id, 
        is_active, 
        created_at
    ) VALUES (
        'INSERT',
        NEW.discord_id,
        NEW.ign,
        NEW.server_id,
        NEW.guild_id,
        NEW.is_active,
        NOW()
    );
END//
DELIMITER ;

-- 15. Create audit log table for monitoring
CREATE TABLE IF NOT EXISTS player_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    discord_id VARCHAR(20) NOT NULL,
    ign VARCHAR(32) NOT NULL,
    server_id VARCHAR(50) NOT NULL,
    guild_id BIGINT NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_discord_id (discord_id),
    INDEX idx_audit_ign (ign),
    INDEX idx_audit_created_at (created_at)
);

-- 16. Add comments to document the constraints
COMMENT ON TABLE players IS 'Player linking table with strict validation constraints';
COMMENT ON COLUMN players.discord_id IS 'Discord user ID - must be 17-19 digits, cannot be null/empty';
COMMENT ON COLUMN players.ign IS 'In-game name - must be 1-32 characters, cannot be null/empty';
COMMENT ON COLUMN players.is_active IS 'Whether this link is currently active';

-- 17. Create a view for monitoring corrupted records (should always return 0 rows)
CREATE VIEW corrupted_discord_ids AS
SELECT * FROM players 
WHERE discord_id IS NULL 
   OR discord_id = '' 
   OR discord_id = 'null' 
   OR discord_id = 'undefined'
   OR NOT discord_id REGEXP '^[0-9]{17,19}$';

-- 18. Create a stored procedure to clean up any corrupted records that might slip through
DELIMITER //
CREATE PROCEDURE cleanup_corrupted_records()
BEGIN
    DECLARE deleted_count INT DEFAULT 0;
    
    -- Delete corrupted Discord ID records
    DELETE FROM players 
    WHERE discord_id IS NULL 
       OR discord_id = '' 
       OR discord_id = 'null' 
       OR discord_id = 'undefined'
       OR NOT discord_id REGEXP '^[0-9]{17,19}$';
    
    SET deleted_count = ROW_COUNT();
    
    -- Log the cleanup
    INSERT INTO player_audit_log (
        action, discord_id, ign, server_id, guild_id, is_active, created_at
    ) VALUES (
        'CLEANUP',
        'SYSTEM',
        'SYSTEM',
        'SYSTEM',
        0,
        0,
        NOW()
    );
    
    SELECT CONCAT('Cleaned up ', deleted_count, ' corrupted records') AS result;
END//
DELIMITER ;

-- 19. Create a scheduled event to run cleanup daily (if event scheduler is enabled)
-- SET GLOBAL event_scheduler = ON;
-- CREATE EVENT daily_cleanup_corrupted_records
-- ON SCHEDULE EVERY 1 DAY
-- STARTS CURRENT_TIMESTAMP
-- DO CALL cleanup_corrupted_records();

-- 20. Create a function to validate Discord ID format
DELIMITER //
CREATE FUNCTION is_valid_discord_id(discord_id VARCHAR(20))
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE result BOOLEAN DEFAULT FALSE;
    
    IF discord_id IS NOT NULL 
       AND discord_id != '' 
       AND discord_id != 'null' 
       AND discord_id != 'undefined'
       AND discord_id REGEXP '^[0-9]{17,19}$'
    THEN
        SET result = TRUE;
    END IF;
    
    RETURN result;
END//
DELIMITER ;

-- Summary of constraints added:
-- ✅ Prevents null Discord IDs
-- ✅ Prevents empty string Discord IDs  
-- ✅ Prevents 'null' string Discord IDs
-- ✅ Prevents 'undefined' string Discord IDs
-- ✅ Ensures Discord ID format (17-19 digits)
-- ✅ Prevents null/empty IGNs
-- ✅ Ensures reasonable IGN length
-- ✅ Prevents null server_id and guild_id
-- ✅ Prevents duplicate active links per user per guild
-- ✅ Prevents duplicate active IGN links per guild
-- ✅ Adds performance indexes
-- ✅ Creates audit logging
-- ✅ Provides cleanup procedures
-- ✅ Adds validation functions

-- These constraints will prevent corrupted records at the database level
-- and provide monitoring tools to catch any issues that might slip through
