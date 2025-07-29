-- Add is_active column to players table
-- Run this in pgAdmin 4 on the zentro_bot database

-- Add the missing column
ALTER TABLE players 
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Update existing players to be active
UPDATE players SET is_active = true WHERE is_active IS NULL;

-- Create index for better performance
CREATE INDEX idx_players_active ON players(is_active);

-- Success message
SELECT 'is_active column added successfully!' as status;