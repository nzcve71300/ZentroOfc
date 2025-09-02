const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupPrisonZoneSystem() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔧 Setting up Prison Zone System...');

    // Add zone_size, zone_color, and zone_position columns to prison_configs table (if they don't exist)
    try {
      await connection.execute(`
        ALTER TABLE prison_configs 
        ADD COLUMN zone_size INT DEFAULT 50
      `);
      console.log('✅ Added zone_size column to prison_configs table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ zone_size column already exists');
      } else {
        throw error;
      }
    }

    try {
      await connection.execute(`
        ALTER TABLE prison_configs 
        ADD COLUMN zone_color VARCHAR(20) DEFAULT '255,0,0'
      `);
      console.log('✅ Added zone_color column to prison_configs table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ zone_color column already exists');
      } else {
        throw error;
      }
    }

    try {
      await connection.execute(`
        ALTER TABLE prison_configs 
        ADD COLUMN zone_position VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Added zone_position column to prison_configs table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ zone_position column already exists');
      } else {
        throw error;
      }
    }

    // Create prison_zones table to track active zones
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS prison_zones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        zone_name VARCHAR(255) NOT NULL,
        zone_position VARCHAR(255) NOT NULL,
        zone_size INT NOT NULL,
        zone_color VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_zone (server_id, zone_name)
      )
    `);
    console.log('✅ Created prison_zones table');

    console.log('🎉 Prison Zone System setup complete!');
  } catch (error) {
    console.error('❌ Error setting up Prison Zone System:', error);
  } finally {
    await connection.end();
  }
}

setupPrisonZoneSystem();
