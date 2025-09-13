#!/usr/bin/env node

/**
 * Zentro Bot - Global Command Deployment Script
 * 
 * This script deploys Discord slash commands globally, avoiding duplicates
 * and providing a summary of changes made.
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const CLIENT_ID = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const COMMANDS_DIR = path.join(__dirname, 'src', 'commands');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  colorLog('green', `✅ ${message}`);
}

function logError(message) {
  colorLog('red', `❌ ${message}`);
}

function logWarning(message) {
  colorLog('yellow', `⚠️  ${message}`);
}

function logInfo(message) {
  colorLog('blue', `ℹ️  ${message}`);
}

function logHeader(message) {
  colorLog('cyan', `\n🚀 ${message}`);
}

// Validate environment variables
function validateEnvironment() {
  if (!DISCORD_TOKEN) {
    logError('DISCORD_TOKEN is not set in environment variables');
    process.exit(1);
  }
  
  if (!CLIENT_ID) {
    logError('CLIENT_ID or DISCORD_CLIENT_ID is not set in environment variables');
    process.exit(1);
  }
}

// Load all command files recursively
function loadCommands(dir) {
  const commands = [];
  const commandFiles = fs.readdirSync(dir).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(dir, file);
    try {
      const command = require(filePath);
      if (command.data && command.execute) {
        commands.push(command.data.toJSON());
        logInfo(`Loaded command: ${command.data.name}`);
      } else {
        logWarning(`Skipped ${file}: Missing data or execute function`);
      }
    } catch (error) {
      logError(`Failed to load ${file}: ${error.message}`);
    }
  }
  
  // Load subdirectories
  const subdirs = fs.readdirSync(dir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
    
  for (const subdir of subdirs) {
    const subdirPath = path.join(dir, subdir);
    commands.push(...loadCommands(subdirPath));
  }
  
  return commands;
}

// Get currently registered commands from Discord
async function getCurrentCommands(rest) {
  try {
    const data = await rest.get(Routes.applicationCommands(CLIENT_ID));
    return data;
  } catch (error) {
    logError(`Failed to fetch current commands: ${error.message}`);
    return [];
  }
}

// Compare commands and find differences
function compareCommands(currentCommands, newCommands) {
  const currentMap = new Map(currentCommands.map(cmd => [cmd.name, cmd]));
  const newMap = new Map(newCommands.map(cmd => [cmd.name, cmd]));
  
  const newCommandsList = [];
  const deletedCommandsList = [];
  const updatedCommandsList = [];
  
  // Find new and updated commands
  for (const [name, newCmd] of newMap) {
    if (!currentMap.has(name)) {
      newCommandsList.push(newCmd);
    } else {
      const currentCmd = currentMap.get(name);
      // Simple comparison - in production you might want more sophisticated comparison
      if (JSON.stringify(currentCmd) !== JSON.stringify(newCmd)) {
        updatedCommandsList.push(newCmd);
      }
    }
  }
  
  // Find deleted commands
  for (const [name, currentCmd] of currentMap) {
    if (!newMap.has(name)) {
      deletedCommandsList.push(currentCmd);
    }
  }
  
  return {
    new: newCommandsList,
    deleted: deletedCommandsList,
    updated: updatedCommandsList,
    unchanged: newCommands.filter(cmd => 
      currentMap.has(cmd.name) && 
      JSON.stringify(currentMap.get(cmd.name)) === JSON.stringify(cmd)
    )
  };
}

// Deploy commands to Discord
async function deployCommands(rest, commands) {
  try {
    logInfo('Deploying commands to Discord...');
    
    const data = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    
    return data;
  } catch (error) {
    logError(`Failed to deploy commands: ${error.message}`);
    throw error;
  }
}

// Display summary
function displaySummary(comparison, deployedCommands) {
  logHeader('DEPLOYMENT SUMMARY');
  
  colorLog('white', '┌─────────────────────────────────────────┐');
  colorLog('white', '│                COMMAND SUMMARY           │');
  colorLog('white', '├─────────────────────────────────────────┤');
  
  if (comparison.new.length > 0) {
    colorLog('green', `│ New Commands: ${comparison.new.length.toString().padStart(3)}                    │`);
    comparison.new.forEach(cmd => {
      colorLog('green', `│   + ${cmd.name.padEnd(30)} │`);
    });
  }
  
  if (comparison.updated.length > 0) {
    colorLog('yellow', `│ Updated Commands: ${comparison.updated.length.toString().padStart(2)}                │`);
    comparison.updated.forEach(cmd => {
      colorLog('yellow', `│   ~ ${cmd.name.padEnd(30)} │`);
    });
  }
  
  if (comparison.deleted.length > 0) {
    colorLog('red', `│ Deleted Commands: ${comparison.deleted.length.toString().padStart(2)}                │`);
    comparison.deleted.forEach(cmd => {
      colorLog('red', `│   - ${cmd.name.padEnd(30)} │`);
    });
  }
  
  colorLog('white', '├─────────────────────────────────────────┤');
  colorLog('cyan', `│ Total Commands: ${deployedCommands.length.toString().padStart(3)}                   │`);
  colorLog('white', '└─────────────────────────────────────────┘');
  
  // Additional statistics
  logInfo(`Commands processed: ${comparison.new.length + comparison.updated.length + comparison.unchanged.length}`);
  logInfo(`Commands unchanged: ${comparison.unchanged.length}`);
  
  if (comparison.new.length > 0 || comparison.updated.length > 0) {
    logSuccess('Commands deployed successfully!');
  } else if (comparison.deleted.length > 0) {
    logWarning('Commands removed (no new commands to deploy)');
  } else {
    logInfo('No changes detected - all commands are up to date');
  }
}

// Main execution
async function main() {
  try {
    logHeader('ZENTRO BOT - COMMAND DEPLOYMENT');
    
    // Validate environment
    validateEnvironment();
    
    // Initialize REST client
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    
    // Load commands from files
    logInfo('Loading commands from files...');
    const newCommands = loadCommands(COMMANDS_DIR);
    
    if (newCommands.length === 0) {
      logWarning('No commands found to deploy');
      return;
    }
    
    logInfo(`Found ${newCommands.length} commands in files`);
    
    // Get current commands from Discord
    logInfo('Fetching current commands from Discord...');
    const currentCommands = await getCurrentCommands(rest);
    logInfo(`Found ${currentCommands.length} commands currently registered`);
    
    // Compare commands
    const comparison = compareCommands(currentCommands, newCommands);
    
    // Display what will be changed
    if (comparison.new.length > 0 || comparison.updated.length > 0 || comparison.deleted.length > 0) {
      logHeader('CHANGES DETECTED');
      
      if (comparison.new.length > 0) {
        colorLog('green', `New commands (${comparison.new.length}):`);
        comparison.new.forEach(cmd => colorLog('green', `  + ${cmd.name}`));
      }
      
      if (comparison.updated.length > 0) {
        colorLog('yellow', `Updated commands (${comparison.updated.length}):`);
        comparison.updated.forEach(cmd => colorLog('yellow', `  ~ ${cmd.name}`));
      }
      
      if (comparison.deleted.length > 0) {
        colorLog('red', `Deleted commands (${comparison.deleted.length}):`);
        comparison.deleted.forEach(cmd => colorLog('red', `  - ${cmd.name}`));
      }
    } else {
      logInfo('No changes detected - all commands are up to date');
      displaySummary(comparison, currentCommands);
      return;
    }
    
    // Deploy commands
    const deployedCommands = await deployCommands(rest, newCommands);
    
    // Display final summary
    displaySummary(comparison, deployedCommands);
    
    // Additional information
    logInfo('Commands may take up to 1 hour to propagate globally');
    logInfo('Use /help in Discord to see updated commands');
    
  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logError(`Uncaught Exception: ${error.message}`);
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, loadCommands, compareCommands };
