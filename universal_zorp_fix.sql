-- Universal ZORP fix that works for ANY server

-- Fix ALL color format issues across all servers and zones
UPDATE zorp_zones SET color_online = '0,255,0' WHERE color_online IN ('green', 'Green', 'GREEN');
UPDATE zorp_zones SET color_offline = '255,0,0' WHERE color_offline IN ('red', 'Red', 'RED');

-- Fix ZORP defaults for all servers
UPDATE zorp_defaults SET color_online = '0,255,0' WHERE color_online IN ('green', 'Green', 'GREEN');
UPDATE zorp_defaults SET color_offline = '255,0,0' WHERE color_offline IN ('red', 'Red', 'RED');

-- Show all zones after fix
SELECT 
    'All zones after color fix:' as info,
    z.name as zone_id,
    z.owner,
    rs.nickname as server,
    z.color_online,
    z.color_offline,
    CASE 
        WHEN z.created_at + INTERVAL z.expire SECOND > NOW() THEN 'Active'
        ELSE 'Expired'
    END as status
FROM zorp_zones z
JOIN rust_servers rs ON z.server_id = rs.id
ORDER BY z.created_at DESC;

-- Show all server defaults after fix
SELECT 
    'All server ZORP defaults after fix:' as info,
    rs.nickname as server,
    zd.color_online,
    zd.color_offline,
    zd.size,
    zd.radiation,
    zd.delay
FROM rust_servers rs
LEFT JOIN zorp_defaults zd ON rs.id = zd.server_id
ORDER BY rs.nickname;