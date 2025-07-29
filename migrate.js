const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'zentro_bot',
  user: 'postgres',
  password: 'zander123',
});

async function migrate() {
  console.log('Starting migration...');
  const deletedLogs = [];
  const tables = ['players', 'economy', 'transactions'];

  // Ensure link_requests table exists
  console.log('\n--- Creating link_requests table if it doesn\'t exist ---');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS link_requests (
      id SERIAL PRIMARY KEY,
      guild_id BIGINT NOT NULL,
      server_id VARCHAR(32) NOT NULL,
      discord_id BIGINT NOT NULL,
      ign TEXT NOT NULL,
      requested_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes'),
      status TEXT DEFAULT 'pending'
    );
  `);
  console.log('link_requests table ensured');

  for (const table of tables) {
    console.log(`\n--- Processing table: ${table} ---`);

    // Step 1: Find invalid rows
    const badRows = await pool.query(`
      SELECT * FROM ${table}
      WHERE (discord_id IS NOT NULL AND discord_id::TEXT !~ '^[0-9]+$')
         OR (guild_id IS NOT NULL AND guild_id::TEXT !~ '^[0-9]+$')
         OR (server_id IS NOT NULL AND server_id::TEXT !~ '^[0-9]+$');
    `);

    if (badRows.rows.length > 0) {
      console.log(`Found ${badRows.rows.length} invalid rows in ${table}. Deleting...`);
      deletedLogs.push({ table, rows: badRows.rows });

      await pool.query(`
        DELETE FROM ${table}
        WHERE (discord_id IS NOT NULL AND discord_id::TEXT !~ '^[0-9]+$')
           OR (guild_id IS NOT NULL AND guild_id::TEXT !~ '^[0-9]+$')
           OR (server_id IS NOT NULL AND server_id::TEXT !~ '^[0-9]+$');
      `);
    } else {
      console.log(`No invalid rows found in ${table}`);
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

    // Step 4: Rebuild unique constraints
    const constraintName = `${table}_guild_discord_server_unique`;
    await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraintName};`);
    await pool.query(`
      ALTER TABLE ${table}
      ADD CONSTRAINT ${constraintName} UNIQUE (guild_id, discord_id, server_id);
    `);

    console.log(`Finished processing ${table}`);
  }

  // Save deleted rows log
  fs.writeFileSync('migration-log.json', JSON.stringify(deletedLogs, null, 2));
  console.log('\nMigration complete! Deleted rows logged to migration-log.json');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
