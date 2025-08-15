-- Add new columns for enhanced ZORP system
ALTER TABLE zorp_zones 
ADD COLUMN IF NOT EXISTS current_state VARCHAR(10) DEFAULT 'white',
ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS transition_timer_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS color_yellow TEXT DEFAULT '255,255,0';

ALTER TABLE zorp_defaults 
ADD COLUMN IF NOT EXISTS color_yellow TEXT DEFAULT '255,255,0';

-- Update delay column to be in minutes instead of seconds
UPDATE zorp_defaults SET delay = 5 WHERE delay = 0;
UPDATE zorp_zones SET delay = 5 WHERE delay = 0;
