-- Add Zorp State Locks Table
-- This table prevents race conditions and ensures state transitions are atomic

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
    FOREIGN KEY (zone_id) REFERENCES zorp_zones(id) ON DELETE CASCADE,
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
    
    FOREIGN KEY (zone_id) REFERENCES zorp_zones(id) ON DELETE CASCADE,
    INDEX idx_zone_id (zone_id),
    INDEX idx_created_at (created_at),
    INDEX idx_from_state (from_state),
    INDEX idx_to_state (to_state)
);

-- Add cleanup procedure for expired locks
DELIMITER //
CREATE PROCEDURE cleanup_expired_zorp_locks()
BEGIN
    DECLARE deleted_count INT DEFAULT 0;
    
    -- Remove expired locks
    DELETE FROM zorp_state_locks WHERE expires_at < CURRENT_TIMESTAMP;
    SET deleted_count = ROW_COUNT();
    
    -- Log cleanup
    INSERT INTO zorp_state_transitions (
        zone_id, from_state, to_state, reason, player_online, 
        offline_duration_seconds, online_duration_seconds
    ) VALUES (
        0, 'system', 'system', 'CLEANUP_EXPIRED_LOCKS', FALSE, 0, 0
    );
    
    SELECT CONCAT('Cleaned up ', deleted_count, ' expired locks') AS result;
END//
DELIMITER ;

-- Create event to clean up expired locks every 5 minutes
CREATE EVENT IF NOT EXISTS cleanup_zorp_locks_event
ON SCHEDULE EVERY 5 MINUTE
DO CALL cleanup_expired_zorp_locks();

-- Add function to acquire state transition lock
DELIMITER //
CREATE FUNCTION acquire_zorp_state_lock(
    p_zone_id INT,
    p_current_state VARCHAR(10),
    p_target_state VARCHAR(10),
    p_reason VARCHAR(100),
    p_lock_duration_seconds INT
) RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE lock_acquired BOOLEAN DEFAULT FALSE;
    DECLARE lock_expires_at TIMESTAMP;
    
    -- Calculate lock expiration time
    SET lock_expires_at = DATE_ADD(NOW(), INTERVAL p_lock_duration_seconds SECOND);
    
    -- Try to acquire lock (ignore duplicates)
    INSERT IGNORE INTO zorp_state_locks (
        zone_id, current_state, target_state, transition_reason, expires_at
    ) VALUES (
        p_zone_id, p_current_state, p_target_state, p_reason, lock_expires_at
    );
    
    -- Check if lock was acquired
    IF ROW_COUNT() > 0 THEN
        SET lock_acquired = TRUE;
    END IF;
    
    RETURN lock_acquired;
END//
DELIMITER ;

-- Add function to release state transition lock
DELIMITER //
CREATE FUNCTION release_zorp_state_lock(p_zone_id INT) RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE lock_released BOOLEAN DEFAULT FALSE;
    
    -- Release the lock
    DELETE FROM zorp_state_locks WHERE zone_id = p_zone_id;
    
    -- Check if lock was released
    IF ROW_COUNT() > 0 THEN
        SET lock_released = TRUE;
    END IF;
    
    RETURN lock_released;
END//
DELIMITER ;

-- Add function to check if zone has active lock
DELIMITER //
CREATE FUNCTION has_zorp_state_lock(p_zone_id INT) RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE has_lock BOOLEAN DEFAULT FALSE;
    DECLARE lock_count INT DEFAULT 0;
    
    -- Check for active lock
    SELECT COUNT(*) INTO lock_count 
    FROM zorp_state_locks 
    WHERE zone_id = p_zone_id AND expires_at > NOW();
    
    IF lock_count > 0 THEN
        SET has_lock = TRUE;
    END IF;
    
    RETURN has_lock;
END//
DELIMITER ;

-- Add trigger to log all state transitions
DELIMITER //
CREATE TRIGGER log_zorp_state_transition
AFTER UPDATE ON zorp_zones
FOR EACH ROW
BEGIN
    -- Only log if state actually changed
    IF OLD.current_state != NEW.current_state THEN
        INSERT INTO zorp_state_transitions (
            zone_id, from_state, to_state, reason, player_online,
            offline_duration_seconds, online_duration_seconds
        ) VALUES (
            NEW.id, 
            OLD.current_state, 
            NEW.current_state, 
            'AUTOMATIC_TRANSITION',
            CASE 
                WHEN NEW.current_state = 'green' THEN TRUE 
                ELSE FALSE 
            END,
            CASE 
                WHEN NEW.last_offline_at IS NOT NULL THEN 
                    TIMESTAMPDIFF(SECOND, NEW.last_offline_at, NOW())
                ELSE 0 
            END,
            CASE 
                WHEN NEW.last_online_at IS NOT NULL THEN 
                    TIMESTAMPDIFF(SECOND, NEW.last_online_at, NOW())
                ELSE 0 
            END
        );
    END IF;
END//
DELIMITER ;

-- Show the created tables and functions
SELECT 'Zorp state locking system created successfully!' AS status;
SELECT 'Tables created:' AS info;
SHOW TABLES LIKE 'zorp_%';
SELECT 'Functions created:' AS info;
SHOW FUNCTION STATUS WHERE Name LIKE '%zorp%';
SELECT 'Events created:' AS info;
SHOW EVENTS WHERE Name LIKE '%zorp%';
