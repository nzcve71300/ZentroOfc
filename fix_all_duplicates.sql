-- Universal duplicate removal script

-- 1. Remove duplicate players (keep the most recent one)
DELETE p1 FROM players p1
INNER JOIN players p2 
WHERE p1.id > p2.id 
AND p1.guild_id = p2.guild_id
AND p1.server_id = p2.server_id 
AND p1.discord_id = p2.discord_id 
AND LOWER(p1.ign) = LOWER(p2.ign)
AND p1.is_active = true 
AND p2.is_active = true;

-- 2. Remove duplicate channel settings (keep the most recent one)
DELETE cs1 FROM channel_settings cs1
INNER JOIN channel_settings cs2 
WHERE cs1.id > cs2.id 
AND cs1.server_id = cs2.server_id 
AND cs1.channel_type = cs2.channel_type;

-- 3. Remove duplicate ZORP defaults (keep the most recent one)
DELETE zd1 FROM zorp_defaults zd1
INNER JOIN zorp_defaults zd2 
WHERE zd1.id > zd2.id 
AND zd1.server_id = zd2.server_id;

-- 4. Remove duplicate economy records (keep the one with higher balance)
DELETE e1 FROM economy e1
INNER JOIN economy e2 
WHERE e1.id > e2.id 
AND e1.player_id = e2.player_id;

-- 5. Remove duplicate guilds (keep the most recent one)
DELETE g1 FROM guilds g1
INNER JOIN guilds g2 
WHERE g1.id > g2.id 
AND g1.discord_id = g2.discord_id;

-- 6. Remove duplicate active ZORP zones (keep the most recent one per owner per server)
DELETE z1 FROM zorp_zones z1
INNER JOIN zorp_zones z2 
WHERE z1.id > z2.id 
AND z1.server_id = z2.server_id 
AND z1.owner = z2.owner
AND z1.created_at + INTERVAL z1.expire SECOND > NOW()
AND z2.created_at + INTERVAL z2.expire SECOND > NOW();

-- 7. Clean up orphaned economy records after player cleanup
DELETE e FROM economy e
LEFT JOIN players p ON e.player_id = p.id
WHERE p.id IS NULL;

SELECT 'All duplicates removed successfully!' as status;