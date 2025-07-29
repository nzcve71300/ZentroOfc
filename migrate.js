const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'zentro_bot',
  user: 'postgres',
  password: 'zander123',
});

async function addConstraintIfNotExists(table, constraintName, constraintSQL) {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = '${constraintName}'
      ) THEN
        ALTER TABLE ${table} 
        ADD CONSTRAINT ${constraintName} ${constraintSQL};
      END IF;
    END$$;
  `);
}

async function migrate() {
  console.log('Starting safe migration...');

  /** ------------------------
   * PLAYERS TABLE
   ------------------------ */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      guild_id BIGINT,
      server_id BIGINT,
      discord_id BIGINT,
      ign TEXT,
      linked_at TIMESTAMP DEFAULT NOW(),
      unlinked_at TIMESTAMP NULL,
      is_active BOOLEAN DEFAULT true
    );
  `);

  await addConstraintIfNotExists(
    'players',
    'players_unique_guild_server_discord',
    'UNIQUE (guild_id, server_id, discord_id)'
  );
  await addConstraintIfNotExists(
    'players',
    'players_unique_guild_server_ign',
    'UNIQUE (guild_id, server_id, ign)'
  );

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_players_guild_discord ON players(guild_id, discord_id);
    CREATE INDEX IF NOT EXISTS idx_players_guild_ign ON players(guild_id, ign);
    CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active);
    CREATE INDEX IF NOT EXISTS idx_players_server ON players(server_id);
  `);

  /** ------------------------
   * ECONOMY TABLE
   ------------------------ */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS economy (
      id SERIAL PRIMARY KEY,
      player_id INT,
      guild_id BIGINT,
      server_id BIGINT,
      discord_id BIGINT,
      balance BIGINT DEFAULT 0
    );
  `);
  await addConstraintIfNotExists(
    'economy',
    'economy_unique_guild_server_discord',
    'UNIQUE (guild_id, server_id, discord_id)'
  );
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_economy_player ON economy(player_id);`);

  /** ------------------------
   * TRANSACTIONS TABLE
   ------------------------ */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      player_id INT,
      guild_id BIGINT,
      server_id BIGINT,
      discord_id BIGINT,
      amount BIGINT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await addConstraintIfNotExists(
    'transactions',
    'transactions_unique_guild_server_discord',
    'UNIQUE (guild_id, server_id, discord_id)'
  );

  /** ------------------------
   * LINK REQUESTS TABLE
   ------------------------ */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS link_requests (
      id SERIAL PRIMARY KEY,
      guild_id BIGINT NOT NULL,
      server_id BIGINT NOT NULL,
      discord_id BIGINT NOT NULL,
      ign TEXT NOT NULL,
      requested_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes'),
      status TEXT DEFAULT 'pending'
    );
  `);
  await addConstraintIfNotExists(
    'link_requests',
    'link_requests_unique_guild_server_discord',
    'UNIQUE (guild_id, server_id, discord_id)'
  );
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_link_requests_guild_discord ON link_requests(guild_id, discord_id);
    CREATE INDEX IF NOT EXISTS idx_link_requests_status ON link_requests(status);
    CREATE INDEX IF NOT EXISTS idx_link_requests_expires ON link_requests(expires_at);
  `);

  /** ------------------------
   * LINK BLOCKS TABLE
   ------------------------ */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS link_blocks (
      id SERIAL PRIMARY KEY,
      guild_id BIGINT NOT NULL,
      discord_id BIGINT NULL,
      ign TEXT NULL,
      blocked_at TIMESTAMP DEFAULT NOW(),
      blocked_by BIGINT NOT NULL,
      reason TEXT,
      is_active BOOLEAN DEFAULT true,
      CHECK ((discord_id IS NOT NULL AND ign IS NULL) OR (discord_id IS NULL AND ign IS NOT NULL))
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_discord ON link_blocks(guild_id, discord_id);
    CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_ign ON link_blocks(guild_id, ign);
    CREATE INDEX IF NOT EXISTS idx_link_blocks_active ON link_blocks(is_active);
  `);

  /** ------------------------
   * PLAYER LINKS TABLE
   ------------------------ */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_links (
      id SERIAL PRIMARY KEY,
      guild_id BIGINT NOT NULL,
      server_id BIGINT NOT NULL,
      discord_id BIGINT NOT NULL,
      ign TEXT NOT NULL,
      linked_at TIMESTAMP DEFAULT NOW(),
      unlinked_at TIMESTAMP NULL,
      is_active BOOLEAN DEFAULT true
    );
  `);
  await addConstraintIfNotExists(
    'player_links',
    'player_links_unique_guild_server_discord',
    'UNIQUE (guild_id, server_id, discord_id)'
  );
  await addConstraintIfNotExists(
    'player_links',
    'player_links_unique_guild_server_ign',
    'UNIQUE (guild_id, server_id, ign)'
  );

  /** ------------------------
   * PERMISSIONS
   ------------------------ */
  await pool.query(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zentro_user;
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO zentro_user;
  `);

  console.log('✅ Migration complete!');
  await pool.end();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
