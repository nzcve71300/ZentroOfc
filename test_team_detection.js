const pool = require('./src/db');
const { sendRconCommand } = require('./src/rcon');

async function testTeamDetection() {
  try {
    console.log('🔍 Testing Team Detection...\n');

    // Get first server for testing
    const [servers] = await pool.query('SELECT * FROM rust_servers LIMIT 1');
    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    const server = servers[0];
    console.log(`Testing with server: ${server.nickname} (${server.ip}:${server.port})`);

    // Test getting all teams
    console.log('\n1. Testing team info retrieval...');
    try {
      const allTeamsResult = await sendRconCommand(server.ip, server.port, server.password, 'relationshipmanager.teaminfoall');
      console.log('✅ Team info command executed');
      
      if (allTeamsResult) {
        const lines = allTeamsResult.split('\n');
        console.log(`Found ${lines.length} lines in team info`);
        
        // Look for team lines
        const teamLines = lines.filter(line => line.includes('Team') && line.includes(':'));
        console.log(`Found ${teamLines.length} teams`);
        
        if (teamLines.length > 0) {
          console.log('Sample team lines:');
          teamLines.slice(0, 3).forEach(line => console.log(`  - ${line}`));
          
          // Test getting detailed info for first team
          const firstTeamMatch = teamLines[0].match(/Team (\d+):/);
          if (firstTeamMatch) {
            const teamId = firstTeamMatch[1];
            console.log(`\n2. Testing detailed team info for team ${teamId}...`);
            
            const detailedTeamInfo = await sendRconCommand(server.ip, server.port, server.password, `relationshipmanager.teaminfo "${teamId}"`);
            if (detailedTeamInfo) {
              console.log('✅ Detailed team info retrieved');
              console.log('Team details:');
              const teamLines = detailedTeamInfo.split('\n');
              teamLines.forEach(line => {
                if (line.trim()) console.log(`  - ${line}`);
              });
            } else {
              console.log('❌ No detailed team info returned');
            }
          }
        } else {
          console.log('ℹ️ No teams found on server');
        }
      } else {
        console.log('❌ No team info returned');
      }
    } catch (error) {
      console.error('❌ Error getting team info:', error.message);
    }

    // Test online players
    console.log('\n3. Testing online players...');
    try {
      const onlinePlayersResult = await sendRconCommand(server.ip, server.port, server.password, 'players');
      if (onlinePlayersResult) {
        const lines = onlinePlayersResult.split('\n');
        const playerLines = lines.filter(line => line.includes('(') && line.includes(')'));
        console.log(`Found ${playerLines.length} online players`);
        
        if (playerLines.length > 0) {
          console.log('Sample players:');
          playerLines.slice(0, 3).forEach(line => console.log(`  - ${line}`));
        }
      } else {
        console.log('❌ No online players info returned');
      }
    } catch (error) {
      console.error('❌ Error getting online players:', error.message);
    }

    console.log('\n🎉 Team detection test completed!');

  } catch (error) {
    console.error('❌ Error testing team detection:', error);
  }
}

testTeamDetection(); 