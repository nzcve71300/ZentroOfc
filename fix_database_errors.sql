-- Fix database errors for Zentro Bot
-- This script addresses the "Table 'zentro_bot.servers' doesn't exist" error
-- and handles duplicate key errors

-- Create the missing servers table if it doesn't exist
CREATE TABLE IF NOT EXISTS `servers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `ip` varchar(45) NOT NULL,
  `port` int(11) NOT NULL,
  `password` varchar(255) NOT NULL,
  `guild_id` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_servers_guild` (`guild_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Handle duplicate key errors by dropping and recreating indexes if they exist
-- This is a safe way to handle the "Duplicate key name" errors

-- Drop indexes if they exist to avoid duplicate key errors
DROP INDEX IF EXISTS `idx_shop_kits_category` ON `shop_kits`;
DROP INDEX IF EXISTS `idx_eco_games_server` ON `eco_games`;
DROP INDEX IF EXISTS `idx_autokits_server` ON `autokits`;
DROP INDEX IF EXISTS `idx_kit_auth_server` ON `kit_auth`;
DROP INDEX IF EXISTS `idx_killfeed_server` ON `killfeed`;
DROP INDEX IF EXISTS `idx_players_guild_server` ON `players`;
DROP INDEX IF EXISTS `idx_players_discord` ON `players`;
DROP INDEX IF EXISTS `idx_shop_categories_server` ON `shop_categories`;
DROP INDEX IF EXISTS `idx_shop_items_category` ON `shop_items`;

-- Recreate the indexes (they will be created if the tables exist)
-- Note: These CREATE INDEX statements will only work if the tables exist
-- If tables don't exist, the errors will be ignored

-- Shop kits index
CREATE INDEX IF NOT EXISTS `idx_shop_kits_category` ON `shop_kits` (`category_id`);

-- Eco games index  
CREATE INDEX IF NOT EXISTS `idx_eco_games_server` ON `eco_games` (`server_id`);

-- Autokits index
CREATE INDEX IF NOT EXISTS `idx_autokits_server` ON `autokits` (`server_id`);

-- Kit auth index
CREATE INDEX IF NOT EXISTS `idx_kit_auth_server` ON `kit_auth` (`server_id`);

-- Killfeed index
CREATE INDEX IF NOT EXISTS `idx_killfeed_server` ON `killfeed` (`server_id`);

-- Players indexes
CREATE INDEX IF NOT EXISTS `idx_players_guild_server` ON `players` (`guild_id`, `server_id`);
CREATE INDEX IF NOT EXISTS `idx_players_discord` ON `players` (`discord_id`);

-- Shop categories index
CREATE INDEX IF NOT EXISTS `idx_shop_categories_server` ON `shop_categories` (`server_id`);

-- Shop items index
CREATE INDEX IF NOT EXISTS `idx_shop_items_category` ON `shop_items` (`category_id`);

-- Success message
SELECT 'Database fixes applied successfully!' as status; 