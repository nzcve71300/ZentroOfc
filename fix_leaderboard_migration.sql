-- Fix for leaderboard migration
-- This adds the missing index to guilds table and creates the leaderboard settings

-- First, add the missing index to guilds table
CREATE INDEX IF NOT EXISTS `idx_guilds_id` ON `guilds` (`id`);

-- Create the leaderboard settings table without foreign key initially
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

-- Now add the foreign key constraint (should work now with the index)
SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE `leaderboard_settings` 
ADD CONSTRAINT `fk_leaderboard_guild` 
FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON DELETE CASCADE;
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Leaderboard settings table created successfully!' as status; 