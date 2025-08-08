-- Automatic fix for common recurring issues
-- Run this weekly to prevent problems

-- 1. Clean up invalid ZORP zones
DELETE FROM zorp_zones WHERE server_id IS NULL;

-- 2. Fix color formats in ZORP zones
UPDATE zorp_zones SET color_online = '0,255,0' WHERE color_online IN ('green', 'Green', 'GREEN');
UPDATE zorp_zones SET color_offline = '255,0,0' WHERE color_offline IN ('red', 'Red', 'RED');

-- 3. Clean up orphaned economy records
DELETE e FROM economy e
LEFT JOIN players p ON e.player_id = p.id
WHERE p.id IS NULL;

-- 4. Clean up duplicate players (keep the most recent)
DELETE p1 FROM players p1
INNER JOIN players p2 
WHERE p1.id > p2.id 
AND p1.server_id = p2.server_id 
AND p1.discord_id = p2.discord_id 
AND p1.is_active = true 
AND p2.is_active = true;

-- 5. Ensure all active players have economy records
INSERT IGNORE INTO economy (player_id, balance)
SELECT p.id, 0
FROM players p
WHERE p.is_active = TRUE
AND NOT EXISTS (
    SELECT 1 FROM economy e WHERE e.player_id = p.id
);

-- 6. Clean up expired ZORP zones (older than their expire time)
DELETE FROM zorp_zones 
WHERE created_at + INTERVAL expire SECOND < NOW();

SELECT 'Weekly maintenance completed successfully!' as status;