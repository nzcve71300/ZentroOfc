-- SAFE Fix for /link command "name already in use" error
-- This script checks for conflicts before making changes

-- Step 1: Check for any existing conflicts that would prevent the constraint change
SELECT 
    'CHECKING FOR CONFLICTS' as step,
    COUNT(*) as total_conflicts
FROM (
    SELECT server_id, ign, COUNT(*) as count
    FROM players 
    WHERE is_active = 1
    GROUP BY server_id, ign
    HAVING COUNT(*) > 1
) conflicts;

-- Step 2: Show specific conflicts if they exist
SELECT 
    'CONFLICT DETAILS' as step,
    p1.server_id,
    p1.ign,
    p1.discord_id as discord_id_1,
    p2.discord_id as discord_id_2,
    rs.nickname as server_name
FROM players p1
JOIN players p2 ON p1.server_id = p2.server_id 
    AND p1.ign = p2.ign 
    AND p1.id < p2.id
    AND p1.is_active = 1 
    AND p2.is_active = 1
JOIN rust_servers rs ON p1.server_id = rs.id
ORDER BY p1.server_id, p1.ign;

-- Step 3: Only proceed if no conflicts found
-- If conflicts exist, you'll need to resolve them first by:
-- 1. Deactivating duplicate records (set is_active = 0)
-- 2. Or deleting duplicate records
-- 3. Or merging the records

-- Step 4: Remove the problematic constraint (only if no conflicts)
-- ALTER TABLE players DROP INDEX players_unique_guild_server_ign;

-- Step 5: Add the new constraint (only if no conflicts)
-- ALTER TABLE players ADD CONSTRAINT unique_server_ign_active 
-- UNIQUE (server_id, ign(191), is_active);

-- Step 6: Add performance index
-- CREATE INDEX idx_players_server_ign_active ON players(server_id, ign(191), is_active);

-- IMPORTANT: Uncomment steps 4-6 only after confirming no conflicts exist
