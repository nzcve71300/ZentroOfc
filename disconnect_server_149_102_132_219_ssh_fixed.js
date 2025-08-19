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

        console.log(`🔍 Looking for server ${serverIP}:${rconPort}...`);

        // First, let's check what tables exist
        console.log('🔍 Checking available tables...');
        const [tables] = await connection.execute(`SHOW TABLES`);
        const tableNames = tables.map(row => Object.values(row)[0]);
        console.log('Available tables:', tableNames.join(', '));

        let serverTable = null;
        let serverColumns = {};

        // Check if 'servers' table exists and get its structure
        if (tableNames.includes('servers')) {
            serverTable = 'servers';
            const [columns] = await connection.execute(`DESCRIBE servers`);
            columns.forEach(col => {
                serverColumns[col.Field] = col.Type;
            });
            console.log('📋 Using "servers" table with columns:', Object.keys(serverColumns).join(', '));
        }
        // Check if 'rust_servers' table exists
        else if (tableNames.includes('rust_servers')) {
            serverTable = 'rust_servers';
            const [columns] = await connection.execute(`DESCRIBE rust_servers`);
            columns.forEach(col => {
                serverColumns[col.Field] = col.Type;
            });
            console.log('📋 Using "rust_servers" table with columns:', Object.keys(serverColumns).join(', '));
        }
        else {
            console.log('❌ No server table found (neither "servers" nor "rust_servers")');
            return;
        }

        // Build the query based on available columns
        let selectColumns = ['id'];
        let whereConditions = [];
        let whereParams = [];

        // Add columns that exist
        if (serverColumns.guild_id) selectColumns.push('guild_id');
        if (serverColumns.nickname) selectColumns.push('nickname');
        if (serverColumns.name) selectColumns.push('name');
        if (serverColumns.ip) {
            selectColumns.push('ip');
            whereConditions.push('ip = ?');
            whereParams.push(serverIP);
        }
        if (serverColumns.port) {
            selectColumns.push('port');
            whereConditions.push('port = ?');
            whereParams.push(rconPort);
        }
        if (serverColumns.password) {
            selectColumns.push('password');
            whereConditions.push('password = ?');
            whereParams.push(rconPassword);
        }
        if (serverColumns.rcon_password) {
            selectColumns.push('rcon_password');
            whereConditions.push('rcon_password = ?');
            whereParams.push(rconPassword);
        }
        if (serverColumns.is_active) selectColumns.push('is_active');

        const selectQuery = `SELECT ${selectColumns.join(', ')} FROM ${serverTable} WHERE ${whereConditions.join(' AND ')}`;
        
        console.log('🔍 Executing query:', selectQuery);
        console.log('🔍 With parameters:', whereParams);

        const [servers] = await connection.execute(selectQuery, whereParams);

        if (servers.length === 0) {
            console.log('❌ Server not found with exact match');
            console.log('🔍 Searching by IP only...');
            
            // Try searching by IP only
            const ipQuery = `SELECT ${selectColumns.join(', ')} FROM ${serverTable} WHERE ip = ?`;
            const [serversByIP] = await connection.execute(ipQuery, [serverIP]);
            
            if (serversByIP.length > 0) {
                console.log(`Found ${serversByIP.length} server(s) with IP ${serverIP}:`);
                serversByIP.forEach((srv, idx) => {
                    const name = srv.nickname || srv.name || 'Unknown';
                    const active = srv.is_active !== undefined ? srv.is_active : 'Unknown';
                    console.log(`  ${idx + 1}. ${name} - ${srv.ip}:${srv.port} (ID: ${srv.id}, Active: ${active})`);
                });
            } else {
                console.log('❌ No servers found with that IP address');
            }
            return;
        }

        const server = servers[0];
        const serverName = server.nickname || server.name || 'Unknown Server';
        console.log(`📋 Found server: ${serverName} (ID: ${server.id})`);
        console.log(`   • Guild ID: ${server.guild_id || 'N/A'}`);
        console.log(`   • IP: ${server.ip}:${server.port}`);
        console.log(`   • Current Status: ${server.is_active ? 'Active' : 'Inactive'}`);

        if (server.is_active === 0 || server.is_active === false) {
            console.log('⚠️  Server is already disconnected');
            return;
        }

        // Count related data before disconnecting
        console.log('\n📊 Checking related data that will be preserved...');
        
        // Check players table
        if (tableNames.includes('players')) {
            const [playerCount] = await connection.execute(
                'SELECT COUNT(*) as count FROM players WHERE server_id = ?',
                [server.id]
            );
            console.log(`   • Players: ${playerCount[0].count}`);
        }

        // Check economy
        if (tableNames.includes('economy')) {
            try {
                const [economyCount] = await connection.execute(`
                    SELECT COUNT(*) as count FROM economy e 
                    JOIN players p ON e.player_id = p.id 
                    WHERE p.server_id = ?
                `, [server.id]);
                console.log(`   • Economy records: ${economyCount[0].count}`);
            } catch (e) {
                console.log('   • Economy records: Could not check (table structure different)');
            }
        }

        // Check player_links
        if (tableNames.includes('player_links')) {
            const [linksCount] = await connection.execute(
                'SELECT COUNT(*) as count FROM player_links WHERE server_id = ?',
                [server.id]
            );
            console.log(`   • Player links: ${linksCount[0].count}`);
        }

        // Disconnect the server
        console.log('\n🔌 Disconnecting server from bot (preserving all data)...');
        
        let updateQuery;
        if (serverColumns.is_active) {
            updateQuery = `UPDATE ${serverTable} SET is_active = 0 WHERE id = ?`;
        } else {
            console.log('❌ No is_active column found. Cannot safely disconnect server.');
            console.log('💡 You may need to manually remove the server from the configuration.');
            return;
        }

        const [result] = await connection.execute(updateQuery, [server.id]);

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
        const verifyQuery = `SELECT ${selectColumns.join(', ')} FROM ${serverTable} WHERE id = ?`;
        const [updatedServers] = await connection.execute(verifyQuery, [server.id]);

        if (updatedServers.length > 0) {
            const updated = updatedServers[0];
            const updatedName = updated.nickname || updated.name || 'Unknown';
            console.log(`✅ Verification: ${updatedName} (${updated.ip}:${updated.port}) is now ${updated.is_active ? 'ACTIVE' : 'DISCONNECTED'}`);
        }

        console.log('\n✅ Server disconnection completed successfully!');

    } catch (error) {
        console.error('❌ Error disconnecting server:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('🔌 Database connection refused. Check your SSH tunnel and database credentials.');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('🔐 Database access denied. Check your database credentials.');
        } else if (error.code === 'ER_BAD_FIELD_ERROR') {
            console.error('🗂️  Database column not found. The database schema might be different than expected.');
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
console.log('⚠️  This will ONLY disconnect the server, NOT delete data');
console.log('🔧 This script will auto-detect your database schema\n');

disconnectServerSSH();
