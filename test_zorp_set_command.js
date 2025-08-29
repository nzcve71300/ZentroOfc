const pool = require('./src/db');

async function testZorpSetCommand() {
    console.log('🔧 Testing ZORP Set Command...');
    console.log('================================\n');

    try {
        // Check current ZORP configs
        console.log('📋 Current ZORP Configurations:');
        const [zorpConfigs] = await pool.execute(`
            SELECT zc.server_id, rs.nickname, zc.use_list 
            FROM zorp_configs zc 
            JOIN rust_servers rs ON zc.server_id = rs.id 
            ORDER BY rs.nickname
        `);

        zorpConfigs.forEach(config => {
            console.log(`   ${config.nickname}: use_list = ${config.use_list} (${config.use_list ? 'ENABLED' : 'DISABLED'})`);
        });

        // Check current recycler configs
        console.log('\n📋 Current Recycler Configurations:');
        const [recyclerConfigs] = await pool.execute(`
            SELECT rc.server_id, rs.nickname, rc.enabled, rc.use_list 
            FROM recycler_configs rc 
            JOIN rust_servers rs ON rc.server_id = rs.id 
            ORDER BY rs.nickname
        `);

        recyclerConfigs.forEach(config => {
            console.log(`   ${config.nickname}: enabled = ${config.enabled}, use_list = ${config.use_list}`);
        });

        // Test the set command logic
        console.log('\n🧪 Testing Set Command Logic:');
        
        const testValues = ['on', 'off', 'true', 'false'];
        testValues.forEach(value => {
            const booleanResult = value === 'on' || value === 'true';
            console.log(`   "${value}" -> ${booleanResult}`);
        });

        // Test updating a specific server (Emperor 3x)
        console.log('\n🔧 Testing Update for Emperor 3x...');
        
        const [emperorServer] = await pool.execute(`
            SELECT id FROM rust_servers WHERE nickname = 'Emperor 3x'
        `);

        if (emperorServer.length > 0) {
            const serverId = emperorServer[0].id;
            console.log(`   Server ID: ${serverId}`);

            // Test setting ZORP-USELIST to ON
            const testValue = 'on';
            const booleanValue = testValue === 'on' || testValue === 'true';
            
            console.log(`   Testing: ZORP-USELIST = "${testValue}" -> ${booleanValue}`);
            
            // Update the database
            await pool.execute(`
                UPDATE zorp_configs SET use_list = ? WHERE server_id = ?
            `, [booleanValue, serverId]);

            // Verify the update
            const [verifyResult] = await pool.execute(`
                SELECT use_list FROM zorp_configs WHERE server_id = ?
            `, [serverId]);

            if (verifyResult.length > 0) {
                console.log(`   ✅ Update successful: use_list = ${verifyResult[0].use_list}`);
            } else {
                console.log(`   ❌ Update failed: No config found`);
            }

            // Test setting ZORP-USELIST to OFF
            const testValue2 = 'off';
            const booleanValue2 = testValue2 === 'on' || testValue2 === 'true';
            
            console.log(`   Testing: ZORP-USELIST = "${testValue2}" -> ${booleanValue2}`);
            
            // Update the database
            await pool.execute(`
                UPDATE zorp_configs SET use_list = ? WHERE server_id = ?
            `, [booleanValue2, serverId]);

            // Verify the update
            const [verifyResult2] = await pool.execute(`
                SELECT use_list FROM zorp_configs WHERE server_id = ?
            `, [serverId]);

            if (verifyResult2.length > 0) {
                console.log(`   ✅ Update successful: use_list = ${verifyResult2[0].use_list}`);
            } else {
                console.log(`   ❌ Update failed: No config found`);
            }
        }

        console.log('\n📝 Next Steps:');
        console.log('1. Restart the bot: pm2 restart zentro-bot');
        console.log('2. Test the /set command: /set ZORP-USELIST on Emperor 3x');
        console.log('3. Check the logs for debug output');
        console.log('4. Test ZORP creation in-game');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

testZorpSetCommand();
