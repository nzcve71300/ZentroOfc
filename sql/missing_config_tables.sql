-- Missing Configuration Tables and Columns
-- This script adds the missing tables and columns that the /set command expects

-- ==============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ==============================================

-- Add missing columns to teleport_configs table
ALTER TABLE teleport_configs 
ADD COLUMN IF NOT EXISTS teleport_name VARCHAR(50) NOT NULL DEFAULT 'default',
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS delay_minutes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS use_list BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS use_delay BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS use_kit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS kit_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS position_x DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS position_y DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS position_z DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS combat_lock_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS combat_lock_time_minutes INT DEFAULT 0;

-- Add missing columns to event_configs table
ALTER TABLE event_configs 
ADD COLUMN IF NOT EXISTS kill_message TEXT,
ADD COLUMN IF NOT EXISTS respawn_message TEXT;

-- Add missing columns to recycler_configs table
ALTER TABLE recycler_configs 
ADD COLUMN IF NOT EXISTS use_list BOOLEAN DEFAULT FALSE;

-- Add missing columns to prison_configs table
ALTER TABLE prison_configs 
ADD COLUMN IF NOT EXISTS zone_color VARCHAR(50) DEFAULT '(255,0,0)';

-- Add missing columns to zorp_configs table
-- (use_list already exists)

-- ==============================================
-- CREATE MISSING TABLES
-- ==============================================

-- Position Configs table (for OUTPOST and BANDIT)
CREATE TABLE IF NOT EXISTS position_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    position_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    delay_seconds INT DEFAULT 0,
    cooldown_minutes INT DEFAULT 5,
    combat_lock_enabled BOOLEAN DEFAULT FALSE,
    combat_lock_time_minutes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_position (server_id, position_type),
    INDEX idx_server_id (server_id),
    INDEX idx_position_type (position_type)
);

-- Crate Event Configs table
CREATE TABLE IF NOT EXISTS crate_event_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    crate_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    spawn_interval_minutes INT DEFAULT 60,
    spawn_amount INT DEFAULT 1,
    spawn_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_crate (server_id, crate_type),
    INDEX idx_server_id (server_id),
    INDEX idx_crate_type (crate_type)
);

-- Rider Config table (for Book-a-Ride)
CREATE TABLE IF NOT EXISTS rider_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    cooldown INT DEFAULT 300,
    horse_enabled BOOLEAN DEFAULT TRUE,
    rhib_enabled BOOLEAN DEFAULT TRUE,
    mini_enabled BOOLEAN DEFAULT FALSE,
    car_enabled BOOLEAN DEFAULT FALSE,
    fuel_amount INT DEFAULT 100,
    use_list BOOLEAN DEFAULT FALSE,
    welcome_message_enabled BOOLEAN DEFAULT TRUE,
    welcome_message_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server (server_id)
);

-- Economy Games Config table
CREATE TABLE IF NOT EXISTS eco_games_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    setting_name VARCHAR(100) NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_setting (server_id, setting_name),
    INDEX idx_server_id (server_id),
    INDEX idx_setting_name (setting_name)
);

-- Killfeed Configs table
CREATE TABLE IF NOT EXISTS killfeed_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    format_string VARCHAR(500) DEFAULT '{Killer} ☠️ {Victim}',
    randomizer_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server (server_id)
);

-- Bounty Configs table
CREATE TABLE IF NOT EXISTS bounty_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    reward_amount INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server (server_id)
);

-- ==============================================
-- UPDATE EXISTING TABLE CONSTRAINTS
-- ==============================================

-- Remove the unique constraint from teleport_configs since we now have multiple teleports per server
ALTER TABLE teleport_configs DROP INDEX IF EXISTS unique_server;

-- Add new unique constraint for server + teleport_name
ALTER TABLE teleport_configs ADD UNIQUE KEY unique_server_teleport (server_id, teleport_name);

-- ==============================================
-- INSERT DEFAULT DATA
-- ==============================================

-- Insert default teleport configurations for each server
-- This will be handled by the /set command when first used
