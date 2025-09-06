#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkZorpStates() {
  let connection;
  
  try {
    // Use the same database configuration as the bot
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'zentro_bot',
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Checking Zorp zone states...\n');

    // Get all active Zorp zones
    const [zones] = await connection.execute(`
      SELECT 
        name, 
        owner, 
        current_state, 
        created_at, 
        expire, 
        delay,
        server_id,
        rs.nickname as server_name
      FROM zorp_zones z
      LEFT JOIN rust_servers rs ON z.server_id = rs.id
      WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
      ORDER BY owner, created_at DESC
    `);

    if (zones.length === 0) {
      console.log('❌ No active Zorp zones found');
      return;
    }

    console.log(`📊 Found ${zones.length} active Zorp zones:\n`);

    // Group by owner
    const zonesByOwner = {};
    zones.forEach(zone => {
      if (!zonesByOwner[zone.owner]) {
        zonesByOwner[zone.owner] = [];
      }
      zonesByOwner[zone.owner].push(zone);
    });

    // Display zones by owner
    for (const [owner, ownerZones] of Object.entries(zonesByOwner)) {
      console.log(`👤 **${owner}** (${ownerZones.length} zone${ownerZones.length > 1 ? 's' : ''}):`);
      
      ownerZones.forEach(zone => {
        const createdDate = new Date(zone.created_at);
        const expireDate = new Date(createdDate.getTime() + (zone.expire * 1000));
        const timeLeft = Math.max(0, Math.floor((expireDate - new Date()) / 1000 / 60));
        
        console.log(`  🏠 ${zone.name}`);
        console.log(`     State: ${zone.current_state}`);
        console.log(`     Server: ${zone.server_name || 'Unknown'}`);
        console.log(`     Delay: ${zone.delay} minutes`);
        console.log(`     Created: ${createdDate.toLocaleString()}`);
        console.log(`     Expires: ${expireDate.toLocaleString()} (${timeLeft} min left)`);
        console.log('');
      });
    }

    // Check for potential issues
    console.log('🔍 **Potential Issues:**\n');
    
    const greenZones = zones.filter(z => z.current_state === 'green');
    const yellowZones = zones.filter(z => z.current_state === 'yellow');
    const redZones = zones.filter(z => z.current_state === 'red');
    const whiteZones = zones.filter(z => z.current_state === 'white');
    const orphanedZones = zones.filter(z => z.current_state === 'orphaned');

    console.log(`🟢 Green zones: ${greenZones.length}`);
    console.log(`🟡 Yellow zones: ${yellowZones.length}`);
    console.log(`🔴 Red zones: ${redZones.length}`);
    console.log(`⚪ White zones: ${whiteZones.length}`);
    console.log(`❌ Orphaned zones: ${orphanedZones.length}`);

    // Check for zones that might be stuck
    const now = new Date();
    const stuckZones = zones.filter(zone => {
      const createdDate = new Date(zone.created_at);
      const shouldBeGreen = new Date(createdDate.getTime() + (zone.delay * 60 * 1000));
      return zone.current_state === 'white' && now > shouldBeGreen;
    });

    if (stuckZones.length > 0) {
      console.log(`\n⚠️  **STUCK ZONES** (should be green but are still white):`);
      stuckZones.forEach(zone => {
        console.log(`  - ${zone.owner}: ${zone.name}`);
      });
    }

    // Check for zones that should have expired
    const expiredZones = zones.filter(zone => {
      const createdDate = new Date(zone.created_at);
      const expireDate = new Date(createdDate.getTime() + (zone.expire * 1000));
      return now > expireDate;
    });

    if (expiredZones.length > 0) {
      console.log(`\n⏰ **EXPIRED ZONES** (should be deleted):`);
      expiredZones.forEach(zone => {
        console.log(`  - ${zone.owner}: ${zone.name}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking Zorp states:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 **Database Access Issue:**');
      console.log('The database user does not have permission to access the database.');
      console.log('Please check your database credentials in the .env file.');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
checkZorpStates();
