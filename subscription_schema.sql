-- Subscription System Schema for Zentro Bot (MariaDB/MySQL)
-- This replaces the existing guilds and rust_servers tables with subscription-aware tables

-- Subscriptions table to track guild subscriptions
CREATE TABLE subscriptions (
    guild_id BIGINT PRIMARY KEY,
    allowed_servers INT DEFAULT 0,
    active_servers INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Servers table with subscription enforcement
CREATE TABLE servers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    nickname VARCHAR(255) NOT NULL,
    ip VARCHAR(255) NOT NULL,
    port INT NOT NULL,
    rcon_password VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    currency_name VARCHAR(50) DEFAULT 'coins',
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE
);

-- Players table (updated for subscription system)
CREATE TABLE players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    server_id INT,
    discord_id BIGINT,
    ign VARCHAR(255),
    balance INT DEFAULT 0,
    last_daily TIMESTAMP NULL,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Player links table (updated for subscription system)
CREATE TABLE player_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    discord_id BIGINT NOT NULL,
    ign VARCHAR(255) NOT NULL,
    server_id INT,
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unlinked_at TIMESTAMP NULL,
    is_active TINYINT(1) DEFAULT 1,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Shop categories table (updated for subscription system)
CREATE TABLE shop_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    server_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    role VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_category (guild_id, server_id, name(191))
);

-- Shop items table (updated for subscription system)
CREATE TABLE shop_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    server_id INT NOT NULL,
    category_id INT NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    short_name VARCHAR(255) NOT NULL,
    price INT NOT NULL,
    quantity INT NOT NULL,
    timer INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES shop_categories(id) ON DELETE CASCADE
);

-- Shop kits table (updated for subscription system)
CREATE TABLE shop_kits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    server_id INT NOT NULL,
    category_id INT NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    kit_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    price INT NOT NULL,
    timer INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES shop_categories(id) ON DELETE CASCADE
);

-- Economy games config table (updated for subscription system)
CREATE TABLE eco_games_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    server_id INT NOT NULL,
    setting_name VARCHAR(255) NOT NULL,
    setting_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_setting (guild_id, server_id, setting_name(191))
);

-- Autokits config table (updated for subscription system)
CREATE TABLE autokits_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    server_id INT NOT NULL,
    kit_name VARCHAR(255) NOT NULL,
    is_enabled TINYINT(1) DEFAULT 0,
    cooldown INT DEFAULT 0,
    display_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_kit (guild_id, server_id, kit_name(191))
);

-- Kit authorization table (updated for subscription system)
CREATE TABLE kit_auth (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    server_id INT NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    kit_list VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Killfeed config table (updated for subscription system)
CREATE TABLE killfeed_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    server_id INT NOT NULL,
    is_enabled TINYINT(1) DEFAULT 0,
    message_format TEXT DEFAULT '{Killer} killed {Victim}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_killfeed (guild_id, server_id)
);

-- Link requests table (updated for subscription system)
CREATE TABLE link_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    discord_id BIGINT NOT NULL,
    ign VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE
);

-- Link blocks table (updated for subscription system)
CREATE TABLE link_blocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE,
    UNIQUE KEY unique_block (guild_id, name(191))
);

-- Create indexes for performance
CREATE INDEX idx_servers_guild_id ON servers(guild_id);
CREATE INDEX idx_servers_active ON servers(guild_id, is_active);
CREATE INDEX idx_players_guild_server ON players(guild_id, server_id);
CREATE INDEX idx_players_discord ON players(guild_id, discord_id);
CREATE INDEX idx_shop_categories_server ON shop_categories(server_id);
CREATE INDEX idx_shop_items_category ON shop_items(category_id);
CREATE INDEX idx_shop_kits_category ON shop_kits(category_id);
CREATE INDEX idx_eco_games_server ON eco_games_config(server_id);
CREATE INDEX idx_autokits_server ON autokits_config(server_id);
CREATE INDEX idx_kit_auth_server ON kit_auth(server_id);
CREATE INDEX idx_killfeed_server ON killfeed_config(server_id); 