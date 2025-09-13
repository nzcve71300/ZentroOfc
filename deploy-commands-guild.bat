@echo off
echo 🚀 Zentro Bot - Guild Command Deployment (Testing)
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo ❌ .env file not found
    echo Please create a .env file with your Discord bot configuration
    pause
    exit /b 1
)

echo ℹ️  Deploying commands to guild for testing...
echo ℹ️  Make sure TEST_GUILD_ID is set in your .env file
echo.

REM Run the deployment script
node deploy-commands-guild.js

echo.
echo ✅ Guild command deployment completed!
echo.
pause
