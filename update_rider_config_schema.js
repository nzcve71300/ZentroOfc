const pool = require('./src/db');

async function updateRiderConfigSchema() {
  try {
    console.log('🔧 Updating Book-a-Ride configuration schema...');

    // Update rider_config table
    console.log('\n📋 Updating rider_config table...');

    // Add new columns to rider_config
    await pool.query(`
      ALTER TABLE rider_config
      ADD COLUMN IF NOT EXISTS mini_enabled TINYINT(1) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS car_enabled TINYINT(1) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fuel_enabled TINYINT(1) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fuel_amount INT NOT NULL DEFAULT 100
    `);
    console.log('✅ rider_config table updated with new columns');

    // Update rider_cooldowns table
    console.log('\n📋 Updating rider_cooldowns table...');

    // Check if vehicle_type column exists
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'rider_cooldowns'
      AND COLUMN_NAME = 'vehicle_type'
    `);

    if (columns.length === 0) {
      // Add vehicle_type column
      await pool.query(`
        ALTER TABLE rider_cooldowns
        ADD COLUMN vehicle_type ENUM('horse', 'rhib', 'mini', 'car') NOT NULL DEFAULT 'horse'
      `);
      console.log('✅ Added vehicle_type column to rider_cooldowns');

      // Update existing records to have vehicle_type = 'horse' (legacy records)
      await pool.query(`
        UPDATE rider_cooldowns
        SET vehicle_type = 'horse'
        WHERE vehicle_type = '' OR vehicle_type IS NULL
      `);
      console.log('✅ Updated existing cooldown records with vehicle_type = horse');

      // Drop old unique key and add new one
      await pool.query(`
        ALTER TABLE rider_cooldowns
        DROP INDEX unique_server_player_rider
      `);
      console.log('✅ Dropped old unique key');

      await pool.query(`
        ALTER TABLE rider_cooldowns
        ADD UNIQUE KEY unique_server_player_vehicle (server_id, player_name, vehicle_type)
      `);
      console.log('✅ Added new unique key for server, player, and vehicle type');
    } else {
      console.log('✅ vehicle_type column already exists');
    }

    // Check current servers
    console.log('\n📊 Current servers:');
    const [servers] = await pool.query(`
      SELECT rs.id, rs.nickname, g.discord_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
    `);

    if (servers.length === 0) {
      console.log('   ❌ No servers found');
    } else {
      servers.forEach(server => {
        console.log(`   ✅ ${server.nickname} (Guild: ${server.discord_id})`);
      });
    }

    console.log('\n🎉 Book-a-Ride schema update completed successfully!');
    console.log('\n📝 New configuration options available:');
    console.log('   /set BAR-MINI on/off <server> - Enable/disable minicopter');
    console.log('   /set BAR-CAR on/off <server> - Enable/disable car');
    console.log('   /set BAR-FUEL on/off <server> - Enable/disable fuel delivery');
    console.log('   /set BAR-FUEL-AMOUNT <amount> <server> - Set fuel amount');

  } catch (error) {
    console.error('❌ Error updating rider config schema:', error);
  } finally {
    await pool.end();
  }
}

updateRiderConfigSchema();
