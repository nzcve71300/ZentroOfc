-- Check Shop Duplicates (Safe - Read Only)
-- This script will show you what duplicates exist before cleaning them up

-- Check for duplicate shop items
SELECT 
    'shop_items' as table_name,
    si1.category_id,
    si1.display_name,
    si1.short_name,
    COUNT(*) as duplicate_count,
    GROUP_CONCAT(si1.id ORDER BY si1.id) as duplicate_ids
FROM shop_items si1
GROUP BY si1.category_id, si1.display_name, si1.short_name
HAVING COUNT(*) > 1
ORDER BY si1.category_id, si1.display_name;

-- Check for duplicate shop kits
SELECT 
    'shop_kits' as table_name,
    sk1.category_id,
    sk1.display_name,
    sk1.kit_name,
    COUNT(*) as duplicate_count,
    GROUP_CONCAT(sk1.id ORDER BY sk1.id) as duplicate_ids
FROM shop_kits sk1
GROUP BY sk1.category_id, sk1.display_name, sk1.kit_name
HAVING COUNT(*) > 1
ORDER BY sk1.category_id, sk1.display_name;

-- Check for duplicate shop vehicles
SELECT 
    'shop_vehicles' as table_name,
    sv1.category_id,
    sv1.display_name,
    sv1.short_name,
    COUNT(*) as duplicate_count,
    GROUP_CONCAT(sv1.id ORDER BY sv1.id) as duplicate_ids
FROM shop_vehicles sv1
GROUP BY sv1.category_id, sv1.display_name, sv1.short_name
HAVING COUNT(*) > 1
ORDER BY sv1.category_id, sv1.display_name;

-- Summary of all duplicates found
SELECT 
    'SUMMARY' as info,
    'Run the fix_shop_duplicates.sql script to clean up these duplicates' as action_required;
