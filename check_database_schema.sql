-- Database Schema Diagnostic Script
-- Run this in pgAdmin 4 to see what columns exist

-- Check players table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'players' 
ORDER BY ordinal_position;

-- Check economy table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'economy' 
ORDER BY ordinal_position;

-- Check if tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name IN ('players', 'economy', 'link_requests', 'link_blocks')
ORDER BY table_name;

-- Check sample data from players table
SELECT * FROM players LIMIT 5;

-- Check sample data from economy table  
SELECT * FROM economy LIMIT 5;