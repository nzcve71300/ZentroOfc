-- Fix Duplicate Player Records - Database Constraints and Cleanup
-- This script prevents future duplicates and provides cleanup for existing ones

-- 1. First, let's clean up existing duplicate records
-- Find and deactivate duplicate records (keep the most recent one)

-- Create a temporary table to identify duplicates
CREATE TEMPORARY TABLE duplicate_players AS
SELECT 
    p1.id as duplicate_id,
    p1.guild_id,
    p1.server_id,
    p1.discord_id,
    p1.ign,
    p1.linked_at,
    ROW_NUMBER() OVER (
        PARTITION BY p1.guild_id, p1.server_id, p1.discord_id 
        ORDER BY p1.linked_at DESC, p1.id DESC
    ) as rn
FROM players p1
WHERE p1.is_active = true
AND EXISTS (
    SELECT 1 FROM players p2 
    WHERE p2.guild_id = p1.guild_id 
    AND p2.server_id = p1.server_id 
    AND p2.discord_id = p1.discord_id 
    AND p2.is_active = true 
    AND p2.id != p1.id
);

-- Deactivate duplicate records (keep the most recent one)
UPDATE players 
SET is_active = false, 
    unlinked_at = CURRENT_TIMESTAMP,
    unlink_reason = 'Duplicate cleanup - kept most recent record'
WHERE id IN (
    SELECT duplicate_id 
    FROM duplicate_players 
    WHERE rn > 1
);

-- 2. Add better constraints to prevent future duplicates

-- Drop existing constraint if it exists
ALTER TABLE players DROP INDEX IF EXISTS unique_guild_server_discord;

-- Add a unique constraint that only applies to ACTIVE records
-- This prevents multiple active records for the same Discord user on the same server
ALTER TABLE players 
ADD CONSTRAINT unique_active_discord_per_server 
UNIQUE (guild_id, server_id, discord_id, is_active);

-- Add a unique constraint for active IGNs per server (case-insensitive)
-- This prevents the same IGN from being linked to multiple Discord accounts
ALTER TABLE players 
ADD CONSTRAINT unique_active_ign_per_server 
UNIQUE (guild_id, server_id, normalized_ign, is_active);

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_active_discord 
ON players(guild_id, server_id, discord_id, is_active);

CREATE INDEX IF NOT EXISTS idx_players_active_ign 
ON players(guild_id, server_id, normalized_ign, is_active);

-- 4. Add a trigger to prevent duplicate inserts
DELIMITER $$

CREATE TRIGGER prevent_duplicate_active_players
BEFORE INSERT ON players
FOR EACH ROW
BEGIN
    -- Check if there's already an active record for this Discord user on this server
    IF NEW.is_active = true THEN
        IF EXISTS (
            SELECT 1 FROM players 
            WHERE guild_id = NEW.guild_id 
            AND server_id = NEW.server_id 
            AND discord_id = NEW.discord_id 
            AND is_active = true
        ) THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Duplicate active player record: Discord user already has an active record on this server';
        END IF;
        
        -- Check if there's already an active record for this IGN on this server
        IF EXISTS (
            SELECT 1 FROM players 
            WHERE guild_id = NEW.guild_id 
            AND server_id = NEW.server_id 
            AND normalized_ign = NEW.normalized_ign 
            AND is_active = true
        ) THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Duplicate active player record: IGN already has an active record on this server';
        END IF;
    END IF;
END$$

DELIMITER ;

-- 5. Show summary of cleanup
SELECT 
    'Cleanup Summary' as summary,
    COUNT(*) as total_duplicates_found,
    SUM(CASE WHEN rn > 1 THEN 1 ELSE 0 END) as duplicates_deactivated,
    SUM(CASE WHEN rn = 1 THEN 1 ELSE 0 END) as records_kept
FROM duplicate_players;

-- 6. Show remaining active records to verify cleanup
SELECT 
    'Remaining Active Records' as status,
    COUNT(*) as total_active_records,
    COUNT(DISTINCT CONCAT(guild_id, '-', server_id, '-', discord_id)) as unique_discord_links,
    COUNT(DISTINCT CONCAT(guild_id, '-', server_id, '-', normalized_ign)) as unique_ign_links
FROM players 
WHERE is_active = true;
