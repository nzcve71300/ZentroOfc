-- KOTH (King of the Hill) System Database Schema

-- KOTH Events Table
CREATE TABLE IF NOT EXISTS koth_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    event_name VARCHAR(100) NOT NULL DEFAULT 'KOTH Event',
    status ENUM('inactive', 'countdown', 'active', 'completed', 'cancelled') DEFAULT 'inactive',
    gate_id INT NOT NULL,
    capture_time_seconds INT DEFAULT 300, -- 5 minutes default
    countdown_seconds INT DEFAULT 60, -- 1 minute countdown
    max_participants INT DEFAULT 50,
    reward_amount DECIMAL(10,2) DEFAULT 1000.00,
    reward_currency VARCHAR(20) DEFAULT 'scrap',
    current_king VARCHAR(100) NULL,
    king_start_time TIMESTAMP NULL,
    event_start_time TIMESTAMP NULL,
    event_end_time TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100) NOT NULL,
    UNIQUE KEY unique_active_event (server_id, status),
    INDEX idx_server_status (server_id, status),
    INDEX idx_gate (gate_id)
);

-- KOTH Gates Table
CREATE TABLE IF NOT EXISTS koth_gates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    gate_name VARCHAR(50) NOT NULL,
    gate_number INT NOT NULL,
    x_pos DECIMAL(10,2) NOT NULL,
    y_pos DECIMAL(10,2) NOT NULL,
    z_pos DECIMAL(10,2) NOT NULL,
    zone_size INT DEFAULT 50,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server_gate (server_id, gate_number),
    INDEX idx_server (server_id)
);

-- KOTH Participants Table
CREATE TABLE IF NOT EXISTS koth_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    player_steam_id VARCHAR(20) NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    is_winner BOOLEAN DEFAULT FALSE,
    reward_claimed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (event_id) REFERENCES koth_events(id) ON DELETE CASCADE,
    INDEX idx_event (event_id),
    INDEX idx_player (player_name),
    INDEX idx_steam_id (player_steam_id)
);

-- KOTH Event History Table
CREATE TABLE IF NOT EXISTS koth_event_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    server_id VARCHAR(32) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    gate_id INT NOT NULL,
    winner_name VARCHAR(100) NULL,
    winner_steam_id VARCHAR(20) NULL,
    total_participants INT DEFAULT 0,
    event_duration_seconds INT DEFAULT 0,
    reward_amount DECIMAL(10,2) DEFAULT 0.00,
    reward_currency VARCHAR(20) DEFAULT 'scrap',
    event_start_time TIMESTAMP NULL,
    event_end_time TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_server (server_id),
    INDEX idx_winner (winner_name),
    INDEX idx_date (created_at)
);

-- KOTH Configuration Table
CREATE TABLE IF NOT EXISTS koth_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    default_capture_time INT DEFAULT 300, -- 5 minutes
    default_countdown_time INT DEFAULT 60, -- 1 minute
    default_reward_amount DECIMAL(10,2) DEFAULT 1000.00,
    default_reward_currency VARCHAR(20) DEFAULT 'scrap',
    max_events_per_day INT DEFAULT 10,
    cooldown_minutes INT DEFAULT 30,
    auto_start_enabled BOOLEAN DEFAULT FALSE,
    auto_start_interval_minutes INT DEFAULT 120, -- 2 hours
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server (server_id)
);

-- Insert default KOTH gates (1-12) for each server
-- This will be handled by the application when servers are added
