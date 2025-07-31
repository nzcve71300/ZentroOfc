const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugKitSpamIssue() {
  console.log('🔍 Debug Kit Spam Issue');
  console.log('========================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    const serverId = '1753952654507_7deot3q0';
    const playerName = 'nzcve7130';

    console.log('\n📋 Step 1: Check current cooldown entries...');
    const [cooldownResult] = await connection.execute(
      'SELECT * FROM kit_cooldowns WHERE server_id = ? AND player_name = ? ORDER BY claimed_at DESC',
      [serverId, playerName]
    );
    
    console.log(`Found ${cooldownResult.length} cooldown entries for ${playerName}:`);
    for (const cooldown of cooldownResult) {
      console.log(`- Kit: ${cooldown.kit_name}, Claimed: ${cooldown.claimed_at}`);
    }

    console.log('\n📋 Step 2: Check autokit configuration...');
    const [autokitResult] = await connection.execute(
      'SELECT * FROM autokits WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`Found ${autokitResult.length} autokit configurations:`);
    for (const autokit of autokitResult) {
      console.log(`- Kit: ${autokit.kit_name}, Enabled: ${autokit.enabled}, Cooldown: ${autokit.cooldown} minutes`);
    }

    console.log('\n📋 Step 3: Simulate cooldown check logic...');
    for (const autokit of autokitResult) {
      if (autokit.cooldown > 0) {
        const [recentCooldown] = await connection.execute(
          'SELECT claimed_at FROM kit_cooldowns WHERE server_id = ? AND kit_name = ? AND player_name = ? ORDER BY claimed_at DESC LIMIT 1',
          [serverId, autokit.kit_name, playerName]
        );
        
        if (recentCooldown.length > 0) {
          const lastClaimTime = new Date(recentCooldown[0].claimed_at).getTime() / 1000;
          const now = Math.floor(Date.now() / 1000);
          const cooldownSeconds = autokit.cooldown * 60;
          const timeDiff = now - lastClaimTime;
          const remaining = Math.ceil((cooldownSeconds - timeDiff) / 60);
          
          console.log(`${autokit.kit_name}: Last claim ${timeDiff} seconds ago, Cooldown ${autokit.cooldown} minutes, Remaining ${remaining} minutes`);
        } else {
          console.log(`${autokit.kit_name}: No recent claims found`);
        }
      }
    }

    await connection.end();

    console.log('\n🎯 ANALYSIS:');
    console.log('This will help us understand the cooldown logic and why kits might be spamming.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

debugKitSpamIssue(); 