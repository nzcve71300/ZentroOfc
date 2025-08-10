const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function setupNivaroSystem() {
  console.log('🚀 Setting up Nivaro Store System...\n');

  try {
    // Step 1: Test database connection
    console.log('1️⃣ Testing database connection...');
    await pool.query('SELECT 1');
    console.log('   ✅ Database connection successful');

    // Step 2: Create Nivaro store tables
    console.log('\n2️⃣ Creating Nivaro store tables...');
    
    const schemaPath = path.join(__dirname, 'nivaro_store_schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.log('   ❌ nivaro_store_schema.sql not found');
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema.split(';').filter(stmt => stmt.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement);
          console.log('   ✅ Executed SQL statement');
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('   ⚠️  Table already exists (skipping)');
          } else {
            console.log(`   ❌ Error executing statement: ${error.message}`);
          }
        }
      }
    }

    // Step 3: Verify tables exist
    console.log('\n3️⃣ Verifying tables...');
    const requiredTables = ['pending_stores', 'stores', 'discord_links', 'api_rate_limits'];
    
    for (const table of requiredTables) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
        console.log(`   ✅ ${table} table verified`);
      } catch (error) {
        console.log(`   ❌ ${table} table missing`);
        return;
      }
    }

    // Step 4: Create indexes for better performance
    console.log('\n4️⃣ Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_pending_stores_secret_key ON pending_stores(secret_key)',
      'CREATE INDEX IF NOT EXISTS idx_pending_stores_expires_at ON pending_stores(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_pending_stores_is_used ON pending_stores(is_used)',
      'CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_stores_owner_email ON stores(owner_email)',
      'CREATE INDEX IF NOT EXISTS idx_discord_links_guild_id ON discord_links(discord_guild_id)',
      'CREATE INDEX IF NOT EXISTS idx_discord_links_is_active ON discord_links(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_api_rate_limits_ip_endpoint ON api_rate_limits(ip_address, endpoint)',
      'CREATE INDEX IF NOT EXISTS idx_api_rate_limits_last_request ON api_rate_limits(last_request_at)'
    ];

    for (const index of indexes) {
      try {
        await pool.query(index);
        console.log('   ✅ Index created');
      } catch (error) {
        console.log(`   ⚠️  Index already exists or error: ${error.message}`);
      }
    }

    // Step 5: Insert sample data for testing
    console.log('\n5️⃣ Creating sample data...');
    
    const sampleStores = [
      {
        secret_key: 'sample_key_123',
        store_name: 'Sample Store 1',
        store_url: 'https://sample1.nivaro.com',
        owner_email: 'sample1@example.com'
      },
      {
        secret_key: 'sample_key_456',
        store_name: 'Sample Store 2',
        store_url: 'https://sample2.nivaro.com',
        owner_email: 'sample2@example.com'
      }
    ];

    for (const store of sampleStores) {
      try {
        await pool.query(
          'INSERT INTO pending_stores (secret_key, store_name, store_url, owner_email) VALUES (?, ?, ?, ?)',
          [store.secret_key, store.store_name, store.store_url, store.owner_email]
        );
        console.log(`   ✅ Created sample store: ${store.store_name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`   ⚠️  Sample store already exists: ${store.store_name}`);
        } else {
          console.log(`   ❌ Error creating sample store: ${error.message}`);
        }
      }
    }

    // Step 6: Update environment configuration
    console.log('\n6️⃣ Checking environment configuration...');
    
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Check if API_PORT is set
      if (!envContent.includes('API_PORT=')) {
        envContent += '\n# Nivaro Store API Configuration\nAPI_PORT=3001\n';
        fs.writeFileSync(envPath, envContent);
        console.log('   ✅ Added API_PORT to .env file');
      } else {
        console.log('   ⚠️  API_PORT already configured');
      }
    } else {
      console.log('   ⚠️  .env file not found - please create one with your configuration');
    }

    console.log('\n✅ Nivaro Store System setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Start the API server: npm run start:api');
    console.log('3. Deploy Discord commands: node deploy-commands.js');
    console.log('4. Test the system: node test_nivaro_system.js');
    console.log('\n📋 Sample secret keys for testing:');
    console.log('   - sample_key_123 (Sample Store 1)');
    console.log('   - sample_key_456 (Sample Store 2)');
    console.log('\n📋 API Endpoints:');
    console.log('   - Health check: GET http://localhost:3001/health');
    console.log('   - Generate secret: POST http://localhost:3001/api/generate-secret');
    console.log('   - Verify link: POST http://localhost:3001/api/verify-discord-link');
    console.log('   - Get store info: GET http://localhost:3001/api/store/:guild_id');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupNivaroSystem(); 