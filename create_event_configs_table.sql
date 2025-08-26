-- Event Configuration Table
CREATE TABLE IF NOT EXISTS event_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    event_type ENUM('bradley', 'helicopter') NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    kill_message TEXT,
    respawn_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_event (server_id, event_type)
);

-- Create indexes for better performance
CREATE INDEX idx_event_configs_server ON event_configs(server_id);
CREATE INDEX idx_event_configs_type ON event_configs(event_type);
CREATE INDEX idx_event_configs_enabled ON event_configs(enabled);
