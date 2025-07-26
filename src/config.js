require('dotenv').config();

module.exports = {
  discordToken: process.env.DISCORD_TOKEN,
  db: {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT || 5432,
  },
  rcon: {
    defaultPort: process.env.RCON_DEFAULT_PORT || 28016,
    defaultPassword: process.env.RCON_DEFAULT_PASSWORD || '',
  },
};
