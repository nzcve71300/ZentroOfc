require('dotenv').config();

module.exports = {
  discordToken: process.env.DISCORD_TOKEN,
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  },
  rcon: {
    defaultPort: process.env.RCON_DEFAULT_PORT || 28016,
    defaultPassword: process.env.RCON_DEFAULT_PASSWORD || '',
  },
}; 