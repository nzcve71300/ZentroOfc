CREATE TABLE guilds (
    id SERIAL PRIMARY KEY,
    discord_id TEXT NOT NULL UNIQUE,
    name TEXT
);

CREATE TABLE rust_servers (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INT NOT NULL,
    password TEXT NOT NULL
);

CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
    discord_id TEXT,
    ign TEXT
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
    server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
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
    server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
    kit_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT false,
    cooldown INT,
    game_name TEXT
);

CREATE TABLE kit_auth (
    id SERIAL PRIMARY KEY,
    server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
    discord_id TEXT NOT NULL,
    kitlist TEXT NOT NULL
);

CREATE TABLE killfeed_configs (
    id SERIAL PRIMARY KEY,
    server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
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
    server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(server_id, channel_type)
);