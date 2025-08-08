-- Fix SNB1 server guild assignment

-- Show where SNB1 currently is
SELECT 
    'Current location of SNB1:' as info,
    rs.id,
    rs.nickname,
    rs.guild_id,
    g.discord_id as guild_discord_id,
    g.name as guild_name
FROM rust_servers rs
JOIN guilds g ON rs.guild_id = g.id
WHERE rs.nickname = 'SNB1';

-- Check if target guild exists
SELECT 
    'Checking target guild 1379533411009560626:' as info,
    COUNT(*) as guild_count
FROM guilds 
WHERE discord_id = '1379533411009560626';

-- Create the guild if it doesn't exist
INSERT IGNORE INTO guilds (discord_id, name)
VALUES ('1379533411009560626', 'SNB Guild');

-- Move SNB1 to the correct guild
UPDATE rust_servers 
SET guild_id = (SELECT id FROM guilds WHERE discord_id = '1379533411009560626')
WHERE nickname = 'SNB1';

-- Verify the change
SELECT 
    'SNB1 moved successfully!' as status,
    rs.id,
    rs.nickname,
    rs.guild_id,
    g.discord_id as guild_discord_id,
    g.name as guild_name
FROM rust_servers rs
JOIN guilds g ON rs.guild_id = g.id
WHERE rs.nickname = 'SNB1';

-- Show all servers for this guild
SELECT 
    'All servers for guild 1379533411009560626:' as info,
    nickname
FROM rust_servers 
WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = '1379533411009560626');