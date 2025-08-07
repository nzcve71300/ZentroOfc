-- Simple database fix for Zentro Bot
-- This script only creates the missing servers table

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

-- Success message
SELECT 'Servers table created successfully!' as status; 