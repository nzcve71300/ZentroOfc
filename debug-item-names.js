const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugItemNames() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('🔍 Debugging Item Names for Emperor 3x Server...\n');

        // First, let's see what server mapping we have
        console.log('📋 SERVER MAPPING:');
        const [servers] = await pool.query(`
            SELECT s.*, rs.id as rust_server_id
            FROM servers s
            LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
            WHERE s.id = 1
        `);
        console.log(servers);

        if (servers.length > 0) {
            const server = servers[0];
            const rustServerId = server.rust_server_id;
            
            console.log(`\n🔍 Looking for categories with server_id = '${rustServerId}'`);
            
            // Get categories for this server
            const [categories] = await pool.query(
                'SELECT * FROM shop_categories WHERE server_id = ?',
                [rustServerId]
            );
            console.log(`\n📂 CATEGORIES for server ${rustServerId}:`);
            console.table(categories);

            // Get items for each category
            for (const category of categories) {
                console.log(`\n🛍️ ITEMS in category ${category.id} (${category.name}):`);
                
                if (category.type === 'items') {
                    const [items] = await pool.query(
                        'SELECT * FROM shop_items WHERE category_id = ?',
                        [category.id]
                    );
                    console.table(items);
                } else if (category.type === 'kits') {
                    const [kits] = await pool.query(
                        'SELECT * FROM shop_kits WHERE category_id = ?',
                        [category.id]
                    );
                    console.table(kits);
                } else if (category.type === 'vehicles') {
                    const [vehicles] = await pool.query(
                        'SELECT * FROM shop_vehicles WHERE category_id = ?',
                        [category.id]
                    );
                    console.table(vehicles);
                }
            }
        }

        // Let's also check what categories exist for the "RustisChaos" server that had the original data
        console.log('\n🔍 CHECKING RUSTISCHAOS SERVER DATA:');
        const [rustisChaosCategories] = await pool.query(
            "SELECT * FROM shop_categories WHERE server_id = '1756652040452_0d5qi29p4'"
        );
        console.log(`\n📂 CATEGORIES for RustisChaos server:`);
        console.table(rustisChaosCategories);

        // Get items from RustisChaos categories
        for (const category of rustisChaosCategories) {
            console.log(`\n🛍️ ITEMS in RustisChaos category ${category.id} (${category.name}):`);
            
            if (category.type === 'items') {
                const [items] = await pool.query(
                    'SELECT * FROM shop_items WHERE category_id = ?',
                    [category.id]
                );
                console.table(items);
            } else if (category.type === 'kits') {
                const [kits] = await pool.query(
                    'SELECT * FROM shop_kits WHERE category_id = ?',
                    [category.id]
                );
                console.table(kits);
            }
        }

    } catch (error) {
        console.error('Error during debugging:', error);
    } finally {
        await pool.end();
    }
}

debugItemNames();
