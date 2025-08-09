const pool = require('./src/db');

async function updateRiderCooldowns() {
  try {
    console.log('🔧 SSH: Updating rider_cooldowns table for separate vehicle cooldowns...');

    // Check if the table exists and what columns it has
    console.log('\n📋 Checking current table structure...');
    try {
      const [columns] = await pool.query('DESCRIBE rider_cooldowns');
      console.log('Current columns:');
      columns.forEach(col => {
        console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });

      // Check if vehicle_type column exists
      const hasVehicleType = columns.some(col => col.Field === 'vehicle_type');
      
      if (!hasVehicleType) {
        console.log('\n🔧 Adding vehicle_type column...');
        
        // Drop the old unique constraint first
        try {
          await pool.query('ALTER TABLE rider_cooldowns DROP INDEX unique_server_player_rider');
          console.log('✅ Dropped old unique constraint');
        } catch (dropError) {
          console.log('⚠️ Old constraint may not exist:', dropError.message);
        }
        
        // Add the vehicle_type column
        await pool.query(`
          ALTER TABLE rider_cooldowns 
          ADD COLUMN vehicle_type ENUM('horse', 'rhib') NOT NULL DEFAULT 'horse'
        `);
        console.log('✅ Added vehicle_type column');
        
        // Add new unique constraint
        await pool.query(`
          ALTER TABLE rider_cooldowns 
          ADD UNIQUE KEY unique_server_player_vehicle (server_id, player_name, vehicle_type)
        `);
        console.log('✅ Added new unique constraint');
        
      } else {
        console.log('✅ vehicle_type column already exists');
      }

    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.log('⚠️ rider_cooldowns table does not exist, creating it...');
        
        // Create the table with the new schema
        await pool.query(`
          CREATE TABLE rider_cooldowns (
            id INT AUTO_INCREMENT PRIMARY KEY,
            server_id VARCHAR(255) NOT NULL,
            player_name VARCHAR(255) NOT NULL,
            vehicle_type ENUM('horse', 'rhib') NOT NULL,
            last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_server_player_vehicle (server_id, player_name, vehicle_type),
            FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
          )
        `);
        console.log('✅ Created rider_cooldowns table with separate vehicle cooldowns');
      } else {
        throw tableError;
      }
    }

    // Verify the final structure
    console.log('\n✅ Final table structure:');
    const [finalColumns] = await pool.query('DESCRIBE rider_cooldowns');
    finalColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Show current data
    console.log('\n📊 Current cooldown data:');
    const [cooldowns] = await pool.query('SELECT * FROM rider_cooldowns');
    if (cooldowns.length === 0) {
      console.log('   No cooldown records found');
    } else {
      cooldowns.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.player_name} - ${record.vehicle_type} (Server: ${record.server_id})`);
      });
    }

    console.log('\n🎉 Rider cooldowns update completed!');
    console.log('\n💡 Now horses and rhibs have separate cooldowns:');
    console.log('   - Players can use a horse, then immediately use a rhib');
    console.log('   - Each vehicle type has its own cooldown timer');
    console.log('   - Cooldown messages show remaining time for unavailable vehicles');

  } catch (error) {
    console.error('❌ Update error:', error);
  } finally {
    await pool.end();
  }
}

// Run the update
updateRiderCooldowns().catch(console.error);