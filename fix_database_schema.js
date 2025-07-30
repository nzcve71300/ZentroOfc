const pool = require('./src/db');

async function fixDatabaseSchema() {
  try {
    console.log('🔧 Fixing database schema...');
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection verified');
    
    // Fix economy table
    console.log('📊 Fixing economy table...');
    
    // Add guild_id column if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE economy 
        ADD COLUMN guild_id INT
      `);
      console.log('✅ Added guild_id column to economy table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ guild_id column already exists in economy table');
      } else {
        console.error('❌ Failed to add guild_id to economy:', error.message);
      }
    }
    
    // Add server_id column if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE economy 
        ADD COLUMN server_id VARCHAR(32)
      `);
      console.log('✅ Added server_id column to economy table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ server_id column already exists in economy table');
      } else {
        console.error('❌ Failed to add server_id to economy:', error.message);
      }
    }
    
    // Add discord_id column if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE economy 
        ADD COLUMN discord_id VARCHAR(32)
      `);
      console.log('✅ Added discord_id column to economy table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ discord_id column already exists in economy table');
      } else {
        console.error('❌ Failed to add discord_id to economy:', error.message);
      }
    }
    
    // Fix transactions table
    console.log('📈 Fixing transactions table...');
    
    // Add guild_id column if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE transactions 
        ADD COLUMN guild_id INT
      `);
      console.log('✅ Added guild_id column to transactions table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ guild_id column already exists in transactions table');
      } else {
        console.error('❌ Failed to add guild_id to transactions:', error.message);
      }
    }
    
    // Add server_id column if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE transactions 
        ADD COLUMN server_id VARCHAR(32)
      `);
      console.log('✅ Added server_id column to transactions table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ server_id column already exists in transactions table');
      } else {
        console.error('❌ Failed to add server_id to transactions:', error.message);
      }
    }
    
    // Add discord_id column if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE transactions 
        ADD COLUMN discord_id VARCHAR(32)
      `);
      console.log('✅ Added discord_id column to transactions table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ discord_id column already exists in transactions table');
      } else {
        console.error('❌ Failed to add discord_id to transactions:', error.message);
      }
    }
    
    // Add foreign key constraints
    console.log('🔗 Adding foreign key constraints...');
    
    try {
      await pool.query(`
        ALTER TABLE economy 
        ADD CONSTRAINT fk_economy_guild 
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      `);
      console.log('✅ Added guild foreign key to economy');
    } catch (error) {
      if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
        console.log('ℹ️ guild foreign key already exists in economy');
      } else {
        console.error('❌ Failed to add guild foreign key to economy:', error.message);
      }
    }
    
    try {
      await pool.query(`
        ALTER TABLE economy 
        ADD CONSTRAINT fk_economy_server 
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      `);
      console.log('✅ Added server foreign key to economy');
    } catch (error) {
      if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
        console.log('ℹ️ server foreign key already exists in economy');
      } else {
        console.error('❌ Failed to add server foreign key to economy:', error.message);
      }
    }
    
    try {
      await pool.query(`
        ALTER TABLE transactions 
        ADD CONSTRAINT fk_transactions_guild 
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      `);
      console.log('✅ Added guild foreign key to transactions');
    } catch (error) {
      if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
        console.log('ℹ️ guild foreign key already exists in transactions');
      } else {
        console.error('❌ Failed to add guild foreign key to transactions:', error.message);
      }
    }
    
    try {
      await pool.query(`
        ALTER TABLE transactions 
        ADD CONSTRAINT fk_transactions_server 
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      `);
      console.log('✅ Added server foreign key to transactions');
    } catch (error) {
      if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
        console.log('ℹ️ server foreign key already exists in transactions');
      } else {
        console.error('❌ Failed to add server foreign key to transactions:', error.message);
      }
    }
    
    // Add unique constraints
    console.log('🔒 Adding unique constraints...');
    
    try {
      await pool.query(`
        ALTER TABLE economy 
        ADD CONSTRAINT economy_unique_guild_server_discord 
        UNIQUE (guild_id, server_id, discord_id)
      `);
      console.log('✅ Added unique constraint to economy');
    } catch (error) {
      if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
        console.log('ℹ️ unique constraint already exists in economy');
      } else {
        console.error('❌ Failed to add unique constraint to economy:', error.message);
      }
    }
    
    try {
      await pool.query(`
        ALTER TABLE transactions 
        ADD CONSTRAINT transactions_unique_guild_server_discord 
        UNIQUE (guild_id, server_id, discord_id)
      `);
      console.log('✅ Added unique constraint to transactions');
    } catch (error) {
      if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
        console.log('ℹ️ unique constraint already exists in transactions');
      } else {
        console.error('❌ Failed to add unique constraint to transactions:', error.message);
      }
    }
    
    // Create indexes for better performance
    console.log('📊 Creating indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_economy_guild_server ON economy(guild_id, server_id)',
      'CREATE INDEX IF NOT EXISTS idx_economy_discord ON economy(discord_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_guild_server ON transactions(guild_id, server_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_discord ON transactions(discord_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await pool.query(indexQuery);
        console.log(`✅ Created index: ${indexQuery.split(' ')[2]}`);
      } catch (error) {
        if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
          console.log(`ℹ️ Index already exists: ${indexQuery.split(' ')[2]}`);
        } else {
          console.error(`❌ Failed to create index: ${error.message}`);
        }
      }
    }
    
    console.log('✅ Database schema fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Database schema fix failed:', error.message);
  } finally {
    await pool.end();
  }
}

fixDatabaseSchema(); 