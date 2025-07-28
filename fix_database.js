require('dotenv').config();
const { Pool } = require('pg');

// Use the same database configuration as your bot
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function fixDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migration...');
    
    // Convert all ID columns to VARCHAR(32)
    console.log('Converting ID columns to VARCHAR(32)...');
    
    await client.query('ALTER TABLE players ALTER COLUMN id TYPE VARCHAR(32) USING id::text');
    console.log('✓ players.id converted');
    
    await client.query('ALTER TABLE guilds ALTER COLUMN id TYPE VARCHAR(32) USING id::text');
    console.log('✓ guilds.id converted');
    
    await client.query('ALTER TABLE rust_servers ALTER COLUMN id TYPE VARCHAR(32) USING id::text');
    console.log('✓ rust_servers.id converted');
    
    await client.query('ALTER TABLE economy ALTER COLUMN id TYPE VARCHAR(32) USING id::text');
    console.log('✓ economy.id converted');
    
    await client.query('ALTER TABLE player_stats ALTER COLUMN id TYPE VARCHAR(32) USING id::text');
    console.log('✓ player_stats.id converted');
    
    await client.query('ALTER TABLE transactions ALTER COLUMN id TYPE VARCHAR(32) USING id::text');
    console.log('✓ transactions.id converted');
    
    // Convert foreign key columns
    console.log('Converting foreign key columns...');
    
    await client.query('ALTER TABLE player_stats ALTER COLUMN player_id TYPE VARCHAR(32) USING player_id::text');
    console.log('✓ player_stats.player_id converted');
    
    await client.query('ALTER TABLE transactions ALTER COLUMN player_id TYPE VARCHAR(32) USING player_id::text');
    console.log('✓ transactions.player_id converted');
    
    await client.query('ALTER TABLE economy ALTER COLUMN player_id TYPE VARCHAR(32) USING player_id::text');
    console.log('✓ economy.player_id converted');
    
    await client.query('ALTER TABLE autokits ALTER COLUMN server_id TYPE VARCHAR(32) USING server_id::text');
    console.log('✓ autokits.server_id converted');
    
    await client.query('ALTER TABLE kit_auth ALTER COLUMN server_id TYPE VARCHAR(32) USING server_id::text');
    console.log('✓ kit_auth.server_id converted');
    
    await client.query('ALTER TABLE killfeed_configs ALTER COLUMN server_id TYPE VARCHAR(32) USING server_id::text');
    console.log('✓ killfeed_configs.server_id converted');
    
    await client.query('ALTER TABLE shop_categories ALTER COLUMN server_id TYPE VARCHAR(32) USING server_id::text');
    console.log('✓ shop_categories.server_id converted');
    
    await client.query('ALTER TABLE rust_servers ALTER COLUMN guild_id TYPE VARCHAR(32) USING guild_id::text');
    console.log('✓ rust_servers.guild_id converted');
    
    // Drop existing constraints
    console.log('Dropping existing constraints...');
    
    const dropConstraints = [
      'ALTER TABLE player_stats DROP CONSTRAINT IF EXISTS player_stats_player_id_fkey',
      'ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_player_id_fkey',
      'ALTER TABLE economy DROP CONSTRAINT IF EXISTS economy_player_id_fkey',
      'ALTER TABLE autokits DROP CONSTRAINT IF EXISTS autokits_server_id_fkey',
      'ALTER TABLE kit_auth DROP CONSTRAINT IF EXISTS kit_auth_server_id_fkey',
      'ALTER TABLE killfeed_configs DROP CONSTRAINT IF EXISTS killfeed_configs_server_id_fkey',
      'ALTER TABLE shop_categories DROP CONSTRAINT IF EXISTS shop_categories_server_id_fkey',
      'ALTER TABLE rust_servers DROP CONSTRAINT IF EXISTS rust_servers_guild_id_fkey',
      'ALTER TABLE players DROP CONSTRAINT IF EXISTS players_guild_id_fkey',
      'ALTER TABLE players DROP CONSTRAINT IF EXISTS players_server_id_fkey'
    ];
    
    for (const query of dropConstraints) {
      try {
        await client.query(query);
      } catch (error) {
        console.log(`Note: ${error.message}`);
      }
    }
    
    // Recreate constraints
    console.log('Recreating constraints...');
    
    await client.query('ALTER TABLE player_stats ADD CONSTRAINT player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id)');
    console.log('✓ player_stats constraint recreated');
    
    await client.query('ALTER TABLE transactions ADD CONSTRAINT transactions_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id)');
    console.log('✓ transactions constraint recreated');
    
    await client.query('ALTER TABLE economy ADD CONSTRAINT economy_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id)');
    console.log('✓ economy constraint recreated');
    
    await client.query('ALTER TABLE autokits ADD CONSTRAINT autokits_server_id_fkey FOREIGN KEY (server_id) REFERENCES rust_servers(id)');
    console.log('✓ autokits constraint recreated');
    
    await client.query('ALTER TABLE kit_auth ADD CONSTRAINT kit_auth_server_id_fkey FOREIGN KEY (server_id) REFERENCES rust_servers(id)');
    console.log('✓ kit_auth constraint recreated');
    
    await client.query('ALTER TABLE killfeed_configs ADD CONSTRAINT killfeed_configs_server_id_fkey FOREIGN KEY (server_id) REFERENCES rust_servers(id)');
    console.log('✓ killfeed_configs constraint recreated');
    
    await client.query('ALTER TABLE shop_categories ADD CONSTRAINT shop_categories_server_id_fkey FOREIGN KEY (server_id) REFERENCES rust_servers(id)');
    console.log('✓ shop_categories constraint recreated');
    
    await client.query('ALTER TABLE rust_servers ADD CONSTRAINT rust_servers_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES guilds(id)');
    console.log('✓ rust_servers constraint recreated');
    
    await client.query('ALTER TABLE players ADD CONSTRAINT players_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES guilds(id)');
    console.log('✓ players guild constraint recreated');
    
    await client.query('ALTER TABLE players ADD CONSTRAINT players_server_id_fkey FOREIGN KEY (server_id) REFERENCES rust_servers(id)');
    console.log('✓ players server constraint recreated');
    
    console.log('\n🎉 Database migration completed successfully!');
    console.log('✅ All ID columns are now VARCHAR(32)');
    console.log('✅ All foreign key constraints have been recreated');
    console.log('✅ Your bot should now work without the "out of range for type integer" errors');
    
  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    console.error('Full error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
fixDatabase().catch(console.error); 