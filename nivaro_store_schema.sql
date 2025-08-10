-- Nivaro Store System Schema for Discord Bot Integration
-- This adds store management tables to the existing Zentro Bot database

-- Pending stores waiting for Discord verification
CREATE TABLE IF NOT EXISTS pending_stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    secret_key VARCHAR(64) NOT NULL UNIQUE,
    store_name VARCHAR(255) NOT NULL,
    store_url VARCHAR(500) NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 10 MINUTE),
    is_used BOOLEAN DEFAULT FALSE,
    INDEX idx_secret_key (secret_key),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_used (is_used)
);

-- Verified and active stores
CREATE TABLE IF NOT EXISTS stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_name VARCHAR(255) NOT NULL,
    store_url VARCHAR(500) NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_is_active (is_active),
    INDEX idx_owner_email (owner_email)
);

-- Mapping between Discord servers and stores
CREATE TABLE IF NOT EXISTS discord_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    discord_guild_id BIGINT NOT NULL,
    discord_guild_name VARCHAR(255) NOT NULL,
    linked_by_user_id BIGINT NOT NULL,
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE KEY unique_store_guild (store_id, discord_guild_id),
    INDEX idx_discord_guild_id (discord_guild_id),
    INDEX idx_is_active (is_active)
);

-- Rate limiting table for API endpoints
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    endpoint VARCHAR(100) NOT NULL,
    request_count INT DEFAULT 1,
    first_request_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_request_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ip_endpoint (ip_address, endpoint),
    INDEX idx_last_request (last_request_at)
);

-- Clean up expired pending stores (run this periodically)
-- DELETE FROM pending_stores WHERE expires_at < NOW() AND is_used = FALSE; 