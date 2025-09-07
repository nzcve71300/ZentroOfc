-- Migration: Add normalized_ign column and admin unlink support
-- Date: 2025-09-07

-- Add normalized_ign column if it doesn't exist
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS normalized_ign VARCHAR(128) 
CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

-- Add unlink tracking columns if they don't exist
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS unlinked_at DATETIME NULL;

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS unlinked_by VARCHAR(32) NULL;

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS unlink_reason VARCHAR(255) NULL;

-- Create unique index for server_id + normalized_ign if it doesn't exist
-- This prevents duplicate active links within the same server
CREATE UNIQUE INDEX IF NOT EXISTS ux_players_server_normign 
ON players (server_id, normalized_ign);

-- Backfill normalized_ign for existing records
-- This will be handled by the application code to ensure proper normalization
