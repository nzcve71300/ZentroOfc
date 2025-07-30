-- Check autokit data for RISE 3X server (MariaDB)
USE zentro_bot;

-- Test parameters
SET @guild_id = '1391149977434329230';
SET @server_name = 'RISE 3X';
SET @kit_key = 'FREEkit1';

-- Step 1: Get server ID
SELECT 'Step 1: Server lookup' as step;
SELECT id, nickname, guild_id 
FROM rust_servers 
WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = @guild_id) 
AND nickname = @server_name;

-- Step 2: Check autokit configuration
SELECT 'Step 2: Autokit lookup' as step;
SELECT kit_name, enabled, cooldown, game_name 
FROM autokits 
WHERE server_id = (
    SELECT id FROM rust_servers 
    WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = @guild_id) 
    AND nickname = @server_name
) 
AND kit_name = @kit_key;

-- Step 3: Check all autokits for this server
SELECT 'Step 3: All autokits for this server' as step;
SELECT kit_name, enabled, cooldown, game_name 
FROM autokits 
WHERE server_id = (
    SELECT id FROM rust_servers 
    WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = @guild_id) 
    AND nickname = @server_name
);

-- Step 4: Check all servers for this guild
SELECT 'Step 4: All servers for this guild' as step;
SELECT id, nickname, guild_id 
FROM rust_servers 
WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = @guild_id);

-- Step 5: Check if autokits table has any data at all
SELECT 'Step 5: All autokits in database' as step;
SELECT COUNT(*) as total_autokits FROM autokits;

-- Step 6: Check table structure
SELECT 'Step 6: Autokits table structure' as step;
DESCRIBE autokits;

-- Step 7: Check guild data
SELECT 'Step 7: Guild data' as step;
SELECT * FROM guilds WHERE discord_id = @guild_id; 