-- Fix leaderboard channel issue
-- This clears the problematic channel settings so you can set up a new one

-- Show current settings
SELECT 
    'Current leaderboard settings' as info,
    ls.channel_id,
    g.name as guild_name,
    g.discord_id
FROM leaderboard_settings ls
JOIN guilds g ON ls.guild_id = g.id;

-- Clear the problematic channel (optional - uncomment if you want to reset)
-- UPDATE leaderboard_settings SET channel_id = NULL WHERE channel_id = '1403370334178247000';

-- Show what channels the bot has access to (this will help you choose a valid channel)
SELECT 'Available channels for this guild' as info;

-- Instructions for fixing
SELECT 
    'To fix the leaderboard channel issue:' as instruction,
    '1. Go to your Discord server' as step1,
    '2. Find a channel you want to use for leaderboards' as step2,
    '3. Right-click the channel and copy the ID' as step3,
    '4. Use /servers-leaderboard to set the new channel' as step4; 