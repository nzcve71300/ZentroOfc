-- Database Migration Script
-- Run this in psql or pgAdmin as the postgres superuser

-- Convert all ID columns to VARCHAR(32)
ALTER TABLE players ALTER COLUMN id TYPE VARCHAR(32) USING id::text;
ALTER TABLE guilds ALTER COLUMN id TYPE VARCHAR(32) USING id::text;
ALTER TABLE rust_servers ALTER COLUMN id TYPE VARCHAR(32) USING id::text;
ALTER TABLE economy ALTER COLUMN id TYPE VARCHAR(32) USING id::text;
ALTER TABLE player_stats ALTER COLUMN id TYPE VARCHAR(32) USING id::text;
ALTER TABLE transactions ALTER COLUMN id TYPE VARCHAR(32) USING id::text;

-- Convert foreign key columns
ALTER TABLE player_stats ALTER COLUMN player_id TYPE VARCHAR(32) USING player_id::text;
ALTER TABLE transactions ALTER COLUMN player_id TYPE VARCHAR(32) USING player_id::text;
ALTER TABLE economy ALTER COLUMN player_id TYPE VARCHAR(32) USING player_id::text;
ALTER TABLE autokits ALTER COLUMN server_id TYPE VARCHAR(32) USING server_id::text;
ALTER TABLE kit_auth ALTER COLUMN server_id TYPE VARCHAR(32) USING server_id::text;
ALTER TABLE killfeed_configs ALTER COLUMN server_id TYPE VARCHAR(32) USING server_id::text;
ALTER TABLE shop_categories ALTER COLUMN server_id TYPE VARCHAR(32) USING server_id::text;
ALTER TABLE rust_servers ALTER COLUMN guild_id TYPE VARCHAR(32) USING guild_id::text;

-- Drop existing constraints
ALTER TABLE player_stats DROP CONSTRAINT IF EXISTS player_stats_player_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_player_id_fkey;
ALTER TABLE economy DROP CONSTRAINT IF EXISTS economy_player_id_fkey;
ALTER TABLE autokits DROP CONSTRAINT IF EXISTS autokits_server_id_fkey;
ALTER TABLE kit_auth DROP CONSTRAINT IF EXISTS kit_auth_server_id_fkey;
ALTER TABLE killfeed_configs DROP CONSTRAINT IF EXISTS killfeed_configs_server_id_fkey;
ALTER TABLE shop_categories DROP CONSTRAINT IF EXISTS shop_categories_server_id_fkey;
ALTER TABLE rust_servers DROP CONSTRAINT IF EXISTS rust_servers_guild_id_fkey;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_guild_id_fkey;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_server_id_fkey;

-- Recreate constraints
ALTER TABLE player_stats ADD CONSTRAINT player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id);
ALTER TABLE transactions ADD CONSTRAINT transactions_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id);
ALTER TABLE economy ADD CONSTRAINT economy_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id);
ALTER TABLE autokits ADD CONSTRAINT autokits_server_id_fkey FOREIGN KEY (server_id) REFERENCES rust_servers(id);
ALTER TABLE kit_auth ADD CONSTRAINT kit_auth_server_id_fkey FOREIGN KEY (server_id) REFERENCES rust_servers(id);
ALTER TABLE killfeed_configs ADD CONSTRAINT killfeed_configs_server_id_fkey FOREIGN KEY (server_id) REFERENCES rust_servers(id);
ALTER TABLE shop_categories ADD CONSTRAINT shop_categories_server_id_fkey FOREIGN KEY (server_id) REFERENCES rust_servers(id);
ALTER TABLE rust_servers ADD CONSTRAINT rust_servers_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES guilds(id);
ALTER TABLE players ADD CONSTRAINT players_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES guilds(id);
ALTER TABLE players ADD CONSTRAINT players_server_id_fkey FOREIGN KEY (server_id) REFERENCES rust_servers(id);

-- Grant permissions to zentro_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zentro_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zentro_user; 