-- Create subscriptions table for Zentro Bot
-- This is the minimal table needed for the subscription system to work

CREATE TABLE IF NOT EXISTS subscriptions (
    guild_id BIGINT PRIMARY KEY,
    allowed_servers INT DEFAULT 0,
    active_servers INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add some sample data for testing (optional)
-- INSERT INTO subscriptions (guild_id, allowed_servers, active_servers) VALUES (123456789, 1, 0); 