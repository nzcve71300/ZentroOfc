-- Completely clear all leaderboard settings
-- This will ensure no old channel IDs remain

-- Show all current leaderboard settings
SELECT 
    'Current leaderboard settings before clearing:' as info,
    COUNT(*) as total_settings
FROM leaderboard_settings;

-- Show details of all settings
SELECT 
    'Setting details:' as info,
    id,
    guild_id,
    channel_id,
    created_at,
    updated_at
FROM leaderboard_settings;

-- Delete ALL leaderboard settings
DELETE FROM leaderboard_settings;

-- Verify all settings are cleared
SELECT 
    'Leaderboard settings after clearing:' as info,
    COUNT(*) as remaining_settings
FROM leaderboard_settings;

-- Show guild information for reference
SELECT 
    'Guild information:' as info,
    id,
    discord_id,
    name
FROM guilds 
WHERE discord_id = '1385691441967267953';

-- Instructions for next steps
SELECT 
    'Next steps:' as instruction,
    '1. Restart the bot: pm2 restart zentro-bot' as step1,
    '2. Set up a new channel with /servers-leaderboard' as step2,
    '3. Test with /test-leaderboard' as step3; 