-- Fix shop table foreign key constraints to work with unified servers table
-- This script updates the shop tables to reference the new unified servers table

-- First, let's check what we have and drop the old foreign key constraints
ALTER TABLE shop_categories DROP FOREIGN KEY IF EXISTS shop_categories_ibfk_1;
ALTER TABLE shop_items DROP FOREIGN KEY IF EXISTS shop_items_ibfk_1;
ALTER TABLE shop_items DROP FOREIGN KEY IF EXISTS shop_items_ibfk_2;
ALTER TABLE shop_kits DROP FOREIGN KEY IF EXISTS shop_kits_ibfk_1;
ALTER TABLE shop_vehicles DROP FOREIGN KEY IF EXISTS shop_vehicles_ibfk_1;

-- Update shop_categories to reference the unified servers table
ALTER TABLE shop_categories 
ADD CONSTRAINT shop_categories_servers_fk 
FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE;

-- Update shop_items to reference the unified servers table
ALTER TABLE shop_items 
ADD CONSTRAINT shop_items_servers_fk 
FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE;

-- Update shop_kits to reference the unified servers table (if it exists)
-- Note: shop_kits might not have a server_id column, let's add it if needed
ALTER TABLE shop_kits 
ADD COLUMN IF NOT EXISTS server_id INT AFTER id;

-- Update shop_vehicles to reference the unified servers table (if it exists)
-- Note: shop_vehicles might not have a server_id column, let's add it if needed
ALTER TABLE shop_vehicles 
ADD COLUMN IF NOT EXISTS server_id INT AFTER id;

-- Add foreign key constraints for kits and vehicles
ALTER TABLE shop_kits 
ADD CONSTRAINT shop_kits_servers_fk 
FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE;

ALTER TABLE shop_vehicles 
ADD CONSTRAINT shop_vehicles_servers_fk 
FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE;

-- Update existing shop_categories to use the correct server_id
-- Map from rust_servers to the new servers table
UPDATE shop_categories sc
JOIN rust_servers rs ON sc.server_id = rs.id
JOIN servers s ON s.guild_id = rs.guild_id AND s.display_name = rs.nickname
SET sc.server_id = s.id;

-- Update existing shop_items to use the correct server_id
UPDATE shop_items si
JOIN shop_categories sc ON si.category_id = sc.id
JOIN rust_servers rs ON sc.server_id = rs.id
JOIN servers s ON s.guild_id = rs.guild_id AND s.display_name = rs.nickname
SET si.server_id = s.id;

-- Update existing shop_kits to use the correct server_id
UPDATE shop_kits sk
JOIN shop_categories sc ON sk.category_id = sc.id
JOIN rust_servers rs ON sc.server_id = rs.id
JOIN servers s ON s.guild_id = rs.guild_id AND s.display_name = rs.nickname
SET sk.server_id = s.id;

-- Update existing shop_vehicles to use the correct server_id
UPDATE shop_vehicles sv
JOIN shop_categories sc ON sv.category_id = sc.id
JOIN rust_servers rs ON sc.server_id = rs.id
JOIN servers s ON s.guild_id = rs.guild_id AND s.display_name = rs.nickname
SET sv.server_id = s.id;
