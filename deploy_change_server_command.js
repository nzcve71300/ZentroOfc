const { REST, Routes } = require('discord.js');
require('dotenv').config();

async function deployChangeServerCommand() {
    console.log('🚀 Deploying /change-server command...\n');

    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
        console.error('❌ Missing DISCORD_TOKEN or CLIENT_ID in environment variables');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        // Import the new command
        const changeServerCommand = require('./src/commands/admin/changeServer');
        
        console.log('📋 Command Details:');
        console.log(`   Name: ${changeServerCommand.data.name}`);
        console.log(`   Description: ${changeServerCommand.data.description}`);
        console.log('   Options:');
        changeServerCommand.data.options.forEach(option => {
            console.log(`     - ${option.name}: ${option.description} (${option.required ? 'Required' : 'Optional'})`);
        });
        
        console.log('\n🔄 Registering command globally...');
        
        // Register the command globally
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: [changeServerCommand.data.toJSON()] }
        );

        console.log(`✅ Successfully registered ${data.length} command globally`);
        console.log('   The command will be available in all servers within ~1 hour');
        
        console.log('\n🎯 Command Usage:');
        console.log('   /change-server');
        console.log('   ├── server: (autocomplete) - Select server to update');
        console.log('   ├── new_nickname: New server display name');
        console.log('   ├── new_ip: New server IP address');
        console.log('   ├── new_port: New server port (1-65535)');
        console.log('   └── new_password: New RCON password');
        
        console.log('\n🔒 Security Features:');
        console.log('   ✅ Requires ZentroAdmin role or Administrator permission');
        console.log('   ✅ Validates IP address format');
        console.log('   ✅ Prevents nickname conflicts');
        console.log('   ✅ Prevents IP:Port conflicts');
        console.log('   ✅ Uses database transactions for data consistency');
        
        console.log('\n💾 Data Preservation:');
        console.log('   ✅ All channel settings preserved');
        console.log('   ✅ All player records preserved');
        console.log('   ✅ All ZORP zones preserved');
        console.log('   ✅ All economy data preserved');
        console.log('   ✅ All statistics preserved');
        
        console.log('\n⚠️  Important Notes:');
        console.log('   • The bot will automatically reconnect to new server details');
        console.log('   • Connection may take up to 60 seconds');
        console.log('   • All Discord channels continue working normally');
        console.log('   • No data is lost during the update process');
        
    } catch (error) {
        console.error('❌ Failed to deploy command:', error);
        
        if (error.code === 50001) {
            console.error('   Missing Access - Check bot permissions');
        } else if (error.code === 50013) {
            console.error('   Missing Permissions - Bot needs application commands permission');
        } else if (error.status === 401) {
            console.error('   Invalid Token - Check DISCORD_TOKEN in .env file');
        }
    }
}

// Run deployment
deployChangeServerCommand().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
});
