-- Add ZORP defaults table for server-specific configurations
CREATE TABLE IF NOT EXISTS zorp_defaults (
    id SERIAL PRIMARY KEY,
    server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
    size INTEGER DEFAULT 75,
    color_online TEXT DEFAULT '0,255,0',
    color_offline TEXT DEFAULT '255,0,0',
    radiation INTEGER DEFAULT 0,
    delay INTEGER DEFAULT 0,
    expire INTEGER DEFAULT 115200,
    min_team INTEGER DEFAULT 1,
    max_team INTEGER DEFAULT 8,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(server_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_zorp_defaults_server_id ON zorp_defaults(server_id); 