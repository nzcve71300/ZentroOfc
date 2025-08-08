-- Add original_name column to channel_settings table
-- This will store the original channel name so we can append player count to it

-- Add the column
ALTER TABLE channel_settings 
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255) DEFAULT NULL;

-- Show the updated table structure
DESCRIBE channel_settings;

-- Update existing playercount channels to store their current name as original_name
-- (This is a one-time migration for existing channels)
SELECT 'Migration completed: original_name column added to channel_settings' as status;