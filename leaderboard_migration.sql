-- Leaderboard Settings Migration
-- This adds the table for storing leaderboard channel settings

CREATE TABLE IF NOT EXISTS `leaderboard_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `guild_id` int(11) NOT NULL,
  `channel_id` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_guild_leaderboard` (`guild_id`),
  KEY `idx_leaderboard_guild` (`guild_id`),
  FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add index for performance
CREATE INDEX IF NOT EXISTS `idx_leaderboard_channel` ON `leaderboard_settings` (`channel_id`);

SELECT 'Leaderboard settings table created successfully!' as status; 