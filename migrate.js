const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'zentro_bot',
  user: 'postgres',
  password: 'YOUR_POSTGRES_PASSWORD', // <- replace
});

async function migrate() {
  console.log('Starting migration...');

  // Tables to fix
  const tables = ['players', 'economy', 'transactions'];

  for (const table of tables) {
    console.log(`\n--- Processing table: ${table} ---`);

    // Step 1: Clean bad rows
    const badRows = await pool.query(`
      SELECT * FROM ${table}
      WHERE (discord_id IS NOT NULL AND discord_id !~ '^[0-9]+$')
         OR (guild_id IS NOT NULL AND guild_id::TEXT !~ '^[0-9]+$')
         OR (server_id IS NOT NULL AND server_id::TEXT !~ '^[0-9]+$');
    `);
    if (badRows.rows.length > 0) {
      console.log(`Found ${badRows.rows.length} invalid rows in ${table}:`, badRows.rows);
      await pool.query(`
        DELETE FROM ${table}
        WHERE (discord_id IS NOT NULL AND discord_id !~ '^[0-9]+$')
           OR (guild_id IS NOT NULL AND guild_id::TEXT !~ '^[0-9]+$')
           OR (server_id IS NOT NULL AND server_id::TEXT !~ '^[0-9]+$');
      `);
      console.log(`Deleted invalid rows from ${table}`);
    }

    // Step 2: Add missing columns
    if (table === 'players') {
      await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP DEFAULT NOW();`);
      await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMP NULL;`);
      await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);
    }
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS guild_id BIGINT;`);
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS server_id BIGINT;`);
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS discord_id BIGINT;`);

    // Step 3: Convert columns to BIGINT
    await pool.query(`
      ALTER TABLE ${table}
      ALTER COLUMN guild_id TYPE BIGINT USING NULLIF(guild_id::TEXT, '')::BIGINT,
      ALTER COLUMN server_id TYPE BIGINT USING NULLIF(server_id::TEXT, '')::BIGINT,
      ALTER COLUMN discord_id TYPE BIGINT USING NULLIF(discord_id::TEXT, '')::BIGINT;
    `);

    // Step 4: Rebuild constraints
    const constraintName = `${table}_guild_discord_server_unique`;
    await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraintName};`);
    await pool.query(`
      ALTER TABLE ${table}
      ADD CONSTRAINT ${constraintName} UNIQUE (guild_id, discord_id, server_id);
    `);

    console.log(`Finished processing ${table}`);
  }

  console.log('\nMigration complete!');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
