-- Fix shop_cooldowns table to support vehicles
-- Update the item_type ENUM to include 'vehicle'

ALTER TABLE shop_cooldowns MODIFY COLUMN item_type ENUM('item', 'kit', 'vehicle') NOT NULL;

-- Success message
SELECT 'shop_cooldowns table updated to support vehicles!' as status;
