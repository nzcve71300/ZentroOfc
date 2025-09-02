const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugEconomy() {
  console.log('🔍 Debugging Economy System');
  console.log('============================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Step 1: Check if nzcve7130 exists and their current status
    console.log('📋 Step 1: Checking nzcve7130 player status...');
    const [playerResult] = await connection.execute(`
      SELECT p.*, e.balance, rs.nickname as server_name
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign = 'nzcve7130' AND p.is_active = true
      ORDER BY rs.nickname
    `);

    if (playerResult.length === 0) {
      console.log('❌ No active players found with IGN: nzcve7130');
      return;
    }

    console.log(`✅ Found ${playerResult.length} active players with IGN: nzcve7130:`);
    playerResult.forEach(player => {
      console.log(`   Server: ${player.server_name} | Player ID: ${player.id} | Balance: ${player.balance || 0} | Discord ID: ${player.discord_id}`);
    });

    // Step 2: Check economy table structure
    console.log('\n📋 Step 2: Checking economy table structure...');
    const [economyStructure] = await connection.execute(`DESCRIBE economy`);
    console.log('Economy table columns:');
    economyStructure.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
    });

    // Step 3: Check if economy records exist for these players
    console.log('\n📋 Step 3: Checking economy records...');
    for (const player of playerResult) {
      const [economyRecord] = await connection.execute(`
        SELECT * FROM economy WHERE player_id = ?
      `, [player.id]);

      if (economyRecord.length === 0) {
        console.log(`❌ No economy record found for player ${player.ign} on ${player.server_name} (ID: ${player.id})`);
      } else {
        console.log(`✅ Economy record found for ${player.ign} on ${player.server_name}:`);
        console.log(`   Player ID: ${economyRecord[0].player_id}`);
        console.log(`   Balance: ${economyRecord[0].balance}`);
        console.log(`   Record ID: ${economyRecord[0].id}`);
      }
    }

    // Step 4: Check transactions table for recent activity
    console.log('\n📋 Step 4: Checking recent transactions...');
    const [transactions] = await connection.execute(`
      SELECT t.*, p.ign, rs.nickname as server_name
      FROM transactions t
      JOIN players p ON t.player_id = p.id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign = 'nzcve7130'
      ORDER BY t.timestamp DESC
      LIMIT 10
    `);

    if (transactions.length === 0) {
      console.log('ℹ️ No transactions found for nzcve7130');
    } else {
      console.log(`📊 Found ${transactions.length} recent transactions for nzcve7130:`);
      transactions.forEach(tx => {
        console.log(`   ${tx.timestamp}: ${tx.amount > 0 ? '+' : ''}${tx.amount} ${tx.type} on ${tx.server_name}`);
      });
    }

    // Step 5: Test balance update manually
    console.log('\n📋 Step 5: Testing manual balance update...');
    const testPlayer = playerResult.find(p => p.server_name === 'USA-DeadOps');
    if (testPlayer) {
      console.log(`🧪 Testing balance update for ${testPlayer.ign} on ${testPlayer.server_name}...`);
      
      // Get current balance
      const [currentBalance] = await connection.execute(`
        SELECT balance FROM economy WHERE player_id = ?
      `, [testPlayer.id]);
      
      const beforeBalance = currentBalance[0]?.balance || 0;
      console.log(`   Before update: ${beforeBalance}`);

      // Test update
      await connection.execute(`
        UPDATE economy SET balance = balance + 1000 WHERE player_id = ?
      `, [testPlayer.id]);

      // Get new balance
      const [newBalance] = await connection.execute(`
        SELECT balance FROM economy WHERE player_id = ?
      `, [testPlayer.id]);
      
      const afterBalance = newBalance[0]?.balance || 0;
      console.log(`   After +1000: ${afterBalance}`);
      console.log(`   Difference: ${afterBalance - beforeBalance}`);

      // Revert the test
      await connection.execute(`
        UPDATE economy SET balance = balance - 1000 WHERE player_id = ?
      `, [testPlayer.id]);
      console.log(`   Reverted back to: ${beforeBalance}`);
    }

    // Step 6: Check for any database constraints or triggers
    console.log('\n📋 Step 6: Checking for constraints or triggers...');
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'economy'
    `, [process.env.DB_NAME]);

    if (constraints.length === 0) {
      console.log('ℹ️ No constraints found on economy table');
    } else {
      console.log('🔒 Constraints on economy table:');
      constraints.forEach(constraint => {
        console.log(`   ${constraint.CONSTRAINT_NAME}: ${constraint.CONSTRAINT_TYPE} on ${constraint.COLUMN_NAME}`);
      });
    }

  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

debugEconomy();
