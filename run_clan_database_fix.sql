-- Comprehensive Clan System Database Fix
-- This script fixes all clan-related database issues

-- 1. Update clan_settings table to use VARCHAR for server_id
ALTER TABLE clan_settings MODIFY COLUMN server_id VARCHAR(50) NOT NULL;

-- 2. Update clans table to use VARCHAR for server_id  
ALTER TABLE clans MODIFY COLUMN server_id VARCHAR(50) NOT NULL;

-- 3. Add max_members column to clan_settings if it doesn't exist
ALTER TABLE clan_settings ADD COLUMN IF NOT EXISTS max_members INT DEFAULT 10 AFTER enabled;

-- 4. Recreate indexes after column type changes
DROP INDEX IF EXISTS idx_clans_server ON clans;
CREATE INDEX idx_clans_server ON clans(server_id);

-- 5. Add index for clan_settings server_id
CREATE INDEX IF NOT EXISTS idx_clan_settings_server ON clan_settings(server_id);

-- 6. Add index for clan_members
CREATE INDEX IF NOT EXISTS idx_clan_members_clan ON clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_player ON clan_members(player_id);

-- 7. Add index for clan_invites
CREATE INDEX IF NOT EXISTS idx_clan_invites_clan ON clan_invites(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_invites_player ON clan_invites(invited_player_id);

-- 8. Show the updated table structures
DESCRIBE clan_settings;
DESCRIBE clans;
DESCRIBE clan_members;
DESCRIBE clan_invites; 