-- Fix ZORP database schema to add missing columns
-- Run this SQL script to update the zorp_zones table

-- Add missing columns to zorp_zones table
ALTER TABLE zorp_zones 
ADD COLUMN IF NOT EXISTS color_yellow TEXT DEFAULT '255,255,0',
ADD COLUMN IF NOT EXISTS current_state TEXT DEFAULT 'white',
ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to zorp_defaults table
ALTER TABLE zorp_defaults 
ADD COLUMN IF NOT EXISTS color_yellow TEXT DEFAULT '255,255,0',
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;

-- Update existing zones to have proper state
UPDATE zorp_zones 
SET current_state = 'green', 
    last_online_at = CURRENT_TIMESTAMP 
WHERE current_state IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_zorp_zones_owner ON zorp_zones(owner);
CREATE INDEX IF NOT EXISTS idx_zorp_zones_server_id ON zorp_zones(server_id);
CREATE INDEX IF NOT EXISTS idx_zorp_zones_current_state ON zorp_zones(current_state);
CREATE INDEX IF NOT EXISTS idx_zorp_zones_expiry ON zorp_zones(created_at, expire);

-- Clean up any expired zones
DELETE FROM zorp_zones 
WHERE created_at + INTERVAL expire SECOND < CURRENT_TIMESTAMP;

SELECT 'ZORP database schema updated successfully' as result;
