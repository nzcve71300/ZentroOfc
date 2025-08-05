-- Update clan_settings table to add max_members column
ALTER TABLE clan_settings ADD COLUMN max_members INT DEFAULT 10 AFTER enabled; 