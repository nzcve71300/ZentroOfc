-- Unified Database Schema for Zentro Bot + Web App
-- This schema merges the existing bot database with the web app requirements

-- ==============================================
-- CORE TABLES (Existing Bot Tables)
-- ==============================================

-- Servers table (unified from rust_servers + new servers table)
CREATE TABLE IF NOT EXISTS servers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    server_key VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    region VARCHAR(50),
    web_rcon_host VARCHAR(255),
    web_rcon_port INT,
    secret_ref VARCHAR(255), -- Reference to encrypted RCON password
    created_by VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_guild_server (guild_id, server_key),
    INDEX idx_guild_id (guild_id),
    INDEX idx_created_by (created_by)
);

-- Players table (unified from players + app_users)
CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    discord_id VARCHAR(32),
    app_user_id INT, -- Links to app_users table
    ign VARCHAR(255) NOT NULL,
    steam_id VARCHAR(32),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    INDEX idx_server_id (server_id),
    INDEX idx_discord_id (discord_id),
    INDEX idx_app_user_id (app_user_id),
    INDEX idx_ign (ign)
);

-- App Users table (for web app authentication)
CREATE TABLE IF NOT EXISTS app_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discord_id VARCHAR(32) UNIQUE,
    ign VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_discord_id (discord_id),
    INDEX idx_ign (ign),
    INDEX idx_email (email)
);

-- Player Balances (unified economy)
CREATE TABLE IF NOT EXISTS player_balances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    server_id INT NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    total_spent DECIMAL(15,2) DEFAULT 0.00,
    last_transaction_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_player_server (player_id, server_id),
    INDEX idx_player_id (player_id),
    INDEX idx_server_id (server_id)
);

-- ==============================================
-- SHOP SYSTEM TABLES
-- ==============================================

-- Shop Categories
CREATE TABLE IF NOT EXISTS shop_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('item', 'kit', 'vehicle') NOT NULL,
    role VARCHAR(32), -- Discord role required to access
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    INDEX idx_server_id (server_id),
    INDEX idx_type (type)
);

-- Shop Items
CREATE TABLE IF NOT EXISTS shop_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    category_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    command TEXT NOT NULL, -- RCON command to execute
    icon_url VARCHAR(500),
    cooldown_minutes INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES shop_categories(id) ON DELETE CASCADE,
    INDEX idx_server_id (server_id),
    INDEX idx_category_id (category_id),
    INDEX idx_price (price),
    INDEX idx_is_active (is_active)
);

-- ==============================================
-- BOT CONFIGURATION TABLES
-- ==============================================

-- Home Teleport Configs
CREATE TABLE IF NOT EXISTS home_teleport_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    use_list BOOLEAN DEFAULT FALSE,
    whitelist_enabled BOOLEAN DEFAULT FALSE,
    cooldown_minutes INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server (server_id)
);

-- Home Teleport Allowed Users
CREATE TABLE IF NOT EXISTS home_teleport_allowed_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    player_id INT NOT NULL,
    added_by VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_player (server_id, player_id)
);

-- Home Teleport Banned Users
CREATE TABLE IF NOT EXISTS home_teleport_banned_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    player_id INT NOT NULL,
    banned_by VARCHAR(32),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_player (server_id, player_id)
);

-- Night Skip Configs
CREATE TABLE IF NOT EXISTS night_skip_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    skip_time VARCHAR(10) DEFAULT '22:00',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server (server_id)
);

-- Event Configs
CREATE TABLE IF NOT EXISTS event_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    event_type VARCHAR(100) NOT NULL,
    config_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    INDEX idx_server_id (server_id),
    INDEX idx_event_type (event_type)
);

-- Teleport Configs
CREATE TABLE IF NOT EXISTS teleport_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    cooldown_minutes INT DEFAULT 5,
    max_distance INT DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server (server_id)
);

-- Zorp Configs
CREATE TABLE IF NOT EXISTS zorp_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    use_list BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server (server_id)
);

-- Recycler Configs
CREATE TABLE IF NOT EXISTS recycler_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    cooldown_minutes INT DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server (server_id)
);

-- Prison Configs
CREATE TABLE IF NOT EXISTS prison_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    zone_size INT DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server (server_id)
);

-- ==============================================
-- SUBSCRIPTION SYSTEM TABLES
-- ==============================================

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL UNIQUE,
    plan_name VARCHAR(255) NOT NULL,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_guild_id (guild_id),
    INDEX idx_is_active (is_active)
);

-- Subscription Features
CREATE TABLE IF NOT EXISTS subscription_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_id INT NOT NULL,
    feature_name VARCHAR(255) NOT NULL,
    feature_value TEXT,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_subscription_feature (subscription_id, feature_name)
);

-- Subscription Logs
CREATE TABLE IF NOT EXISTS subscription_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    action ENUM('created', 'updated', 'cancelled', 'expired', 'renewed') NOT NULL,
    subscription_type ENUM('premium', 'vip', 'elite') NOT NULL,
    details TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_guild_id (guild_id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE
);

-- Subscription Payments
CREATE TABLE IF NOT EXISTS subscription_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    subscription_type ENUM('premium', 'vip', 'elite') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    payment_id VARCHAR(255) NULL,
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_guild_id (guild_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id) ON DELETE CASCADE
);

-- ==============================================
-- AUDIT AND LOGGING TABLES
-- ==============================================

-- Server Events (for tracking all server activities)
CREATE TABLE IF NOT EXISTS server_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    player_id INT,
    event_type VARCHAR(100) NOT NULL,
    event_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
    INDEX idx_server_id (server_id),
    INDEX idx_player_id (player_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
);

-- Audit Logs (for tracking all data mutations)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(32),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_resource_type (resource_type),
    INDEX idx_created_at (created_at)
);

