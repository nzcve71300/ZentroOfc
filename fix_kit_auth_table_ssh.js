const pool = require('./src/db');

async function fixKitAuthTable() {
  try {
    console.log('🔍 SSH: Checking Kit Auth Table Structure...');

    // First, check if kit_auth table exists
    console.log('\n📋 Checking if kit_auth table exists...');
    try {
      const [tables] = await pool.query("SHOW TABLES LIKE 'kit_auth'");
      if (tables.length === 0) {
        console.log('❌ kit_auth table does not exist - creating it...');
        await createKitAuthTable();
      } else {
        console.log('✅ kit_auth table exists');
      }
    } catch (error) {
      console.log('❌ Error checking table existence:', error.message);
    }

    // Check current structure
    console.log('\n📋 Current kit_auth table structure:');
    try {
      const [columns] = await pool.query('DESCRIBE kit_auth');
      console.log('Columns:');
      columns.forEach(col => {
        console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
      });

      // Check if required columns exist
      const columnNames = columns.map(col => col.Field);
      const requiredColumns = ['server_id', 'kit_name', 'player_name'];
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));

      if (missingColumns.length > 0) {
        console.log(`\n❌ Missing columns: ${missingColumns.join(', ')}`);
        await addMissingColumns(missingColumns);
      } else {
        console.log('\n✅ All required columns exist');
      }

    } catch (error) {
      if (error.message.includes("doesn't exist")) {
        console.log('❌ kit_auth table does not exist - creating it...');
        await createKitAuthTable();
      } else {
        console.log('❌ Error describing table:', error.message);
      }
    }

    // Check sample data
    console.log('\n📋 Sample kit_auth data:');
    try {
      const [sampleData] = await pool.query('SELECT * FROM kit_auth LIMIT 5');
      if (sampleData.length === 0) {
        console.log('⚠️  No data in kit_auth table');
      } else {
        console.log(`Found ${sampleData.length} sample record(s):`);
        sampleData.forEach((record, index) => {
          console.log(`   ${index + 1}. Server: ${record.server_id}, Kit: ${record.kit_name || 'N/A'}, Player: ${record.player_name || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log('❌ Error querying sample data:', error.message);
    }

    // Test the query that was failing
    console.log('\n🧪 Testing the failing query...');
    const testServerId = '1754690822459_bxb3nuglj';
    const testKitName = 'ELITEkit1';
    const testPlayer = 'nzcve7130';

    try {
      const [authResult] = await pool.query(
        'SELECT * FROM kit_auth WHERE server_id = ? AND kit_name = ? AND LOWER(player_name) = LOWER(?)',
        [testServerId, testKitName, testPlayer]
      );
      console.log(`✅ Query successful! Found ${authResult.length} authorization record(s)`);
    } catch (error) {
      console.log('❌ Query still failing:', error.message);
    }

    // Show how to authorize players
    console.log('\n🔧 How to authorize players for kits:');
    console.log('1. Use Discord command: /add-to-kit-list player:nzcve7130 kit:ELITEkit1');
    console.log('2. Or manually insert:');
    console.log(`   INSERT INTO kit_auth (server_id, kit_name, player_name) VALUES ('${testServerId}', '${testKitName}', '${testPlayer}');`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

async function createKitAuthTable() {
  try {
    console.log('🔧 Creating kit_auth table...');
    await pool.query(`
      CREATE TABLE kit_auth (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        kit_name VARCHAR(50) NOT NULL,
        player_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_auth (server_id, kit_name, player_name),
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ kit_auth table created successfully');
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
  }
}

async function addMissingColumns(missingColumns) {
  try {
    for (const column of missingColumns) {
      console.log(`🔧 Adding missing column: ${column}`);
      
      let columnDef = '';
      switch (column) {
        case 'server_id':
          columnDef = 'VARCHAR(32) NOT NULL';
          break;
        case 'kit_name':
          columnDef = 'VARCHAR(50) NOT NULL';
          break;
        case 'player_name':
          columnDef = 'VARCHAR(50) NOT NULL';
          break;
        default:
          columnDef = 'VARCHAR(255)';
      }
      
      await pool.query(`ALTER TABLE kit_auth ADD COLUMN ${column} ${columnDef}`);
      console.log(`✅ Added column: ${column}`);
    }
  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
  }
}

// Run the fix
fixKitAuthTable().catch(console.error);