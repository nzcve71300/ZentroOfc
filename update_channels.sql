-- Update channel IDs with the correct Discord channel IDs
-- Run this script in your MySQL database

-- Update playercount channel
UPDATE channel_settings 
SET channel_id = '1400098489311953007', 
    updated_at = CURRENT_TIMESTAMP 
WHERE channel_type = 'playercount';

-- Update playerfeed channel  
UPDATE channel_settings 
SET channel_id = '1396872848748052581', 
    updated_at = CURRENT_TIMESTAMP 
WHERE channel_type = 'playerfeed';

-- Update adminfeed channel
UPDATE channel_settings 
SET channel_id = '1400098668123783268', 
    updated_at = CURRENT_TIMESTAMP 
WHERE channel_type = 'adminfeed';

-- Update notefeed channel
UPDATE channel_settings 
SET channel_id = '1397975202184429618', 
    updated_at = CURRENT_TIMESTAMP 
WHERE channel_type = 'notefeed';

-- Verify the updates
SELECT channel_type, channel_id, updated_at 
FROM channel_settings 
ORDER BY channel_type; 