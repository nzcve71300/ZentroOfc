-- Quick fix for Shadows 3x

-- Create the guild without timestamp columns
INSERT IGNORE INTO guilds (discord_id, name)
VALUES ('1391209638308872254', 'Shadows Guild');

-- Move Shadows 3x to the correct guild
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