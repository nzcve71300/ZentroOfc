const mysql = require('mysql2/promise');
require('dotenv').config();

async function addServerFixed() {
    console.log('🔧 Adding RISE 3X server to database (fixed)...');
    
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

    try {
        // First, check the table structure
        console.log(`\n📋 Checking rust_servers table structure:`);
        const [structure] = await pool.execute('DESCRIBE rust_servers');
        console.log(structure);
        
        // Server configuration
        const serverConfig = {
            guild_id: 2, // Guild ID for RISE 3X
            nickname: 'RISE 3X',
            ip: '149.102.132.219',
            port: 30216,
            password: 'JPMGiS0u'
        };
        
        console.log(`\n📋 Adding server:`);
        console.log(`   Guild ID: ${serverConfig.guild_id}`);
        console.log(`   Nickname: ${serverConfig.nickname}`);
        console.log(`   IP: ${serverConfig.ip}`);
        console.log(`   Port: ${serverConfig.port}`);
        
        // Try different insert methods based on table structure
        let result;
        
        // Method 1: Let MySQL auto-generate the ID
        try {
            console.log(`\n🔧 Method 1: Auto-generate ID`);
            [result] = await pool.execute(
                'INSERT INTO rust_servers (guild_id, nickname, ip, port, password) VALUES (?, ?, ?, ?, ?)',
                [serverConfig.guild_id, serverConfig.nickname, serverConfig.ip, serverConfig.port, serverConfig.password]
            );
            console.log('✅ Method 1 succeeded!');
        } catch (error) {
            console.log('❌ Method 1 failed:', error.message);
            
            // Method 2: Generate a unique ID manually
            try {
                console.log(`\n🔧 Method 2: Manual ID generation`);
                const timestamp = Date.now();
                const uniqueId = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
                
                [result] = await pool.execute(
                    'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password) VALUES (?, ?, ?, ?, ?, ?)',
                    [uniqueId, serverConfig.guild_id, serverConfig.nickname, serverConfig.ip, serverConfig.port, serverConfig.password]
                );
                console.log('✅ Method 2 succeeded!');
            } catch (error2) {
                console.log('❌ Method 2 failed:', error2.message);
                throw error2;
            }
        }
        
        console.log('✅ Server added successfully!');
        console.log('   Insert ID:', result.insertId);
        
        // Verify the server was added
        console.log(`\n🔍 Verifying server was added:`);
        const [servers] = await pool.execute('SELECT * FROM rust_servers');
        console.log('   All servers:', servers);
        
        console.log(`\n🔄 Now restart your bot: pm2 restart zentro-bot`);
        console.log(`📋 The bot should now find 1 server and establish RCON connection`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

addServerFixed(); 