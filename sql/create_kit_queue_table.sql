-- Create kit delivery queue table
CREATE TABLE IF NOT EXISTS kit_delivery_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    guild_id BIGINT NOT NULL,
    server_id VARCHAR(32) NOT NULL,
    kit_id INT NOT NULL,
    kit_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    remaining_quantity INT NOT NULL,
    original_quantity INT NOT NULL,
    price_per_kit INT NOT NULL,
    total_paid INT NOT NULL,
    emote_reaction VARCHAR(100) NOT NULL DEFAULT '📦',
    message_id BIGINT,
    channel_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_delivered_at TIMESTAMP NULL,
    cooldown_seconds INT DEFAULT 5,
    
    INDEX idx_player_server (player_id, server_id),
    INDEX idx_message_id (message_id),
    INDEX idx_guild_id (guild_id),
    
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    FOREIGN KEY (kit_id) REFERENCES shop_kits(id) ON DELETE CASCADE
);
