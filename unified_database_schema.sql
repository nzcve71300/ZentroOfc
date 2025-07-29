-- Unified Database Schema for Zentro Bot
-- This replaces the old schema and fixes the linking/economy integration issues

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS zones CASCADE;
DROP TABLE IF EXISTS position_coordinates CASCADE;
DROP TABLE IF EXISTS channel_settings CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS killfeed_configs CASCADE;
DROP TABLE IF EXISTS kit_auth CASCADE;
DROP TABLE IF EXISTS autokits CASCADE;
DROP TABLE IF EXISTS shop_kits CASCADE;
DROP TABLE IF EXISTS shop_items CASCADE;
DROP TABLE IF EXISTS shop_categories CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS economy CASCADE;
DROP TABLE IF EXISTS link_blocks CASCADE;
DROP TABLE IF EXISTS link_requests CASCADE;
DROP TABLE IF EXISTS player_links CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS rust_servers CASCADE;
DROP TABLE IF EXISTS guilds CASCADE;

-- Core tables
CREATE TABLE guilds (
    id SERIAL PRIMARY KEY,
    discord_id BIGINT NOT NULL UNIQUE,
    name TEXT
);

CREATE TABLE rust_servers (
    id VARCHAR(32) PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INT NOT NULL,
    password TEXT NOT NULL
);

-- UNIFIED PLAYER SYSTEM - This replaces both players and player_links
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

-- Economy system (linked to players table)
CREATE TABLE economy (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    balance INT DEFAULT 0,
    UNIQUE(player_id)
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    type TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Shop system
CREATE TABLE shop_categories (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    role TEXT
);

CREATE TABLE shop_items (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES shop_categories(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    price INT NOT NULL,
    quantity INT NOT NULL,
    timer INT
);

CREATE TABLE shop_kits (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES shop_categories(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    kit_name TEXT NOT NULL,
    price INT NOT NULL,
    quantity INT NOT NULL,
    timer INT
);

-- Autokits system
CREATE TABLE autokits (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    kit_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT false,
    cooldown INT,
    game_name TEXT
);

CREATE TABLE kit_auth (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    discord_id BIGINT NOT NULL,
    kitlist TEXT NOT NULL
);

-- Killfeed system
CREATE TABLE killfeed_configs (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    format_string TEXT,
    randomizer_enabled BOOLEAN DEFAULT false
);

CREATE TABLE player_stats (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    kill_streak INTEGER DEFAULT 0,
    highest_streak INTEGER DEFAULT 0,
    last_kill_time TIMESTAMP DEFAULT NOW()
);

-- Additional features
CREATE TABLE channel_settings (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL,
    channel_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(server_id, channel_type)
);

CREATE TABLE position_coordinates (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    position_type TEXT NOT NULL,
    x_pos TEXT,
    y_pos TEXT,
    z_pos TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(server_id, position_type)
);

CREATE TABLE zones (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    team JSONB,
    position JSONB,
    size INTEGER DEFAULT 75,
    color_online TEXT DEFAULT '0,255,0',
    color_offline TEXT DEFAULT '255,0,0',
    radiation INTEGER DEFAULT 0,
    delay INTEGER DEFAULT 0,
    expire INTEGER DEFAULT 126000,
    min_team INTEGER DEFAULT 1,
    max_team INTEGER DEFAULT 8,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Link management system (for admin controls)
CREATE TABLE link_requests (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    discord_id BIGINT NOT NULL,
    ign TEXT NOT NULL,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    requested_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 hour'),
    status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'expired', 'cancelled'
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
    -- Either discord_id or ign must be provided, but not both
    CHECK ((discord_id IS NOT NULL AND ign IS NULL) OR (discord_id IS NULL AND ign IS NOT NULL))
);

-- Create indexes for better performance
CREATE INDEX idx_players_guild_discord ON players(guild_id, discord_id);
CREATE INDEX idx_players_guild_ign ON players(guild_id, ign);
CREATE INDEX idx_players_active ON players(is_active);
CREATE INDEX idx_players_server ON players(server_id);

CREATE INDEX idx_economy_player ON economy(player_id);

CREATE INDEX idx_link_requests_guild_discord ON link_requests(guild_id, discord_id);
CREATE INDEX idx_link_requests_status ON link_requests(status);
CREATE INDEX idx_link_requests_expires ON link_requests(expires_at);

CREATE INDEX idx_link_blocks_guild_discord ON link_blocks(guild_id, discord_id);
CREATE INDEX idx_link_blocks_guild_ign ON link_blocks(guild_id, ign);
CREATE INDEX idx_link_blocks_active ON link_blocks(is_active);

-- Clean up expired link requests
DELETE FROM link_requests WHERE expires_at < NOW() AND status = 'pending';