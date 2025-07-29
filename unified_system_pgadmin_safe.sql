-- Unified System Setup for pgAdmin 4 (Safe Version)
-- Run this script in pgAdmin 4 to set up the unified player system

-- Step 1: Backup existing data (optional - you can export tables first)
-- Export your current players and economy tables as backup

-- Step 2: Drop existing tables (if they exist)
DROP TABLE IF EXISTS link_blocks CASCADE;
DROP TABLE IF EXISTS link_requests CASCADE;
DROP TABLE IF EXISTS economy CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS player_links CASCADE;

-- Step 3: Create the new unified players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    discord_id BIGINT NOT NULL,
    ign TEXT NOT NULL,
    linked_at TIMESTAMP DEFAULT NOW(),
    unlinked_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(guild_id, discord_id, server_id)
);

-- Step 4: Create the new economy table
CREATE TABLE economy (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    balance INT DEFAULT 0,
    UNIQUE(player_id)
);

-- Step 5: Create indexes for better performance
CREATE INDEX idx_players_guild_discord ON players(guild_id, discord_id);
CREATE INDEX idx_players_guild_ign ON players(guild_id, ign);
CREATE INDEX idx_players_active ON players(is_active);
CREATE INDEX idx_players_server ON players(server_id);
CREATE INDEX idx_economy_player ON economy(player_id);

-- Step 6: Create link management tables
CREATE TABLE link_requests (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    discord_id BIGINT NOT NULL,
    ign TEXT NOT NULL,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    requested_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 hour'),
    status TEXT DEFAULT 'pending',
    UNIQUE(guild_id, discord_id, server_id)
);

CREATE TABLE link_blocks (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    discord_id BIGINT NULL,
    ign TEXT NULL,
    blocked_at TIMESTAMP DEFAULT NOW(),
    blocked_by BIGINT NOT NULL,
    reason TEXT,
    is_active BOOLEAN DEFAULT true,
    CHECK ((discord_id IS NOT NULL AND ign IS NULL) OR (discord_id IS NULL AND ign IS NOT NULL))
);

-- Create indexes for link management
CREATE INDEX idx_link_requests_guild_discord ON link_requests(guild_id, discord_id);
CREATE INDEX idx_link_requests_status ON link_requests(status);
CREATE INDEX idx_link_requests_expires ON link_requests(expires_at);
CREATE INDEX idx_link_blocks_guild_discord ON link_blocks(guild_id, discord_id);
CREATE INDEX idx_link_blocks_guild_ign ON link_blocks(guild_id, ign);
CREATE INDEX idx_link_blocks_active ON link_blocks(is_active);

-- Clean up expired link requests
DELETE FROM link_requests WHERE expires_at < NOW() AND status = 'pending';

-- Success message
SELECT 'Unified system setup completed successfully!' as status;