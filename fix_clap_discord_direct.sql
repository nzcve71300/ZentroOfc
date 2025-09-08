-- Direct SQL fix for Clap2000777 Discord ID
-- Update the active record (ID 18508) to use Discord ID 899414980355571712

-- First, let's see the current state
SELECT 'BEFORE UPDATE' as status, p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
FROM players p
LEFT JOIN economy e ON p.id = e.player_id
LEFT JOIN rust_servers rs ON p.server_id = rs.id
WHERE LOWER(p.ign) = LOWER('Clap2000777')
ORDER BY p.is_active DESC, p.linked_at DESC;

-- Update the active record with the correct Discord ID
UPDATE players 
SET discord_id = 899414980355571712,
    linked_at = CURRENT_TIMESTAMP
WHERE id = 18508;

-- Verify the update
SELECT 'AFTER UPDATE' as status, p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
FROM players p
LEFT JOIN economy e ON p.id = e.player_id
LEFT JOIN rust_servers rs ON p.server_id = rs.id
WHERE LOWER(p.ign) = LOWER('Clap2000777')
ORDER BY p.is_active DESC, p.linked_at DESC;

-- Check if there are any constraints that might be preventing the update
SHOW CREATE TABLE players;
