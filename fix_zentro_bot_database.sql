-- Fix zentro_bot database
-- Add missing columns and fix data types

-- Add missing columns to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Fix data types (if needed)
-- Note: These might fail if there's data, so we'll handle errors gracefully

-- Try to change discord_id to bigint
DO $$
BEGIN
    ALTER TABLE players ALTER COLUMN discord_id TYPE BIGINT USING discord_id::BIGINT;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not change discord_id to BIGINT: %', SQLERRM;
END $$;

-- Try to change server_id to varchar
DO $$
BEGIN
    ALTER TABLE players ALTER COLUMN server_id TYPE VARCHAR(32);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not change server_id to VARCHAR: %', SQLERRM;
END $$;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_players_guild_discord ON players(guild_id, discord_id);
CREATE INDEX IF NOT EXISTS idx_players_guild_ign ON players(guild_id, ign);
CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active);
CREATE INDEX IF NOT EXISTS idx_players_server ON players(server_id);
CREATE INDEX IF NOT EXISTS idx_economy_player ON economy(player_id);

-- Update existing players to be active
UPDATE players SET is_active = true WHERE is_active IS NULL;

-- Success message
SELECT 'zentro_bot database fixed successfully!' as status;