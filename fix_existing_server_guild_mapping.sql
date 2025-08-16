-- Fix existing server that was added with incorrect guild_id mapping
-- This script fixes the server you just added (149.102.129.112) for guild 1403207665106292850

-- First, ensure the guild exists in the guilds table
INSERT INTO guilds (discord_id, name) 
VALUES ('1403207665106292850', 'Your Guild Name') 
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Update the existing server to use the correct guild_id mapping
-- Server details: 149.102.129.112:29316, RCON password: s6x0xRVw
UPDATE rust_servers 
SET guild_id = (SELECT id FROM guilds WHERE discord_id = '1403207665106292850')
WHERE ip = '149.102.129.112' 
  AND port = 29316
  AND rcon_password = 's6x0xRVw'
  AND guild_id = '1403207665106292850';

-- Verify the fix worked
SELECT 
  rs.id,
  rs.nickname,
  rs.ip,
  rs.port,
  rs.guild_id as internal_guild_id,
  g.discord_id,
  g.name as guild_name
FROM rust_servers rs
JOIN guilds g ON rs.guild_id = g.id
WHERE g.discord_id = '1403207665106292850';
