-- Add events configuration table
CREATE TABLE event_configs (
    id SERIAL PRIMARY KEY,
    server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    enabled BOOLEAN DEFAULT false,
    kill_message TEXT,
    respawn_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(server_id, event_type)
);

-- Insert default configurations for existing servers
INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message)
SELECT 
    rs.id,
    'bradley',
    false,
    '<color=#00ffff>Brad got taken</color>',
    '<color=#00ffff>Bradley APC has respawned</color>'
FROM rust_servers rs;

INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message)
SELECT 
    rs.id,
    'helicopter',
    false,
    '<color=#00ffff>Heli got taken</color>',
    '<color=#00ffff>Patrol Helicopter has respawned</color>'
FROM rust_servers rs; 