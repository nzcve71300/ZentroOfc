-- Add Missing Columns to Existing Tables (SSH Version)
-- Run this via SSH to add the missing columns

-- Add missing columns to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_players_guild_discord ON players(guild_id, discord_id);
CREATE INDEX IF NOT EXISTS idx_players_guild_ign ON players(guild_id, ign);
CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active);
CREATE INDEX IF NOT EXISTS idx_players_server ON players(server_id);
CREATE INDEX IF NOT EXISTS idx_economy_player ON economy(player_id);

-- Update existing players to be active
UPDATE players SET is_active = true WHERE is_active IS NULL;

-- Success message
SELECT 'Missing columns added successfully!' as status;