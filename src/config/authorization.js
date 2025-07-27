// Authorization configuration for Zentro Bot
// This file controls which Discord servers can use your bot

module.exports = {
  // Set to false to enable strict authorization
  allowAllGuilds: false,
  
  // Add your authorized guild IDs here (comma-separated)
  // You can also set this in your .env file as AUTHORIZED_GUILD_IDS=123456789,987654321
  authorizedGuildIds: process.env.AUTHORIZED_GUILD_IDS ? 
    process.env.AUTHORIZED_GUILD_IDS.split(',').map(id => id.trim()) : 
    [],
}; 