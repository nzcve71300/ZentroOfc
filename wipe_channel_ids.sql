-- Wipe all channel IDs from the database
-- This will allow you to reconfigure them using /channel-set command

-- Clear all channel IDs and reset timestamps
UPDATE channel_settings 
SET channel_id = NULL, 
    updated_at = CURRENT_TIMESTAMP;

-- Verify the wipe
SELECT channel_type, channel_id, updated_at 
FROM channel_settings 
ORDER BY channel_type;

-- Alternative: If you want to completely remove all channel settings
-- DELETE FROM channel_settings; 