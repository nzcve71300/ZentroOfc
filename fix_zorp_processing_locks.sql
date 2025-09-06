-- Fix ZORP Processing Locks Table
-- This script creates or updates the zorp_processing_locks table to fix the missing owner_id column error

-- First, check if the table exists and what columns it has
SELECT 'Checking current table structure...' as status;

-- Create the table if it doesn't exist, or add missing columns if it does
CREATE TABLE IF NOT EXISTS zorp_processing_locks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(255) NOT NULL UNIQUE,
    owner_id VARCHAR(255) NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 90 SECOND),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_zorp_locks_server (server_id),
    INDEX idx_zorp_locks_owner (owner_id),
    INDEX idx_zorp_locks_expires (expires_at)
);

-- Add owner_id column if it doesn't exist (for existing tables)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'zorp_processing_locks' 
     AND COLUMN_NAME = 'owner_id') = 0,
    'ALTER TABLE zorp_processing_locks ADD COLUMN owner_id VARCHAR(255) NOT NULL DEFAULT "unknown"',
    'SELECT "owner_id column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add locked_at column if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'zorp_processing_locks' 
     AND COLUMN_NAME = 'locked_at') = 0,
    'ALTER TABLE zorp_processing_locks ADD COLUMN locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    'SELECT "locked_at column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add expires_at column if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'zorp_processing_locks' 
     AND COLUMN_NAME = 'expires_at') = 0,
    'ALTER TABLE zorp_processing_locks ADD COLUMN expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 90 SECOND)',
    'SELECT "expires_at column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add created_at column if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'zorp_processing_locks' 
     AND COLUMN_NAME = 'created_at') = 0,
    'ALTER TABLE zorp_processing_locks ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    'SELECT "created_at column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add updated_at column if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'zorp_processing_locks' 
     AND COLUMN_NAME = 'updated_at') = 0,
    'ALTER TABLE zorp_processing_locks ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    'SELECT "updated_at column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_zorp_locks_server ON zorp_processing_locks(server_id);
CREATE INDEX IF NOT EXISTS idx_zorp_locks_owner ON zorp_processing_locks(owner_id);
CREATE INDEX IF NOT EXISTS idx_zorp_locks_expires ON zorp_processing_locks(expires_at);

-- Clean up any existing expired locks
DELETE FROM zorp_processing_locks WHERE expires_at < CURRENT_TIMESTAMP;

-- Show the final table structure
SELECT 'Final table structure:' as status;
DESCRIBE zorp_processing_locks;

-- Show any existing locks
SELECT 'Current locks:' as status;
SELECT * FROM zorp_processing_locks;

SELECT 'ZORP Processing Locks table fixed successfully!' as result;
