-- Fix Shop Duplicates and Add Constraints
-- This script will clean up duplicate items and prevent future duplicates

-- Step 1: Identify and remove duplicate items
-- Keep the item with the lowest ID (oldest) and remove duplicates

-- Remove duplicate shop items
DELETE si1 FROM shop_items si1
INNER JOIN shop_items si2 
WHERE si1.id > si2.id 
AND si1.category_id = si2.category_id 
AND si1.display_name = si2.display_name 
AND si1.short_name = si2.short_name;

-- Remove duplicate shop kits
DELETE sk1 FROM shop_kits sk1
INNER JOIN shop_kits sk2 
WHERE sk1.id > sk2.id 
AND sk1.category_id = sk2.category_id 
AND sk1.display_name = sk2.display_name 
AND sk1.kit_name = sk2.kit_name;

-- Remove duplicate shop vehicles
DELETE sv1 FROM shop_vehicles sv1
INNER JOIN shop_vehicles sv2 
WHERE sv1.id > sv2.id 
AND sv1.category_id = sv2.category_id 
AND sv1.display_name = sv2.display_name 
AND sv1.short_name = sv2.short_name;

-- Step 2: Add unique constraints to prevent future duplicates

-- Add unique constraint to shop_items
ALTER TABLE shop_items 
ADD CONSTRAINT unique_item_per_category 
UNIQUE (category_id, display_name, short_name);

-- Add unique constraint to shop_kits
ALTER TABLE shop_kits 
ADD CONSTRAINT unique_kit_per_category 
UNIQUE (category_id, display_name, kit_name);

-- Add unique constraint to shop_vehicles
ALTER TABLE shop_vehicles 
ADD CONSTRAINT unique_vehicle_per_category 
UNIQUE (category_id, display_name, short_name);

-- Step 3: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_kits_category ON shop_kits(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_vehicles_category ON shop_vehicles(category_id);

-- Step 4: Show results
SELECT 'Shop duplicates cleaned up successfully!' as status;
SELECT 'Unique constraints added to prevent future duplicates' as constraint_status;
SELECT 'Performance indexes created' as index_status;
