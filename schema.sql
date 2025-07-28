CREATE TABLE guilds (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(32) NOT NULL UNIQUE,
    name TEXT
);

CREATE TABLE rust_servers (
    id VARCHAR(32) PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INT NOT NULL,
    password TEXT NOT NULL
);

CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    discord_id VARCHAR(32),
    ign TEXT
);

-- New linking system tables
CREATE TABLE player_links (
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

CREATE TABLE link_requests (
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

CREATE TABLE link_blocks (
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

CREATE TABLE economy (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    balance INT DEFAULT 0
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    type TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shop_categories (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    role TEXT
);

CREATE TABLE shop_items (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES shop_categories(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    price INT NOT NULL,
    quantity INT NOT NULL,
    timer INT
);

CREATE TABLE shop_kits (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES shop_categories(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    kit_name TEXT NOT NULL,
    price INT NOT NULL,
    quantity INT NOT NULL,
    timer INT
);

CREATE TABLE autokits (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    kit_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT false,
    cooldown INT,
    game_name TEXT
);

CREATE TABLE kit_auth (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    discord_id VARCHAR(32) NOT NULL,
    kitlist TEXT NOT NULL
);

CREATE TABLE killfeed_configs (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    format_string TEXT,
    randomizer_enabled BOOLEAN DEFAULT false
);

CREATE TABLE player_stats (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    kill_streak INTEGER DEFAULT 0,
    highest_streak INTEGER DEFAULT 0,
    last_kill_time TIMESTAMP DEFAULT NOW()
);

CREATE TABLE channel_settings (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(server_id, channel_type)
);

CREATE TABLE position_coordinates (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    position_type TEXT NOT NULL,
    x_pos TEXT,
    y_pos TEXT,
    z_pos TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(server_id, position_type)
);

CREATE TABLE zones (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    team JSONB,
    position JSONB,
    size INTEGER DEFAULT 75,
    color_online TEXT DEFAULT '0,255,0',
    color_offline TEXT DEFAULT '255,0,0',
    radiation INTEGER DEFAULT 0,
    delay INTEGER DEFAULT 0,
    expire INTEGER DEFAULT 115200,
    min_team INTEGER DEFAULT 1,
    max_team INTEGER DEFAULT 8,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
