-- Fix Linking System Constraints
-- Run this script to add missing database constraints for airtight linking

-- Add case-insensitive IGN uniqueness constraint per server
-- This ensures no two active players can have the same IGN (case-insensitive) on the same server
-- Note: Since MariaDB doesn't support functional UNIQUE constraints, we'll handle case-insensitive checks in code
ALTER TABLE players 
ADD CONSTRAINT unique_server_ign_active 
UNIQUE (server_id, ign, is_active);

-- Add index for better performance on IGN lookups (case-insensitive)
CREATE INDEX idx_players_server_ign_lower ON players(server_id, ign);

-- Add index for better performance on active status checks  
CREATE INDEX idx_players_active_status ON players(is_active);

-- Verify the constraint was added successfully
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'players' 
AND CONSTRAINT_NAME = 'unique_server_ign_active';

-- Show all constraints on players table
SELECT 
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'players'
ORDER BY CONSTRAINT_NAME;
