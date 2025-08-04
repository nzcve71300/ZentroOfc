-- Clan System Database Tables

-- Clans table
CREATE TABLE IF NOT EXISTS clans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    tag VARCHAR(4) NOT NULL,
    color VARCHAR(7) NOT NULL,
    owner_id INT NOT NULL,
    co_owner_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server_clan (server_id, name),
    UNIQUE KEY unique_server_tag (server_id, tag),
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (co_owner_id) REFERENCES players(id) ON DELETE SET NULL
);

-- Clan members table
CREATE TABLE IF NOT EXISTS clan_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clan_id INT NOT NULL,
    player_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_clan_player (clan_id, player_id),
    FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Clan invites table
CREATE TABLE IF NOT EXISTS clan_invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clan_id INT NOT NULL,
    invited_player_id INT NOT NULL,
    invited_by_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 24 HOUR),
    UNIQUE KEY unique_clan_invite (clan_id, invited_player_id),
    FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Clan settings table
CREATE TABLE IF NOT EXISTS clan_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server_settings (server_id),
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX idx_clans_server ON clans(server_id);
CREATE INDEX idx_clans_owner ON clans(owner_id);
CREATE INDEX idx_clan_members_clan ON clan_members(clan_id);
CREATE INDEX idx_clan_members_player ON clan_members(player_id);
CREATE INDEX idx_clan_invites_clan ON clan_invites(clan_id);
CREATE INDEX idx_clan_invites_player ON clan_invites(invited_player_id); 