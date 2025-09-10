-- Zentro Gaming Hub Database Schema
-- Clean, well-structured MariaDB schema with proper relationships and constraints

-- Enable foreign key checks and set proper charset
SET FOREIGN_KEY_CHECKS = 1;
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Drop tables in correct order (reverse dependency order)
DROP TABLE IF EXISTS player_balances;
DROP TABLE IF EXISTS player_stats;
DROP TABLE IF EXISTS server_events;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS servers;
DROP TABLE IF EXISTS users;

-- Users table (for app authentication)
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ign VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_ign (ign),
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Servers table (RCON server configurations)
CREATE TABLE servers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL, -- IPv4 or IPv6
    rcon_port INT UNSIGNED NOT NULL,
    rcon_password_encrypted TEXT NOT NULL, -- Encrypted RCON password
    is_active BOOLEAN DEFAULT TRUE,
    last_connection_at TIMESTAMP NULL,
    connection_status ENUM('connected', 'disconnected', 'error') DEFAULT 'disconnected',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server (ip_address, rcon_port),
    INDEX idx_user_id (user_id),
    INDEX idx_ip_port (ip_address, rcon_port),
    INDEX idx_status (connection_status),
    INDEX idx_active (is_active),
    INDEX idx_created_at (created_at),
    
    -- Constraints
    CONSTRAINT chk_rcon_port CHECK (rcon_port > 0 AND rcon_port <= 65535),
    CONSTRAINT chk_name_length CHECK (CHAR_LENGTH(name) >= 1 AND CHAR_LENGTH(name) <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Players table (unique players across all servers)
CREATE TABLE players (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    steam_id VARCHAR(20) NOT NULL UNIQUE, -- Steam ID64
    ign VARCHAR(50) NOT NULL,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_steam_id (steam_id),
    INDEX idx_ign (ign),
    INDEX idx_last_seen (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Player stats per server (server-specific player data)
CREATE TABLE player_stats (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    server_id INT UNSIGNED NOT NULL,
    player_id INT UNSIGNED NOT NULL,
    kills INT UNSIGNED DEFAULT 0,
    deaths INT UNSIGNED DEFAULT 0,
    playtime_minutes INT UNSIGNED DEFAULT 0,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE KEY unique_player_server (server_id, player_id),
    INDEX idx_server_id (server_id),
    INDEX idx_player_id (player_id),
    INDEX idx_kills (kills),
    INDEX idx_playtime (playtime_minutes),
    INDEX idx_last_activity (last_activity_at),
    
    -- Constraints
    CONSTRAINT chk_kills CHECK (kills >= 0),
    CONSTRAINT chk_deaths CHECK (deaths >= 0),
    CONSTRAINT chk_playtime CHECK (playtime_minutes >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Player balances per server (server-specific economy data)
CREATE TABLE player_balances (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    server_id INT UNSIGNED NOT NULL,
    player_id INT UNSIGNED NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    total_earned DECIMAL(15,2) DEFAULT 0.00,
    total_spent DECIMAL(15,2) DEFAULT 0.00,
    last_transaction_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE KEY unique_balance_server_player (server_id, player_id),
    INDEX idx_server_id (server_id),
    INDEX idx_player_id (player_id),
    INDEX idx_balance (balance),
    INDEX idx_last_transaction (last_transaction_at),
    
    -- Constraints
    CONSTRAINT chk_balance CHECK (balance >= 0),
    CONSTRAINT chk_total_earned CHECK (total_earned >= 0),
    CONSTRAINT chk_total_spent CHECK (total_spent >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Server events log (for tracking all server events)
CREATE TABLE server_events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    server_id INT UNSIGNED NOT NULL,
    player_id INT UNSIGNED NULL, -- NULL for server events without player
    event_type ENUM('player_join', 'player_leave', 'player_kill', 'player_death', 'chat_message', 'server_command', 'connection_status') NOT NULL,
    event_data JSON NULL, -- Flexible data storage for event-specific information
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
    INDEX idx_server_id (server_id),
    INDEX idx_player_id (player_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    INDEX idx_server_event (server_id, event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create views for common queries
CREATE VIEW server_player_summary AS
SELECT 
    s.id as server_id,
    s.name as server_name,
    s.ip_address,
    s.rcon_port,
    s.connection_status,
    COUNT(DISTINCT ps.player_id) as total_players,
    COUNT(DISTINCT CASE WHEN ps.last_activity_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN ps.player_id END) as active_players_24h,
    AVG(ps.kills) as avg_kills,
    AVG(ps.deaths) as avg_deaths,
    SUM(ps.playtime_minutes) as total_playtime_minutes
FROM servers s
LEFT JOIN player_stats ps ON s.id = ps.server_id
WHERE s.is_active = TRUE
GROUP BY s.id, s.name, s.ip_address, s.rcon_port, s.connection_status;

CREATE VIEW player_server_stats AS
SELECT 
    p.id as player_id,
    p.steam_id,
    p.ign,
    s.id as server_id,
    s.name as server_name,
    ps.kills,
    ps.deaths,
    CASE 
        WHEN ps.deaths > 0 THEN ROUND(ps.kills / ps.deaths, 2)
        ELSE ps.kills
    END as kd_ratio,
    ps.playtime_minutes,
    pb.balance,
    pb.total_earned,
    pb.total_spent,
    ps.last_activity_at
FROM players p
JOIN player_stats ps ON p.id = ps.player_id
JOIN servers s ON ps.server_id = s.id
LEFT JOIN player_balances pb ON p.id = pb.player_id AND s.id = pb.server_id
WHERE s.is_active = TRUE;

-- Create stored procedures for common operations
DELIMITER //

-- Procedure to get or create a player
CREATE PROCEDURE GetOrCreatePlayer(
    IN p_steam_id VARCHAR(20),
    IN p_ign VARCHAR(50)
)
BEGIN
    DECLARE player_exists INT DEFAULT 0;
    DECLARE player_id INT UNSIGNED;
    
    -- Check if player exists
    SELECT COUNT(*) INTO player_exists FROM players WHERE steam_id = p_steam_id;
    
    IF player_exists = 0 THEN
        -- Create new player
        INSERT INTO players (steam_id, ign) VALUES (p_steam_id, p_ign);
        SET player_id = LAST_INSERT_ID();
    ELSE
        -- Update existing player's IGN and last seen
        UPDATE players SET ign = p_ign, last_seen_at = CURRENT_TIMESTAMP WHERE steam_id = p_steam_id;
        SELECT id INTO player_id FROM players WHERE steam_id = p_steam_id;
    END IF;
    
    SELECT player_id;
END //

-- Procedure to update player stats
CREATE PROCEDURE UpdatePlayerStats(
    IN p_server_id INT UNSIGNED,
    IN p_player_id INT UNSIGNED,
    IN p_kills INT UNSIGNED,
    IN p_deaths INT UNSIGNED,
    IN p_playtime_minutes INT UNSIGNED
)
BEGIN
    INSERT INTO player_stats (server_id, player_id, kills, deaths, playtime_minutes)
    VALUES (p_server_id, p_player_id, p_kills, p_deaths, p_playtime_minutes)
    ON DUPLICATE KEY UPDATE
        kills = p_kills,
        deaths = p_deaths,
        playtime_minutes = p_playtime_minutes,
        last_activity_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END //

-- Procedure to update player balance
CREATE PROCEDURE UpdatePlayerBalance(
    IN p_server_id INT UNSIGNED,
    IN p_player_id INT UNSIGNED,
    IN p_balance DECIMAL(15,2),
    IN p_earned DECIMAL(15,2) DEFAULT 0,
    IN p_spent DECIMAL(15,2) DEFAULT 0
)
BEGIN
    INSERT INTO player_balances (server_id, player_id, balance, total_earned, total_spent)
    VALUES (p_server_id, p_player_id, p_balance, p_earned, p_spent)
    ON DUPLICATE KEY UPDATE
        balance = p_balance,
        total_earned = total_earned + p_earned,
        total_spent = total_spent + p_spent,
        last_transaction_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END //

DELIMITER ;

-- Create indexes for performance optimization
CREATE INDEX idx_server_events_composite ON server_events (server_id, event_type, created_at DESC);
CREATE INDEX idx_player_stats_composite ON player_stats (server_id, last_activity_at DESC);
CREATE INDEX idx_player_balances_composite ON player_balances (server_id, balance DESC);

-- Insert sample data for testing (optional)
-- INSERT INTO users (ign, email, password_hash) VALUES 
-- ('admin', 'admin@zentro.com', '$2b$10$example_hash_here');

-- Add comments for documentation
ALTER TABLE users COMMENT = 'App users and authentication';
ALTER TABLE servers COMMENT = 'RCON server configurations with encrypted passwords';
ALTER TABLE players COMMENT = 'Unique players across all servers identified by Steam ID';
ALTER TABLE player_stats COMMENT = 'Server-specific player statistics and activity';
ALTER TABLE player_balances COMMENT = 'Server-specific player economy balances';
ALTER TABLE server_events COMMENT = 'Audit log of all server events and activities';
