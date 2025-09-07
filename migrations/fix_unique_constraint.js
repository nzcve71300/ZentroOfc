const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixUniqueConstraint() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔧 Starting unique constraint fix...');

    // Check MySQL version to determine the best approach
    const [versionResult] = await connection.execute('SELECT VERSION() as version');
    const version = versionResult[0].version;
    const majorVersion = parseInt(version.split('.')[0]);
    
    console.log(`📊 MySQL version: ${version}`);

    // Drop the existing problematic constraint
    console.log('🗑️ Dropping existing ux_players_server_normign constraint...');
    try {
      await connection.execute('DROP INDEX ux_players_server_normign ON players');
      console.log('✅ Successfully dropped old constraint');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('ℹ️ Constraint ux_players_server_normign does not exist, skipping drop');
      } else {
        throw error;
      }
    }

    // Clean up any inactive records that might be causing issues
    console.log('🧹 Cleaning up inactive records...');
    const [inactiveRecords] = await connection.execute(
      'SELECT COUNT(*) as count FROM players WHERE is_active = FALSE'
    );
    console.log(`📊 Found ${inactiveRecords[0].count} inactive records`);

    if (inactiveRecords[0].count > 0) {
      // Delete inactive records to prevent constraint conflicts
      const [deleteResult] = await connection.execute(
        'DELETE FROM players WHERE is_active = FALSE'
      );
      console.log(`🗑️ Deleted ${deleteResult.affectedRows} inactive records`);
    }

    // Create new constraint based on MySQL version
    if (majorVersion >= 8) {
      // MySQL 8.0+ supports partial indexes with WHERE clause
      console.log('🔧 Creating partial unique index for MySQL 8.0+...');
      try {
        await connection.execute(`
          CREATE UNIQUE INDEX ux_players_server_normign_active 
          ON players (server_id, normalized_ign) 
          WHERE is_active = TRUE
        `);
        console.log('✅ Successfully created partial unique index');
      } catch (error) {
        console.log('⚠️ Partial index creation failed, falling back to full index');
        await connection.execute(`
          CREATE UNIQUE INDEX ux_players_server_normign_active 
          ON players (server_id, normalized_ign, is_active)
        `);
        console.log('✅ Successfully created full unique index');
      }
    } else {
      // Older MySQL versions - create a full index
      console.log('🔧 Creating full unique index for older MySQL version...');
      await connection.execute(`
        CREATE UNIQUE INDEX ux_players_server_normign_active 
        ON players (server_id, normalized_ign, is_active)
      `);
      console.log('✅ Successfully created full unique index');
    }

    // Verify the constraint was created
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM players 
      WHERE Key_name = 'ux_players_server_normign_active'
    `);
    
    if (indexes.length > 0) {
      console.log('✅ Constraint verification successful');
      console.log('📋 Index details:', indexes);
    } else {
      throw new Error('Failed to create or verify the new constraint');
    }

    console.log('🎉 Unique constraint fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing unique constraint:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the migration
if (require.main === module) {
  fixUniqueConstraint()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = fixUniqueConstraint;
