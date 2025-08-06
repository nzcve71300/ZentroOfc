-- Add currency_name column to rust_servers table
ALTER TABLE rust_servers ADD COLUMN currency_name VARCHAR(50) DEFAULT 'coins' AFTER nickname;

-- Update existing servers to have the default currency name
UPDATE rust_servers SET currency_name = 'coins' WHERE currency_name IS NULL; 