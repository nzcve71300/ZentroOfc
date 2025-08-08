-- Check for duplicate servers in the database (fixed version)

-- Show all servers to identify duplicates
SELECT 
    'All servers:' as info,
    id,
    nickname,
    ip,
    port,
    guild_id
FROM rust_servers 
ORDER BY nickname;

-- Find duplicate servers by nickname
SELECT 
    'Duplicate servers by nickname:' as info,
    nickname,
    COUNT(*) as duplicate_count
FROM rust_servers 
GROUP BY nickname 
HAVING COUNT(*) > 1;

-- Find duplicate servers by IP:PORT
SELECT 
    'Duplicate servers by IP:PORT:' as info,
    ip,
    port,
    COUNT(*) as duplicate_count,
    GROUP_CONCAT(nickname) as server_names
FROM rust_servers 
GROUP BY ip, port 
HAVING COUNT(*) > 1;

-- Show detailed duplicate information
SELECT 
    'Detailed duplicate info:' as info,
    rs1.id as id1,
    rs1.nickname as name1,
    rs1.ip as ip1,
    rs1.port as port1,
    rs2.id as id2,
    rs2.nickname as name2,
    rs2.ip as ip2,
    rs2.port as port2
FROM rust_servers rs1
JOIN rust_servers rs2 ON rs1.nickname = rs2.nickname AND rs1.id < rs2.id
ORDER BY rs1.nickname;