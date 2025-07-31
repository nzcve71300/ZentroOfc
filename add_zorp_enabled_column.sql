-- Add enabled column to zorp_defaults table
ALTER TABLE zorp_defaults ADD COLUMN enabled BOOLEAN DEFAULT TRUE;

-- Update existing records to be enabled by default
UPDATE zorp_defaults SET enabled = TRUE WHERE enabled IS NULL; 