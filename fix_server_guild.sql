-- Fix server guild assignment
-- Move "Shadows 3x" to the correct guild

-- Show current server location
SELECT 
    'Current server location:' as info,
    id,
    nickname,
    guild_id,
    ip,
    port
FROM rust_servers 
WHERE nickname = 'Shadows 3x';

-- Show the correct guild ID
SELECT 
    'Correct guild ID:' as info,
    id as guild_id,
    discord_id,
    name
FROM guilds 
WHERE discord_id = '1385691441967267953';

-- Update the server to the correct guild
UPDATE rust_servers 
SET guild_id = (SELECT id FROM guilds WHERE discord_id = '1385691441967267953')
WHERE nickname = 'Shadows 3x';

-- Verify the change
SELECT 
    'Server moved successfully!' as status,
    id,
    nickname,
    guild_id,
    ip,
    port
FROM rust_servers 
WHERE nickname = 'Shadows 3x';

-- Test autocomplete query
SELECT 
    'Testing autocomplete query:' as info,
    COUNT(*) as server_count
FROM rust_servers 
WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = '1385691441967267953')
AND nickname LIKE '%';

-- Show all servers for the correct guild
SELECT 
    'All servers for guild 1385691441967267953:' as info,
    nickname,
    guild_id
FROM rust_servers 
WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = '1385691441967267953'); 