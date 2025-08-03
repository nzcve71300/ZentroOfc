-- Update scheduler_messages table to include pair_number field
ALTER TABLE scheduler_messages ADD COLUMN pair_number INT DEFAULT 1;

-- Update existing records to have pair_number = 1 (if any exist)
UPDATE scheduler_messages SET pair_number = 1 WHERE pair_number IS NULL;

-- Add unique constraint to prevent duplicate pairs per server
ALTER TABLE scheduler_messages ADD UNIQUE KEY unique_server_pair (server_id, pair_number); 