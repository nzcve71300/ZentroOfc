-- Clan System Database Tables (Fixed Version)

-- First, let's check if the required tables exist
-- If they don't exist, we'll create them without foreign keys initially

-- Clans table (without foreign keys first)
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
    UNIQUE KEY unique_server_tag (server_id, tag)
);

-- Clan members table (without foreign keys first)
CREATE TABLE IF NOT EXISTS clan_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clan_id INT NOT NULL,
    player_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_clan_player (clan_id, player_id)
);

-- Clan invites table (without foreign keys first)
CREATE TABLE IF NOT EXISTS clan_invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clan_id INT NOT NULL,
    invited_player_id INT NOT NULL,
    invited_by_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 24 HOUR),
    UNIQUE KEY unique_clan_invite (clan_id, invited_player_id)
);

-- Clan settings table (without foreign keys first)
CREATE TABLE IF NOT EXISTS clan_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server_settings (server_id)
);

-- Add indexes for better performance
CREATE INDEX idx_clans_server ON clans(server_id);
CREATE INDEX idx_clans_owner ON clans(owner_id);
CREATE INDEX idx_clan_members_clan ON clan_members(clan_id);
CREATE INDEX idx_clan_members_player ON clan_members(player_id);
CREATE INDEX idx_clan_invites_clan ON clan_invites(clan_id);
CREATE INDEX idx_clan_invites_player ON clan_invites(invited_player_id);

-- Now let's try to add foreign keys if the referenced tables exist
-- Check if rust_servers table exists and add foreign key
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'zentro_bot' AND table_name = 'rust_servers') > 0,
    'ALTER TABLE clans ADD CONSTRAINT fk_clans_server_id FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE',
    'SELECT "rust_servers table does not exist, skipping foreign key"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if players table exists and add foreign keys
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'zentro_bot' AND table_name = 'players') > 0,
    'ALTER TABLE clans ADD CONSTRAINT fk_clans_owner_id FOREIGN KEY (owner_id) REFERENCES players(id) ON DELETE CASCADE',
    'SELECT "players table does not exist, skipping foreign key"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'zentro_bot' AND table_name = 'players') > 0,
    'ALTER TABLE clans ADD CONSTRAINT fk_clans_co_owner_id FOREIGN KEY (co_owner_id) REFERENCES players(id) ON DELETE SET NULL',
    'SELECT "players table does not exist, skipping foreign key"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign keys to clan_members if referenced tables exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'zentro_bot' AND table_name = 'clans') > 0,
    'ALTER TABLE clan_members ADD CONSTRAINT fk_clan_members_clan_id FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE',
    'SELECT "clans table does not exist, skipping foreign key"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'zentro_bot' AND table_name = 'players') > 0,
    'ALTER TABLE clan_members ADD CONSTRAINT fk_clan_members_player_id FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE',
    'SELECT "players table does not exist, skipping foreign key"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign keys to clan_invites if referenced tables exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'zentro_bot' AND table_name = 'clans') > 0,
    'ALTER TABLE clan_invites ADD CONSTRAINT fk_clan_invites_clan_id FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE',
    'SELECT "clans table does not exist, skipping foreign key"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'zentro_bot' AND table_name = 'players') > 0,
    'ALTER TABLE clan_invites ADD CONSTRAINT fk_clan_invites_invited_player_id FOREIGN KEY (invited_player_id) REFERENCES players(id) ON DELETE CASCADE',
    'SELECT "players table does not exist, skipping foreign key"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'zentro_bot' AND table_name = 'players') > 0,
    'ALTER TABLE clan_invites ADD CONSTRAINT fk_clan_invites_invited_by_id FOREIGN KEY (invited_by_id) REFERENCES players(id) ON DELETE CASCADE',
    'SELECT "players table does not exist, skipping foreign key"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key to clan_settings if rust_servers table exists
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'zentro_bot' AND table_name = 'rust_servers') > 0,
    'ALTER TABLE clan_settings ADD CONSTRAINT fk_clan_settings_server_id FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE',
    'SELECT "rust_servers table does not exist, skipping foreign key"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt; 