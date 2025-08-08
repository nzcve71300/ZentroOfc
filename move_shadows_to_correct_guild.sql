-- Move Shadows 3x to the correct guild
-- The bot is running on guild 1391209638308872254, so we need to move Shadows 3x there

-- Show current location
SELECT 
    'Current location of Shadows 3x:' as info,
    rs.id,
    rs.nickname,
    rs.guild_id,
    g.discord_id as guild_discord_id,
    g.name as guild_name
FROM rust_servers rs
JOIN guilds g ON rs.guild_id = g.id
WHERE rs.nickname = 'Shadows 3x';

-- Get the correct guild ID
SELECT 
    'Target guild for bot:' as info,
    id as guild_id,
    discord_id,
    name
FROM guilds 
WHERE discord_id = '1391209638308872254';

-- Update Shadows 3x to the correct guild
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

-- Test autocomplete query for the correct guild
SELECT 
    'Testing autocomplete for guild 1391209638308872254:' as info,
    COUNT(*) as server_count
FROM rust_servers 
WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = '1391209638308872254')
AND nickname LIKE '%Shadows%';

-- Show all servers for the correct guild
SELECT 
    'All servers for guild 1391209638308872254:' as info,
    nickname,
    guild_id
FROM rust_servers 
WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = '1391209638308872254'); 