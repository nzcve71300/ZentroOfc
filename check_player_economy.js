const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPlayerEconomy() {
  console.log('🔍 Player Economy Diagnostic Script');
  console.log('==================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Check the specific player mentioned in the error
    const playerName = 'Y03Xx';
    
    console.log(`📋 Checking economy for player: ${playerName}`);
    console.log('==========================================\n');

    // Step 1: Find the player records
    const [players] = await connection.execute(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign = ? AND p.is_active = true
      ORDER BY rs.nickname
    `, [playerName]);

    if (players.length === 0) {
      console.log(`❌ No active players found with IGN: ${playerName}`);
      return;
    }

    console.log(`✅ Found ${players.length} player record(s):`);
    players.forEach(player => {
      console.log(`   📍 ${player.ign} on ${player.server_name} (ID: ${player.id})`);
    });

    // Step 2: Check economy records for each player
    console.log('\n📋 Checking economy records...');
    console.log('==============================');

    // First, let's check what columns exist in the economy table
    console.log('🔍 Checking economy table structure...');
    const [columns] = await connection.execute(`
      DESCRIBE economy
    `);
    
    console.log('   📊 Economy table columns:');
    columns.forEach(col => {
      console.log(`      - ${col.Field} (${col.Type})`);
    });

    for (const player of players) {
      console.log(`\n🔍 Checking economy for ${player.ign} on ${player.server_name}:`);
      
      const [economyRecords] = await connection.execute(`
        SELECT e.id, e.player_id, e.balance, e.guild_id
        FROM economy e
        WHERE e.player_id = ?
        ORDER BY e.id DESC
      `, [player.id]);

      if (economyRecords.length === 0) {
        console.log(`   ❌ No economy record found for player ID: ${player.id}`);
        
        // Check if we need to create one
        console.log(`   🔧 Attempting to create economy record...`);
        try {
          const [result] = await connection.execute(`
            INSERT INTO economy (player_id, balance, guild_id) VALUES (?, 0, ?)
          `, [player.id, player.guild_id]);
          
          console.log(`   ✅ Created economy record with ID: ${result.insertId}`);
        } catch (error) {
          console.log(`   ❌ Failed to create economy record: ${error.message}`);
        }
      } else {
        console.log(`   ✅ Found ${economyRecords.length} economy record(s):`);
        economyRecords.forEach(record => {
          console.log(`      💰 Balance: ${record.balance} | Player ID: ${record.player_id} | Guild ID: ${record.guild_id}`);
        });
      }
    }

    // Step 3: Check for any recent economy transactions
    console.log('\n📋 Checking recent economy transactions...');
    console.log('==========================================');

    for (const player of players) {
      console.log(`\n🔍 Recent transactions for ${player.ign} on ${player.server_name}:`);
      
      // Check if there's a transactions table or similar
      const [tables] = await connection.execute(`
        SHOW TABLES LIKE '%transaction%'
      `);
      
      if (tables.length > 0) {
        console.log(`   📊 Found transactions table, checking recent activity...`);
        // You can add transaction checking logic here if needed
      } else {
        console.log(`   ℹ️ No transactions table found`);
      }
    }

    // Step 4: Test balance update
    console.log('\n📋 Testing balance update...');
    console.log('============================');

    for (const player of players) {
      if (player.server_name === 'Dead-ops') {
        console.log(`\n🧪 Testing balance update for ${player.ign} on ${player.server_name}:`);
        
        // Get current balance
        const [currentBalance] = await connection.execute(`
          SELECT e.balance FROM economy e WHERE e.player_id = ?
        `, [player.id]);
        
        if (currentBalance.length > 0) {
          const oldBalance = currentBalance[0].balance;
          console.log(`   💰 Current balance: ${oldBalance}`);
          
          // Test updating balance
          try {
            const [updateResult] = await connection.execute(`
              UPDATE economy SET balance = ? WHERE player_id = ?
            `, [oldBalance + 1000, player.id]);
            
            if (updateResult.affectedRows > 0) {
              console.log(`   ✅ Successfully updated balance to: ${oldBalance + 1000}`);
              
              // Verify the update
              const [newBalance] = await connection.execute(`
                SELECT e.balance FROM economy e WHERE e.player_id = ?
              `, [player.id]);
              
              console.log(`   🔍 Verified new balance: ${newBalance[0].balance}`);
              
              // Revert the test change
              await connection.execute(`
                UPDATE economy SET balance = ? WHERE player_id = ?
              `, [oldBalance, player.id]);
              
              console.log(`   🔄 Reverted balance back to: ${oldBalance}`);
            } else {
              console.log(`   ❌ Failed to update balance`);
            }
          } catch (error) {
            console.log(`   ❌ Error updating balance: ${error.message}`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Error during economy check:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

// Run the script
checkPlayerEconomy();
