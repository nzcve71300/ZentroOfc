-- Create zorp_zones table
CREATE TABLE zorp_zones (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    team JSON,
    position JSON,
    size INTEGER DEFAULT 75,
    color_online TEXT DEFAULT '0,255,0',
    color_offline TEXT DEFAULT '255,0,0',
    radiation INTEGER DEFAULT 0,
    delay INTEGER DEFAULT 0,
    expire INTEGER DEFAULT 126000, -- 35 hours in seconds
    min_team INTEGER DEFAULT 1,
    max_team INTEGER DEFAULT 8,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create zorp_defaults table if it doesn't exist
CREATE TABLE IF NOT EXISTS zorp_defaults (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    size INTEGER DEFAULT 75,
    color_online TEXT DEFAULT '0,255,0',
    color_offline TEXT DEFAULT '255,0,0',
    radiation INTEGER DEFAULT 0,
    delay INTEGER DEFAULT 0,
    expire INTEGER DEFAULT 126000, -- 35 hours in seconds
    min_team INTEGER DEFAULT 1,
    max_team INTEGER DEFAULT 8,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(server_id)
); 