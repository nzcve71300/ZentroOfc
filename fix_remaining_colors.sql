-- Fix remaining color format issues

-- Update the remaining zone with "green" color
UPDATE zorp_zones 
SET color_online = '0,255,0' 
WHERE color_online = 'green';

UPDATE zorp_zones 
SET color_offline = '255,0,0' 
WHERE color_offline = 'Red';

-- Show the fixed zones
SELECT 
    'Fixed zones:' as info,
    name as zone_id,
    owner,
    color_online,
    color_offline
FROM zorp_zones 
WHERE created_at + INTERVAL expire SECOND > NOW()
ORDER BY created_at DESC;