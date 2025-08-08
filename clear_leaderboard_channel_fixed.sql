-- Clear the problematic leaderboard channel setting (FIXED)
-- This will allow you to set up a new channel

-- Show what we're about to clear
SELECT 
    'About to clear this leaderboard setting:' as info,
    ls.channel_id,
    g.name as guild_name,
    g.discord_id
FROM leaderboard_settings ls
JOIN guilds g ON ls.guild_id = g.id;

-- Option 1: Delete the record (recommended)
DELETE FROM leaderboard_settings 
WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = '1385691441967267953');

-- Option 2: Set to a placeholder value (if you prefer to keep the record)
-- UPDATE leaderboard_settings 
-- SET channel_id = 0, 
--     updated_at = CURRENT_TIMESTAMP 
-- WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = '1385691441967267953');

-- Verify the change
SELECT 
    'Leaderboard setting cleared successfully!' as status,
    COUNT(*) as remaining_settings
FROM leaderboard_settings;

-- Instructions for next steps
SELECT 
    'Next steps:' as instruction,
    '1. Go to your Discord server' as step1,
    '2. Find a channel you want to use for leaderboards' as step2,
    '3. Right-click the channel and copy the ID' as step3,
    '4. Use /servers-leaderboard to set the new channel' as step4,
    '5. Test with /test-leaderboard' as step5; 