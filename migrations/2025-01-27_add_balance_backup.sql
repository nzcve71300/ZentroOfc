-- Migration: Add balance backup system for player unlinking
-- Date: 2025-01-27
-- Purpose: Backup player balances before unlinking so they can be restored when re-linking

-- Create backup table for player balances
CREATE TABLE IF NOT EXISTS player_balance_backup (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id INT NOT NULL,
    server_id VARCHAR(32) NOT NULL,
    discord_id BIGINT NOT NULL,
    ign VARCHAR(255) NOT NULL,
    normalized_ign VARCHAR(128) NOT NULL,
    balance INT NOT NULL DEFAULT 0,
    backed_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    restored_at TIMESTAMP NULL,
    INDEX idx_backup_guild_discord (guild_id, discord_id),
    INDEX idx_backup_server_ign (server_id, normalized_ign),
    INDEX idx_backup_restored (restored_at)
);

-- Add comment to explain the table purpose
ALTER TABLE player_balance_backup 
COMMENT = 'Backup table for player balances before unlinking - allows balance restoration when re-linking';
