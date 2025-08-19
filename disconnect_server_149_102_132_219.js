const mysql = require('mysql2/promise');

async function disconnectServer() {
    let connection;
    
    try {
        // Database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'zentro_bot',
            port: process.env.DB_PORT || 3306
        });

        console.log('🔌 Connected to database');

        // Server details to disconnect
        const serverIP = '149.102.132.219';
        const rconPort = 30216;
        const rconPassword = 'JPMGiS0u';

        // First, let's find the server
        console.log(`🔍 Looking for server ${serverIP}:${rconPort}...`);
        
        const [servers] = await connection.execute(`
            SELECT id, guild_id, nickname, ip, port, rcon_password, is_active 
            FROM servers 
            WHERE ip = ? AND port = ? AND rcon_password = ?
        `, [serverIP, rconPort, rconPassword]);

        if (servers.length === 0) {
            console.log('❌ Server not found in database');
            return;
        }

        const server = servers[0];
        console.log(`📋 Found server: ${server.nickname} (ID: ${server.id})`);
        console.log(`   • Guild ID: ${server.guild_id}`);
        console.log(`   • IP: ${server.ip}:${server.port}`);
        console.log(`   • Current Status: ${server.is_active ? 'Active' : 'Inactive'}`);

        if (server.is_active === 0) {
            console.log('⚠️  Server is already disconnected');
            return;
        }

        // Count related data before disconnecting
        console.log('\n📊 Checking related data...');
        
        const [playerCount] = await connection.execute(
            'SELECT COUNT(*) as count FROM players WHERE server_id = ?',
            [server.id]
        );
        
        const [economyCount] = await connection.execute(`
            SELECT COUNT(*) as count FROM economy e 
            JOIN players p ON e.player_id = p.id 
            WHERE p.server_id = ?
        `, [server.id]);

        console.log(`   • Players linked: ${playerCount[0].count}`);
        console.log(`   • Economy records: ${economyCount[0].count}`);

        // Disconnect the server by setting is_active = 0
        console.log('\n🔌 Disconnecting server from bot...');
        
        const [result] = await connection.execute(`
            UPDATE servers 
            SET is_active = 0 
            WHERE id = ?
        `, [server.id]);

        if (result.affectedRows > 0) {
            console.log('✅ Server successfully disconnected from bot!');
            console.log('📝 Server data has been preserved:');
            console.log('   • Player links remain intact');
            console.log('   • Economy data remains intact');
            console.log('   • All other data remains intact');
            console.log('   • Server can be reconnected later by setting is_active = 1');
        } else {
            console.log('❌ Failed to disconnect server');
        }

        // Verify the disconnection
        console.log('\n🔍 Verifying disconnection...');
        const [updatedServers] = await connection.execute(`
            SELECT nickname, ip, port, is_active 
            FROM servers 
            WHERE id = ?
        `, [server.id]);

        if (updatedServers.length > 0) {
            const updated = updatedServers[0];
            console.log(`✅ Verification: ${updated.nickname} is now ${updated.is_active ? 'ACTIVE' : 'DISCONNECTED'}`);
        }

    } catch (error) {
        console.error('❌ Error disconnecting server:', error.message);
        console.error(error.stack);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔐 Database connection closed');
        }
    }
}

// Run the function
disconnectServer();
