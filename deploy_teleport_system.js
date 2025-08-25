const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function deployTeleportSystem() {
  console.log('🚀 Deploying Teleport System');
  console.log('=============================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Read and execute the schema file
    const schemaPath = path.join(__dirname, 'teleport_system_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the schema into individual statements
    const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
    
    console.log('📋 Creating teleport system tables...');
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          console.log('  ✅ Executed SQL statement');
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('  ⚠️  Table already exists, skipping...');
          } else {
            console.error('  ❌ Error executing statement:', error.message);
          }
        }
      }
    }

    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    const tables = [
      'teleport_configs',
      'teleport_allowed_users', 
      'teleport_banned_users',
      'teleport_usage'
    ];

    for (const table of tables) {
      try {
        const [result] = await connection.execute(`DESCRIBE ${table}`);
        console.log(`  ✅ ${table}: ${result.length} columns`);
      } catch (error) {
        console.error(`  ❌ ${table}: ${error.message}`);
      }
    }

    await connection.end();
    console.log('\n✅ Database connection closed');
    console.log('\n🎉 Teleport System Database Setup Complete!');
    console.log('📝 Next steps:');
    console.log('   1. Restart the bot: pm2 restart zentro-bot');
    console.log('   2. Use /set to configure teleport locations');
    console.log('   3. Use /add-to-list to manage allowed/banned users');

  } catch (error) {
    console.error('❌ Error deploying teleport system:', error);
  }
}

deployTeleportSystem();
