const pool = require('./src/db');

async function migrateAdminUnlink() {
  try {
    console.log('🔧 Starting admin unlink migration...');
    
    // Check if normalized_ign column exists
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'players' 
      AND COLUMN_NAME = 'normalized_ign'
    `);
    
    if (columns.length === 0) {
      console.log('🔧 Adding normalized_ign column...');
      await pool.query(`
        ALTER TABLE players 
        ADD COLUMN normalized_ign VARCHAR(128) 
        CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
      `);
      console.log('✅ Added normalized_ign column');
    } else {
      console.log('✅ normalized_ign column already exists');
    }
    
    // Check if unlink tracking columns exist
    const [unlinkColumns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'players' 
      AND COLUMN_NAME IN ('unlinked_at', 'unlinked_by', 'unlink_reason')
    `);
    
    const existingUnlinkColumns = unlinkColumns.map(col => col.COLUMN_NAME);
    
    if (!existingUnlinkColumns.includes('unlinked_at')) {
      console.log('🔧 Adding unlinked_at column...');
      await pool.query('ALTER TABLE players ADD COLUMN unlinked_at DATETIME NULL');
      console.log('✅ Added unlinked_at column');
    }
    
    if (!existingUnlinkColumns.includes('unlinked_by')) {
      console.log('🔧 Adding unlinked_by column...');
      await pool.query('ALTER TABLE players ADD COLUMN unlinked_by VARCHAR(32) NULL');
      console.log('✅ Added unlinked_by column');
    }
    
    if (!existingUnlinkColumns.includes('unlink_reason')) {
      console.log('🔧 Adding unlink_reason column...');
      await pool.query('ALTER TABLE players ADD COLUMN unlink_reason VARCHAR(255) NULL');
      console.log('✅ Added unlink_reason column');
    }
    
    // Check if unique index exists
    const [indexes] = await pool.query(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'players' 
      AND INDEX_NAME = 'ux_players_guild_normign'
    `);
    
    if (indexes.length === 0) {
      console.log('🔧 Creating unique index for guild_id + normalized_ign...');
      await pool.query(`
        CREATE UNIQUE INDEX ux_players_guild_normign 
        ON players (guild_id, normalized_ign)
      `);
      console.log('✅ Created unique index');
    } else {
      console.log('✅ Unique index already exists');
    }
    
    // Backfill normalized_ign for existing records
    console.log('🔧 Backfilling normalized_ign for existing records...');
    const [players] = await pool.query(`
      SELECT id, ign FROM players WHERE ign IS NOT NULL AND normalized_ign IS NULL
    `);
    
    console.log(`📊 Found ${players.length} players to backfill`);
    
    let updatedCount = 0;
    for (const player of players) {
      if (player.ign) {
        const normalizedIgn = normalizeIGN(player.ign);
        if (normalizedIgn) {
          await pool.query(
            'UPDATE players SET normalized_ign = ? WHERE id = ?',
            [normalizedIgn, player.id]
          );
          updatedCount++;
        }
      }
    }
    
    console.log(`✅ Backfilled ${updatedCount} records`);
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Normalize IGN to prevent case/spaces/unicode issues
 * This ensures consistent comparison and storage
 */
function normalizeIGN(raw) {
  if (!raw || typeof raw !== 'string') return '';
  
  return raw
    .normalize('NFC')        // unify unicode forms
    .replace(/[\u200B-\u200D\uFEFF]/g, '')   // strip zero-width chars
    .trim()
    .replace(/\s+/g, ' ')     // collapse multiple spaces to single space
    .toLowerCase();            // normalize case
}

// Run the migration
migrateAdminUnlink()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
