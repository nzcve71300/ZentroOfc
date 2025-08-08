-- Check and fix guilds for Shadows 3x

-- Show all available guilds
SELECT 
    'Available guilds:' as info,
    id,
    discord_id,
    name
FROM guilds
ORDER BY id;

-- Check if guild 1391209638308872254 exists
SELECT 
    'Checking for guild 1391209638308872254:' as info,
    COUNT(*) as guild_count
FROM guilds 
WHERE discord_id = '1391209638308872254';

-- If guild doesn't exist, create it
INSERT IGNORE INTO guilds (discord_id, name, created_at, updated_at)
VALUES ('1391209638308872254', 'Shadows Guild', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Show the created guild
SELECT 
    'Created guild:' as info,
    id,
    discord_id,
    name
FROM guilds 
WHERE discord_id = '1391209638308872254';

-- Now move Shadows 3x to the correct guild
UPDATE rust_servers 
SET guild_id = (SELECT id FROM guilds WHERE discord_id = '1391209638308872254')
WHERE nickname = 'Shadows 3x';

-- Verify the change
SELECT 
    'Shadows 3x moved successfully!' as status,
    rs.id,
    rs.nickname,
    rs.guild_id,
    g.discord_id as guild_discord_id,
    g.name as guild_name
FROM rust_servers rs
JOIN guilds g ON rs.guild_id = g.id
WHERE rs.nickname = 'Shadows 3x';

-- Show all servers for the correct guild
SELECT 
    'All servers for guild 1391209638308872254:' as info,
    nickname,
    guild_id
FROM rust_servers 
WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = '1391209638308872254'); 