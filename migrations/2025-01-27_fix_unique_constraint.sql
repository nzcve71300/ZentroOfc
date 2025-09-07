-- Migration: Fix unique constraint to only apply to active records
-- Date: 2025-01-27
-- Issue: The ux_players_server_normign constraint prevents new links even when old records are inactive

-- Drop the existing problematic constraint
DROP INDEX IF EXISTS ux_players_server_normign;

-- Create a new constraint that only applies to active records
-- This allows multiple inactive records with the same server_id + normalized_ign
-- but prevents duplicate active records
CREATE UNIQUE INDEX ux_players_server_normign_active 
ON players (server_id, normalized_ign) 
WHERE is_active = TRUE;

-- Note: The WHERE clause in CREATE UNIQUE INDEX is MySQL 8.0+ syntax
-- For older MySQL versions, we'll need to use a different approach
-- Alternative approach for older MySQL versions:
-- CREATE UNIQUE INDEX ux_players_server_normign_active 
-- ON players (server_id, normalized_ign, is_active);
