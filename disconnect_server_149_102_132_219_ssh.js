const mysql = require('mysql2/promise');
require('dotenv').config();

async function disconnectServerSSH() {
    let connection;
    
    try {
        // Database connection using environment variables
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        console.log('🔌 Connected to database via SSH');

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
            console.log('🔍 Searching by IP only...');
            
            // Try searching by IP only
            const [serversByIP] = await connection.execute(`
                SELECT id, guild_id, nickname, ip, port, rcon_password, is_active 
                FROM servers 
                WHERE ip = ?
            `, [serverIP]);
            
            if (serversByIP.length > 0) {
                console.log(`Found ${serversByIP.length} server(s) with IP ${serverIP}:`);
                serversByIP.forEach((srv, idx) => {
                    console.log(`  ${idx + 1}. ${srv.nickname} - ${srv.ip}:${srv.port} (ID: ${srv.id}, Active: ${srv.is_active})`);
                });
            } else {
                console.log('❌ No servers found with that IP address');
            }
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
        console.log('\n📊 Checking related data that will be preserved...');
        
        const [playerCount] = await connection.execute(
            'SELECT COUNT(*) as count FROM players WHERE server_id = ?',
            [server.id]
        );
        
        const [economyCount] = await connection.execute(`
            SELECT COUNT(*) as count FROM economy e 
            JOIN players p ON e.player_id = p.id 
            WHERE p.server_id = ?
        `, [server.id]);

        const [linksCount] = await connection.execute(
            'SELECT COUNT(*) as count FROM player_links WHERE server_id = ?',
            [server.id]
        );

        console.log(`   • Players: ${playerCount[0].count}`);
        console.log(`   • Economy records: ${economyCount[0].count}`);
        console.log(`   • Player links: ${linksCount[0].count}`);

        // Disconnect the server by setting is_active = 0
        console.log('\n🔌 Disconnecting server from bot (preserving all data)...');
        
        const [result] = await connection.execute(`
            UPDATE servers 
            SET is_active = 0 
            WHERE id = ?
        `, [server.id]);

        if (result.affectedRows > 0) {
            console.log('✅ Server successfully disconnected from bot!');
            console.log('\n📝 IMPORTANT: All data has been preserved:');
            console.log('   ✅ Player links remain intact');
            console.log('   ✅ Economy data remains intact');
            console.log('   ✅ All configurations remain intact');
            console.log('   ✅ Server can be reconnected later by setting is_active = 1');
            console.log('\n🤖 The bot will no longer:');
            console.log('   • Connect to this server via RCON');
            console.log('   • Process commands for this server');
            console.log('   • Show this server in /list-servers');
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
            console.log(`✅ Verification: ${updated.nickname} (${updated.ip}:${updated.port}) is now ${updated.is_active ? 'ACTIVE' : 'DISCONNECTED'}`);
        }

        console.log('\n✅ Server disconnection completed successfully!');

    } catch (error) {
        console.error('❌ Error disconnecting server:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('🔌 Database connection refused. Check your SSH tunnel and database credentials.');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('🔐 Database access denied. Check your database credentials.');
        }
        console.error('Full error:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔐 Database connection closed');
        }
    }
}

// Run the function
console.log('🚀 Starting server disconnection process...');
console.log('📍 Target: 149.102.132.219:30216');
console.log('⚠️  This will ONLY disconnect the server, NOT delete data\n');

disconnectServerSSH();
