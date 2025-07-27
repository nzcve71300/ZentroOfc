// Authorization configuration for Zentro Bot
// This file controls which Discord servers can use your bot

module.exports = {
  // Option 1: Allow all guilds (current setting - most permissive)
  allowAllGuilds: false, // Changed to false - now only authorized servers can add the bot
  
  // Option 2: Only allow specific guild IDs (more secure)
  // Add your authorized guild IDs here
  authorizedGuildIds: [
    // Add your authorized guild IDs here, for example:
    // '1234567890123456789', // Your main server
    // '9876543210987654321', // Another authorized server
  ],
  
  // Option 3: Use environment variable
  // Set allowAllGuilds to false and add AUTHORIZED_GUILD_IDS to your .env file
  // AUTHORIZED_GUILD_IDS=1234567890123456789,9876543210987654321
  
  // Option 4: Use database table (most flexible)
  // Set allowAllGuilds to false and create an authorized_guilds table in your database
  useDatabase: false,
  
  // Custom invite link (optional)
  // Create this in Discord Developer Portal → OAuth2 → URL Generator
  customInviteLink: process.env.CUSTOM_INVITE_LINK || null,
}; 