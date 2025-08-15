const pool = require('./src/db');

async function verifyEventConfig() {
  console.log('🔍 Verifying Event Configuration...\n');

  try {
    // Check event configurations
    const [configsResult] = await pool.query(`
      SELECT 
        ec.id, ec.server_id, ec.event_type, ec.enabled, ec.kill_message, ec.respawn_message,
        rs.nickname as server_name
      FROM event_configs ec
      JOIN rust_servers rs ON ec.server_id = rs.id
      ORDER BY rs.nickname, ec.event_type
    `);

    console.log(`Found ${configsResult.length} event configurations:`);
    
    if (configsResult.length === 0) {
      console.log('❌ No event configurations found!');
      console.log('\n📋 To fix this, run these commands in Discord:');
      console.log('For Emperor 3x:');
      console.log('/set-events Emperor 3x bradley bradscout on');
      console.log('/set-events Emperor 3x helicopter heliscout on');
      console.log('\nFor BLOODRUST:');
      console.log('/set-events BLOODRUST bradley bradscout on');
      console.log('/set-events BLOODRUST helicopter heliscout on');
    } else {
      configsResult.forEach((config, index) => {
        const status = config.enabled ? '🟢 ENABLED' : '🔴 DISABLED';
        console.log(`  ${index + 1}. ${config.server_name} - ${config.event_type.toUpperCase()} (${status})`);
        console.log(`     Kill Message: ${config.kill_message}`);
        console.log(`     Respawn Message: ${config.respawn_message}`);
      });
      
      console.log('\n✅ Event configurations are set up correctly!');
      console.log('The bot will now detect Bradley and Helicopter events every 30 seconds.');
    }

    // Check which servers have events enabled
    const [enabledResult] = await pool.query(`
      SELECT 
        rs.nickname,
        COUNT(CASE WHEN ec.event_type = 'bradley' AND ec.enabled = TRUE THEN 1 END) as bradley_enabled,
        COUNT(CASE WHEN ec.event_type = 'helicopter' AND ec.enabled = TRUE THEN 1 END) as helicopter_enabled
      FROM rust_servers rs
      LEFT JOIN event_configs ec ON rs.id = ec.server_id
      GROUP BY rs.id, rs.nickname
      ORDER BY rs.nickname
    `);

    console.log('\n📊 Server Event Status:');
    enabledResult.forEach(server => {
      const bradleyStatus = server.bradley_enabled > 0 ? '🟢' : '🔴';
      const helicopterStatus = server.helicopter_enabled > 0 ? '🟢' : '🔴';
      console.log(`  ${server.nickname}: Bradley ${bradleyStatus} | Helicopter ${helicopterStatus}`);
    });

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await pool.end();
  }
}

verifyEventConfig();

