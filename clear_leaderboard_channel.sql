-- Clear the problematic leaderboard channel setting
-- This will allow you to set up a new channel

-- Show what we're about to clear
SELECT 
    'About to clear this leaderboard setting:' as info,
    ls.channel_id,
    g.name as guild_name,
    g.discord_id
FROM leaderboard_settings ls
JOIN guilds g ON ls.guild_id = g.id;

-- Clear the channel setting (set to NULL)
UPDATE leaderboard_settings 
SET channel_id = NULL, 
    updated_at = CURRENT_TIMESTAMP 
WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = '1385691441967267953');

-- Verify the change
SELECT 
    'Leaderboard setting cleared successfully!' as status,
    ls.channel_id,
    g.name as guild_name,
    g.discord_id
FROM leaderboard_settings ls
JOIN guilds g ON ls.guild_id = g.id;

-- Instructions for next steps
SELECT 
    'Next steps:' as instruction,
    '1. Go to your Discord server' as step1,
    '2. Find a channel you want to use for leaderboards' as step2,
    '3. Right-click the channel and copy the ID' as step3,
    '4. Use /servers-leaderboard to set the new channel' as step4,
    '5. Test with /test-leaderboard' as step5; 