-- ==============================================
-- LEGACY COMPATIBILITY TABLES
-- ==============================================

-- Keep existing rust_servers table for backward compatibility
-- This will be populated from the new servers table
CREATE TABLE IF NOT EXISTS rust_servers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    nickname VARCHAR(255) NOT NULL,
    ip VARCHAR(255) NOT NULL,
    port INT NOT NULL,
    password VARCHAR(255) NOT NULL,
    currency_name VARCHAR(100) DEFAULT 'coins',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_guild_id (guild_id),
    INDEX idx_nickname (nickname)
);

-- Keep existing economy table for backward compatibility
CREATE TABLE IF NOT EXISTS economy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    server_id INT NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    total_spent DECIMAL(15,2) DEFAULT 0.00,
    last_transaction_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE KEY unique_player_server (player_id, server_id),
    INDEX idx_player_id (player_id),
    INDEX idx_server_id (server_id)
);

-- ==============================================
-- VIEWS FOR EASY QUERYING
-- ==============================================

-- View for server with player count
CREATE OR REPLACE VIEW server_stats AS
SELECT 
    s.id,
    s.guild_id,
    s.display_name,
    s.region,
    COUNT(p.id) as player_count,
    s.created_at
FROM servers s
LEFT JOIN players p ON s.id = p.server_id AND p.is_active = TRUE
GROUP BY s.id, s.guild_id, s.display_name, s.region, s.created_at;

-- View for player with balance
CREATE OR REPLACE VIEW player_with_balance AS
SELECT 
    p.id,
    p.server_id,
    p.discord_id,
    p.ign,
    p.steam_id,
    COALESCE(pb.balance, 0) as balance,
    pb.total_spent,
    pb.last_transaction_at,
    p.is_active,
    p.created_at
FROM players p
LEFT JOIN player_balances pb ON p.id = pb.player_id AND p.server_id = pb.server_id;

-- ==============================================
-- STORED PROCEDURES (MariaDB Compatible)
-- ==============================================

-- Procedure to transfer balance between players
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS TransferBalance(
    IN from_player_id INT,
    IN to_player_id INT,
    IN server_id INT,
    IN amount DECIMAL(15,2),
    IN transfer_reason VARCHAR(255)
)
BEGIN
    DECLARE from_balance DECIMAL(15,2) DEFAULT 0;
    DECLARE to_balance DECIMAL(15,2) DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Get current balances
    SELECT COALESCE(balance, 0) INTO from_balance 
    FROM player_balances 
    WHERE player_id = from_player_id AND server_id = server_id;
    
    SELECT COALESCE(balance, 0) INTO to_balance 
    FROM player_balances 
    WHERE player_id = to_player_id AND server_id = server_id;
    
    -- Check if sender has enough balance
    IF from_balance < amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient balance';
    END IF;
    
    -- Update sender balance
    INSERT INTO player_balances (player_id, server_id, balance, total_spent, last_transaction_at)
    VALUES (from_player_id, server_id, from_balance - amount, 0, NOW())
    ON DUPLICATE KEY UPDATE
        balance = balance - amount,
        last_transaction_at = NOW(),
        updated_at = NOW();
    
    -- Update receiver balance
    INSERT INTO player_balances (player_id, server_id, balance, total_spent, last_transaction_at)
    VALUES (to_player_id, server_id, to_balance + amount, 0, NOW())
    ON DUPLICATE KEY UPDATE
        balance = balance + amount,
        last_transaction_at = NOW(),
        updated_at = NOW();
    
    -- Log the transaction
    INSERT INTO server_events (server_id, player_id, event_type, event_data)
    VALUES (server_id, from_player_id, 'balance_transfer', JSON_OBJECT(
        'from_player_id', from_player_id,
        'to_player_id', to_player_id,
        'amount', amount,
        'reason', transfer_reason
    ));
    
    COMMIT;
END //
DELIMITER ;

-- ==============================================
-- INITIAL DATA SETUP
-- ==============================================

-- Insert default subscription features
INSERT IGNORE INTO subscription_features (subscription_type, feature_name, is_enabled) VALUES
('premium', 'unlimited_teleports', TRUE),
('premium', 'priority_support', TRUE),
('vip', 'unlimited_teleports', TRUE),
('vip', 'priority_support', TRUE),
('vip', 'custom_kit_access', TRUE),
('elite', 'unlimited_teleports', TRUE),
('elite', 'priority_support', TRUE),
('elite', 'custom_kit_access', TRUE),
('elite', 'admin_commands', TRUE),
('elite', 'server_management', TRUE);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_servers_guild_created_by ON servers(guild_id, created_by);
CREATE INDEX IF NOT EXISTS idx_players_server_active ON players(server_id, is_active);
CREATE INDEX IF NOT EXISTS idx_player_balances_balance ON player_balances(balance);
CREATE INDEX IF NOT EXISTS idx_shop_items_price_active ON shop_items(price, is_active);
CREATE INDEX IF NOT EXISTS idx_server_events_type_created ON server_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);

-- ==============================================
-- COMMENTS
-- ==============================================

-- Add table comments for documentation
ALTER TABLE servers COMMENT = 'Unified servers table for both Discord bot and web app';
ALTER TABLE players COMMENT = 'Players linked to both Discord and web app';
ALTER TABLE app_users COMMENT = 'Web app user accounts';
ALTER TABLE player_balances COMMENT = 'Player economy balances';
ALTER TABLE shop_categories COMMENT = 'Store categories for items/kits/vehicles';
ALTER TABLE shop_items COMMENT = 'Store items with RCON commands';
ALTER TABLE server_events COMMENT = 'All server activity tracking';
ALTER TABLE audit_logs COMMENT = 'All data mutation tracking';