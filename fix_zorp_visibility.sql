-- Fix ZORP visibility issues

-- Clean up old zones with NULL server_id (these can cause issues)
DELETE FROM zorp_zones WHERE server_id IS NULL;

-- Show active zones after cleanup
SELECT 
    'Active ZORP zones after cleanup:' as info,
    COUNT(*) as active_zones
FROM zorp_zones 
WHERE created_at + INTERVAL expire SECOND > NOW();

-- Show current active zones with proper zone IDs
SELECT 
    'Current active zones:' as info,
    z.name as zone_id,
    z.owner,
    rs.nickname as server,
    z.position,
    z.color_online,
    z.size,
    TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(z.created_at, INTERVAL z.expire SECOND)) as seconds_left
FROM zorp_zones z
JOIN rust_servers rs ON z.server_id = rs.id
WHERE z.created_at + INTERVAL z.expire SECOND > NOW()
ORDER BY z.created_at DESC;

-- Update any zones with invalid color formats
UPDATE zorp_zones 
SET color_online = '0,255,0' 
WHERE color_online = 'green' OR color_online = 'Green';

UPDATE zorp_zones 
SET color_offline = '255,0,0' 
WHERE color_offline = 'red' OR color_offline = 'Red';

-- Show summary
SELECT 'ZORP cleanup completed!' as status;