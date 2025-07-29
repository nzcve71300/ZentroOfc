-- MySQL/MariaDB Schema for Zentro Bot
-- Unified Database Schema - Converted from PostgreSQL

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS zones;
DROP TABLE IF EXISTS position_coordinates;
DROP TABLE IF EXISTS channel_settings;
DROP TABLE IF EXISTS player_stats;
DROP TABLE IF EXISTS killfeed_configs;
DROP TABLE IF EXISTS kit_auth;
DROP TABLE IF EXISTS autokits;
DROP TABLE IF EXISTS shop_kits;
DROP TABLE IF EXISTS shop_items;
DROP TABLE IF EXISTS shop_categories;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS economy;
DROP TABLE IF EXISTS link_blocks;
DROP TABLE IF EXISTS link_requests;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS rust_servers;
DROP TABLE IF EXISTS guilds;

-- Core tables
CREATE TABLE guilds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discord_id BIGINT NOT NULL UNIQUE,
    name TEXT
);

CREATE TABLE rust_servers (
    id VARCHAR(32) PRIMARY KEY,
    guild_id INT,
    nickname TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INT NOT NULL,
    password TEXT NOT NULL,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- UNIFIED PLAYER SYSTEM - This replaces both players and player_links
CREATE TABLE players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id INT,
    server_id VARCHAR(32),
    discord_id BIGINT NOT NULL,
    ign TEXT NOT NULL,
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unlinked_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE KEY unique_guild_server_discord (guild_id, server_id, discord_id),
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Economy system (linked to players table)
CREATE TABLE economy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT,
    balance INT DEFAULT 0,
    UNIQUE KEY unique_player (player_id),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT,
    amount INT NOT NULL,
    type TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Shop system
CREATE TABLE shop_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    role TEXT,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

CREATE TABLE shop_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    display_name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    price INT NOT NULL,
    quantity INT NOT NULL,
    timer INT,
    FOREIGN KEY (category_id) REFERENCES shop_categories(id) ON DELETE CASCADE
);

CREATE TABLE shop_kits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    display_name TEXT NOT NULL,
    kit_name TEXT NOT NULL,
    price INT NOT NULL,
    quantity INT NOT NULL,
    timer INT,
    FOREIGN KEY (category_id) REFERENCES shop_categories(id) ON DELETE CASCADE
);

-- Autokits system
CREATE TABLE autokits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32),
    kit_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    cooldown INT,
    game_name TEXT,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

CREATE TABLE kit_auth (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32),
    discord_id BIGINT NOT NULL,
    kitlist TEXT NOT NULL,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Killfeed system
CREATE TABLE killfeed_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32),
    enabled BOOLEAN DEFAULT FALSE,
    format_string TEXT,
    randomizer_enabled BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

CREATE TABLE player_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    kill_streak INTEGER DEFAULT 0,
    highest_streak INTEGER DEFAULT 0,
    last_kill_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Additional features
CREATE TABLE channel_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32),
    channel_type TEXT NOT NULL,
    channel_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server_channel (server_id, channel_type),
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

CREATE TABLE position_coordinates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32),
    position_type TEXT NOT NULL,
    x_pos TEXT,
    y_pos TEXT,
    z_pos TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server_position (server_id, position_type),
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

CREATE TABLE zones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32),
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    team JSON,
    position JSON,
    size INTEGER DEFAULT 75,
    color_online TEXT DEFAULT '0,255,0',
    color_offline TEXT DEFAULT '255,0,0',
    radiation INTEGER DEFAULT 0,
    delay INTEGER DEFAULT 0,
    expire INTEGER DEFAULT 126000,
    min_team INTEGER DEFAULT 1,
    max_team INTEGER DEFAULT 8,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Link management system (for admin controls)
CREATE TABLE link_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id INT,
    discord_id BIGINT NOT NULL,
    ign TEXT NOT NULL,
    server_id VARCHAR(32),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 1 HOUR),
    status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'expired', 'cancelled'
    UNIQUE KEY unique_guild_server_discord (guild_id, server_id, discord_id),
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

CREATE TABLE link_blocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id INT,
    discord_id BIGINT NULL,
    ign TEXT NULL,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_by BIGINT NOT NULL,
    reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    -- Either discord_id or ign must be provided, but not both
    CHECK ((discord_id IS NOT NULL AND ign IS NULL) OR (discord_id IS NULL AND ign IS NOT NULL)),
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_players_guild_discord ON players(guild_id, discord_id);
CREATE INDEX idx_players_guild_ign ON players(guild_id, ign(191));
CREATE INDEX idx_players_active ON players(is_active);
CREATE INDEX idx_players_server ON players(server_id);

CREATE INDEX idx_economy_player ON economy(player_id);

CREATE INDEX idx_link_requests_guild_discord ON link_requests(guild_id, discord_id);
CREATE INDEX idx_link_requests_status ON link_requests(status);
CREATE INDEX idx_link_requests_expires ON link_requests(expires_at);

CREATE INDEX idx_link_blocks_guild_discord ON link_blocks(guild_id, discord_id);
CREATE INDEX idx_link_blocks_guild_ign ON link_blocks(guild_id, ign(191));
CREATE INDEX idx_link_blocks_active ON link_blocks(is_active);

-- Events configuration table
CREATE TABLE event_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32),
    event_type TEXT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    kill_message TEXT,
    respawn_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server_event (server_id, event_type(191)),
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Insert default configurations for existing servers
INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message)
SELECT 
    rs.id,
    'bradley',
    FALSE,
    '<color=#00ffff>Brad got taken</color>',
    '<color=#00ffff>Bradley APC has respawned</color>'
FROM rust_servers rs;

INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message)
SELECT 
    rs.id,
    'helicopter',
    FALSE,
    '<color=#00ffff>Heli got taken</color>',
    '<color=#00ffff>Patrol Helicopter has respawned</color>'
FROM rust_servers rs;

-- Clean up expired link requests
DELETE FROM link_requests WHERE expires_at < CURRENT_TIMESTAMP AND status = 'pending'; 