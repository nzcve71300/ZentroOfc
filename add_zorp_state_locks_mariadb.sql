-- Add Zorp State Locks Table for MariaDB
-- This table prevents race conditions and ensures state transitions are atomic

-- First, check if zorp_zones table exists and get its structure
SHOW TABLES LIKE 'zorp_zones';

-- Create the state locks table
CREATE TABLE IF NOT EXISTS zorp_state_locks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    zone_id INT NOT NULL,
    current_state ENUM('white', 'green', 'yellow', 'red') NOT NULL,
    target_state ENUM('white', 'green', 'yellow', 'red') NOT NULL,
    transition_reason VARCHAR(100) NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_zone_lock (zone_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_current_state (current_state),
    INDEX idx_target_state (target_state)
);

-- Add state transition history table for debugging
CREATE TABLE IF NOT EXISTS zorp_state_transitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    zone_id INT NOT NULL,
    from_state ENUM('white', 'green', 'yellow', 'red') NOT NULL,
    to_state ENUM('white', 'green', 'yellow', 'red') NOT NULL,
    reason VARCHAR(100) NOT NULL,
    player_online BOOLEAN NOT NULL,
    offline_duration_seconds INT,
    online_duration_seconds INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_zone_id (zone_id),
    INDEX idx_created_at (created_at),
    INDEX idx_from_state (from_state),
    INDEX idx_to_state (to_state)
);

-- Show the created tables
SELECT 'Zorp state locking tables created successfully!' AS status;
SHOW TABLES LIKE 'zorp_%';
