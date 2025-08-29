const pool = require('./src/db');
const fs = require('fs');

async function setupZorpLists() {
    console.log('🔧 Setting up ZORP List System...');
    console.log('=====================================\n');

    try {
        // Read and execute the SQL script
        const sqlScript = fs.readFileSync('./create_zorp_tables.sql', 'utf8');
        const statements = sqlScript.split(';').filter(stmt => stmt.trim());
        
        console.log('📋 Creating ZORP database tables...');
        
        for (const statement of statements) {
            if (statement.trim()) {
                await pool.execute(statement);
            }
        }
        
        console.log('✅ ZORP tables created successfully!');
        
        // Verify tables exist
        const [tables] = await pool.execute(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('zorp_allowed_users', 'zorp_banned_users', 'zorp_configs')
        `, [process.env.DB_NAME]);
        
        console.log('\n📊 Database Tables Status:');
        const expectedTables = ['zorp_allowed_users', 'zorp_banned_users', 'zorp_configs'];
        expectedTables.forEach(table => {
            const exists = tables.some(t => t.TABLE_NAME === table);
            console.log(`   ${exists ? '✅' : '❌'} ${table}`);
        });
        
        // Check existing configurations
        const [configs] = await pool.execute('SELECT COUNT(*) as count FROM zorp_configs');
        const [allowed] = await pool.execute('SELECT COUNT(*) as count FROM zorp_allowed_users');
        const [banned] = await pool.execute('SELECT COUNT(*) as count FROM zorp_banned_users');
        
        console.log('\n📈 Current Data:');
        console.log(`   ZORP Configs: ${configs[0].count}`);
        console.log(`   Allowed Users: ${allowed[0].count}`);
        console.log(`   Banned Users: ${banned[0].count}`);
        
        console.log('\n🎯 ZORP List System Features:');
        console.log('   ✅ ZORP-LIST: Allow specific players to use ZORP');
        console.log('   ✅ ZORP-BANLIST: Ban players from using ZORP');
        console.log('   ✅ ZORP-USELIST: Enable/disable allowed list requirement');
        console.log('   ✅ Ban list works regardless of USELIST setting');
        console.log('   ✅ USELIST off by default (everyone can use ZORP)');
        
        console.log('\n📝 Available Commands:');
        console.log('   /add-to-list ZORP-LIST <player> <server>');
        console.log('   /add-to-list ZORP-BANLIST <player> <server>');
        console.log('   /remove-from-list ZORP-LIST <player> <server>');
        console.log('   /remove-from-list ZORP-BANLIST <player> <server>');
        console.log('   /set ZORP-USELIST on <server>');
        console.log('   /set ZORP-USELIST off <server>');
        
        console.log('\n🔄 Next Steps:');
        console.log('1. Deploy commands: node deploy-commands.js');
        console.log('2. Restart bot: pm2 restart zentro-bot');
        console.log('3. Test the system in-game');
        console.log('4. Configure ZORP-USELIST as needed');
        
        console.log('\n💡 How it works:');
        console.log('   • ZORP-USELIST OFF (default): Everyone can use ZORP');
        console.log('   • ZORP-USELIST ON: Only players in ZORP-LIST can use ZORP');
        console.log('   • ZORP-BANLIST: Banned players cannot use ZORP (always enforced)');
        console.log('   • Removing from ban list restores ZORP access');
        
    } catch (error) {
        console.error('❌ Error setting up ZORP lists:', error.message);
    } finally {
        await pool.end();
    }
}

setupZorpLists();
