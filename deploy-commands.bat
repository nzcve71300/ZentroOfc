@echo off
echo 🚀 Zentro Bot - Command Deployment
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

echo ℹ️  Deploying commands globally...
echo.

REM Run the deployment script
node deploy-commands.js

echo.
echo ✅ Command deployment completed!
echo.
pause
