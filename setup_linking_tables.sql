-- Setup new linking system tables
-- Run this after the main schema.sql

-- Create player_links table
CREATE TABLE IF NOT EXISTS player_links (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    discord_id VARCHAR(32) NOT NULL,
    ign TEXT NOT NULL,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    linked_at TIMESTAMP DEFAULT NOW(),
    unlinked_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(guild_id, discord_id, server_id)
);

-- Create link_requests table
CREATE TABLE IF NOT EXISTS link_requests (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    discord_id VARCHAR(32) NOT NULL,
    ign TEXT NOT NULL,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    requested_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 hour'),
    status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'expired', 'cancelled'
    UNIQUE(guild_id, discord_id, server_id)
);

-- Create link_blocks table
CREATE TABLE IF NOT EXISTS link_blocks (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    discord_id VARCHAR(32) NULL,
    ign TEXT NULL,
    blocked_at TIMESTAMP DEFAULT NOW(),
    blocked_by VARCHAR(32) NOT NULL,
    reason TEXT,
    is_active BOOLEAN DEFAULT true,
    -- Either discord_id or ign must be provided, but not both
    CHECK ((discord_id IS NOT NULL AND ign IS NULL) OR (discord_id IS NULL AND ign IS NOT NULL))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_links_guild_discord ON player_links(guild_id, discord_id);
CREATE INDEX IF NOT EXISTS idx_player_links_guild_ign ON player_links(guild_id, ign);
CREATE INDEX IF NOT EXISTS idx_player_links_active ON player_links(is_active);

CREATE INDEX IF NOT EXISTS idx_link_requests_guild_discord ON link_requests(guild_id, discord_id);
CREATE INDEX IF NOT EXISTS idx_link_requests_status ON link_requests(status);
CREATE INDEX IF NOT EXISTS idx_link_requests_expires ON link_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_discord ON link_blocks(guild_id, discord_id);
CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_ign ON link_blocks(guild_id, ign);
CREATE INDEX IF NOT EXISTS idx_link_blocks_active ON link_blocks(is_active);

-- Migrate existing player links to the new system
-- This will create player_links records for existing players with discord_id set
INSERT INTO player_links (guild_id, discord_id, ign, server_id, linked_at, is_active)
SELECT 
    p.guild_id,
    p.discord_id,
    p.ign,
    p.server_id,
    NOW(),
    true
FROM players p
WHERE p.discord_id IS NOT NULL
ON CONFLICT (guild_id, discord_id, server_id) DO NOTHING;

-- Clean up expired link requests
DELETE FROM link_requests WHERE expires_at < NOW() AND status = 'pending'; 