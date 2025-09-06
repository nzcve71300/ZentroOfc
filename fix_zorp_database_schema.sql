-- Fix Zorp Database Schema - Add Missing State Management Columns
-- This script adds the missing columns that the monitorZorpZonesRockSolid function expects

-- Add desired_state column (what state the zone should be in)
ALTER TABLE zorp_zones 
ADD COLUMN desired_state ENUM('white', 'green', 'yellow', 'red') DEFAULT 'white';

-- Add applied_state column (what state is currently applied in the game)
ALTER TABLE zorp_zones 
ADD COLUMN applied_state ENUM('white', 'green', 'yellow', 'red') DEFAULT 'white';

-- Add last_offline_at column for tracking when player went offline
ALTER TABLE zorp_zones 
ADD COLUMN last_offline_at TIMESTAMP NULL;

-- Add last_online_at column for tracking when player came online
ALTER TABLE zorp_zones 
ADD COLUMN last_online_at TIMESTAMP NULL;

-- Add color_yellow column for yellow state color
ALTER TABLE zorp_zones 
ADD COLUMN color_yellow TEXT DEFAULT '255,255,0';

-- Update existing records to have proper initial states
UPDATE zorp_zones 
SET desired_state = COALESCE(current_state, 'green'),
    applied_state = COALESCE(current_state, 'green'),
    last_online_at = COALESCE(last_online_at, created_at)
WHERE desired_state IS NULL OR applied_state IS NULL;

-- Add indexes for better performance on state queries
CREATE INDEX idx_zorp_zones_desired_state ON zorp_zones(desired_state);
CREATE INDEX idx_zorp_zones_applied_state ON zorp_zones(applied_state);
CREATE INDEX idx_zorp_zones_last_offline_at ON zorp_zones(last_offline_at);
CREATE INDEX idx_zorp_zones_last_online_at ON zorp_zones(last_online_at);

-- Add comments to document the new columns
ALTER TABLE zorp_zones 
MODIFY COLUMN desired_state ENUM('white', 'green', 'yellow', 'red') DEFAULT 'white' 
COMMENT 'The state the zone should be in (managed by monitoring system)';

ALTER TABLE zorp_zones 
MODIFY COLUMN applied_state ENUM('white', 'green', 'yellow', 'red') DEFAULT 'white' 
COMMENT 'The state currently applied in the game';

ALTER TABLE zorp_zones 
MODIFY COLUMN last_offline_at TIMESTAMP NULL 
COMMENT 'When the player last went offline (used for yellow->red transition timing)';

ALTER TABLE zorp_zones 
MODIFY COLUMN last_online_at TIMESTAMP NULL 
COMMENT 'When the player last came online (used for green state management)';

ALTER TABLE zorp_zones 
MODIFY COLUMN color_yellow TEXT DEFAULT '255,255,0' 
COMMENT 'RGB color for yellow state (format: r,g,b)';

-- Verify the changes
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'zorp_zones' 
AND COLUMN_NAME IN ('desired_state', 'applied_state', 'last_offline_at', 'last_online_at', 'color_yellow')
ORDER BY ORDINAL_POSITION;

-- Show current state of zones
SELECT 
    name,
    owner,
    current_state,
    desired_state,
    applied_state,
    last_online_at,
    last_offline_at,
    created_at
FROM zorp_zones 
WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
ORDER BY created_at DESC
LIMIT 10;