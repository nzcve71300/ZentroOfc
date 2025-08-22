const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration - uses same .env file as your bot
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'zentro_user',
    password: process.env.DB_PASSWORD || 'zentro_password',
    database: process.env.DB_NAME || 'zentro_bot',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
};

async function runMigrations() {
    let connection;
    
    try {
        console.log('🔗 Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connected successfully!');
        
        // Read and execute fix_linking_constraints.sql
        console.log('\n📝 Running linking constraints migration...');
        const linkingConstraintsSQL = fs.readFileSync(
            path.join(__dirname, 'fix_linking_constraints.sql'), 
            'utf8'
        );
        await connection.execute(linkingConstraintsSQL);
        console.log('✅ Linking constraints migration completed!');
        
        // Read and execute playtime_rewards_schema.sql
        console.log('\n📝 Running playtime rewards schema migration...');
        const playtimeRewardsSQL = fs.readFileSync(
            path.join(__dirname, 'playtime_rewards_schema.sql'), 
            'utf8'
        );
        await connection.execute(playtimeRewardsSQL);
        console.log('✅ Playtime rewards schema migration completed!');
        
        console.log('\n🎉 All migrations completed successfully!');
        console.log('Your database is now ready for the new features.');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        
        if (error.code === 'ER_DUP_KEYNAME') {
            console.log('💡 This error is normal if the constraints already exist.');
        } else if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('💡 This error is normal if the tables already exist.');
        }
        
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed.');
        }
    }
}

// Run the migrations
runMigrations();
