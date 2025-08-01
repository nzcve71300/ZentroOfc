const pool = require('./src/db');
const { sendRconCommand } = require('./src/rcon');

async function debugTeamDetection() {
  try {
    console.log('🔍 Debugging Team Detection...\n');

    // Get first server for testing
    const [servers] = await pool.query('SELECT * FROM rust_servers LIMIT 1');
    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    const server = servers[0];
    console.log(`Testing with server: ${server.nickname} (${server.ip}:${server.port})`);

    // Test 1: Get all teams
    console.log('\n1. Testing relationshipmanager.teaminfoall...');
    try {
      const allTeamsResult = await sendRconCommand(server.ip, server.port, server.password, 'relationshipmanager.teaminfoall');
      console.log('✅ Team info command executed');
      console.log('Raw result:');
      console.log(allTeamsResult);
      
      if (allTeamsResult) {
        const lines = allTeamsResult.split('\n');
        console.log(`\nFound ${lines.length} lines in team info`);
        
        // Look for team lines
        const teamLines = lines.filter(line => line.includes('Team') && line.includes(':'));
        console.log(`Found ${teamLines.length} teams`);
        
        if (teamLines.length > 0) {
          console.log('\nTeam lines found:');
          teamLines.forEach((line, index) => {
            console.log(`  ${index + 1}. ${line}`);
          });
          
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

    // Test 2: Get online players
    console.log('\n3. Testing online players...');
    try {
      const onlinePlayersResult = await sendRconCommand(server.ip, server.port, server.password, 'players');
      if (onlinePlayersResult) {
        const lines = onlinePlayersResult.split('\n');
        const playerLines = lines.filter(line => line.includes('(') && line.includes(')'));
        console.log(`Found ${playerLines.length} online players`);
        
        if (playerLines.length > 0) {
          console.log('Sample players:');
          playerLines.slice(0, 5).forEach(line => console.log(`  - ${line}`));
        }
      } else {
        console.log('❌ No online players info returned');
      }
    } catch (error) {
      console.error('❌ Error getting online players:', error.message);
    }

    // Test 3: Try alternative team commands
    console.log('\n4. Testing alternative team commands...');
    const alternativeCommands = [
      'teams',
      'team list',
      'relationshipmanager.teams',
      'relationshipmanager.listteams'
    ];

    for (const command of alternativeCommands) {
      try {
        console.log(`\nTrying command: ${command}`);
        const result = await sendRconCommand(server.ip, server.port, server.password, command);
        if (result) {
          console.log('✅ Command worked:');
          console.log(result);
        } else {
          console.log('❌ No result');
        }
      } catch (error) {
        console.log(`❌ Command failed: ${error.message}`);
      }
    }

    console.log('\n🎉 Team detection debug completed!');

  } catch (error) {
    console.error('❌ Error debugging team detection:', error);
  }
}

debugTeamDetection(); 