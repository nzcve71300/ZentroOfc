-- Fix guild_id column in rust_servers table
-- This script handles foreign key constraints properly

-- Step 1: Drop the foreign key constraint
ALTER TABLE rust_servers DROP FOREIGN KEY rust_servers_ibfk_1;

-- Step 2: Modify the guild_id column to BIGINT UNSIGNED
ALTER TABLE rust_servers MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL;

-- Step 3: Recreate the foreign key constraint
ALTER TABLE rust_servers 
ADD CONSTRAINT rust_servers_ibfk_1 
FOREIGN KEY (guild_id) REFERENCES subscriptions(guild_id);

-- Verify the change
DESCRIBE rust_servers; 