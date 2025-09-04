-- Fix for /link command "name already in use" error
-- This allows the same IGN to be used across different servers within the same guild
-- but prevents duplicates on the same server

-- Step 1: Remove the problematic constraint that prevents same IGN across servers
ALTER TABLE players DROP INDEX players_unique_guild_server_ign;

-- Step 2: Add a more appropriate constraint that only prevents duplicates on the same server
ALTER TABLE players ADD CONSTRAINT unique_server_ign_active 
UNIQUE (server_id, ign(191), is_active);

-- Step 3: Add an index for better performance on IGN lookups
CREATE INDEX idx_players_server_ign_active ON players(server_id, ign(191), is_active);

-- Step 4: Verify the changes
SELECT 
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_NAME = 'players' 
AND CONSTRAINT_NAME LIKE '%ign%';

-- Step 5: Test the new constraint behavior
-- This should now allow:
-- - Same IGN on different servers within the same guild
-- - Different IGNs on the same server
-- - But prevent: Same IGN on the same server (active)
