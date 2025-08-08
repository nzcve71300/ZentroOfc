-- Simple Leaderboard Settings Migration
-- This creates the leaderboard table without foreign key constraints

-- Create the leaderboard settings table without foreign key
CREATE TABLE IF NOT EXISTS `leaderboard_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `guild_id` int(11) NOT NULL,
  `channel_id` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_guild_leaderboard` (`guild_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS `idx_leaderboard_guild` ON `leaderboard_settings` (`guild_id`);
CREATE INDEX IF NOT EXISTS `idx_leaderboard_channel` ON `leaderboard_settings` (`channel_id`);

-- Show the table was created successfully
SELECT 'Leaderboard settings table created successfully!' as status;
SELECT COUNT(*) as table_count FROM leaderboard_settings; 