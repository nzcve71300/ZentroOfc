-- Fix clan tables to use VARCHAR for server_id columns to support Discord guild IDs

-- Update clan_settings table
ALTER TABLE clan_settings MODIFY COLUMN server_id VARCHAR(50) NOT NULL;

-- Update clans table  
ALTER TABLE clans MODIFY COLUMN server_id VARCHAR(50) NOT NULL;

-- Recreate indexes after column type change
DROP INDEX IF EXISTS idx_clans_server ON clans;
CREATE INDEX idx_clans_server ON clans(server_id);

-- Add index for clan_settings server_id
CREATE INDEX idx_clan_settings_server ON clan_settings(server_id); 