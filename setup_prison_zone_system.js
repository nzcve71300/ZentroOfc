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

    // Add zone_size, zone_color, and zone_position columns to prison_configs table
    await connection.execute(`
      ALTER TABLE prison_configs 
      ADD COLUMN zone_size INT DEFAULT 50,
      ADD COLUMN zone_color VARCHAR(20) DEFAULT '255,0,0',
      ADD COLUMN zone_position VARCHAR(255) DEFAULT NULL
    `);
    console.log('✅ Added zone_size and zone_color columns to prison_configs table');

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
