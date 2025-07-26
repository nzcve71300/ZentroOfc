@echo off
echo Setting up environment file...
echo.

REM Check if .env already exists
if exist .env (
    echo .env file already exists!
    set /p overwrite=Do you want to overwrite it? (y/n): 
    if /i not "%overwrite%"=="y" (
        echo Setup cancelled.
        pause
        exit /b 0
    )
)

echo Creating .env file...

REM Create .env file with multi-tenant configuration
(
echo # Discord Bot Configuration
echo DISCORD_TOKEN=your-discord-bot-token-here
echo CLIENT_ID=your-discord-client-id-here
echo.
echo # Database Configuration ^(Local PostgreSQL^)
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=zentro_bot
echo DB_USER=zentro_user
echo DB_PASSWORD=zentro_password
echo.
echo # Bot Configuration
echo PREFIX=!
echo OWNER_ID=your-discord-user-id-here
) > .env

echo.
echo ✅ .env file created successfully!
echo.
echo ⚠️  IMPORTANT: Edit .env file and replace:
echo    - your-discord-bot-token-here with your actual Discord bot token
echo    - your-discord-client-id-here with your Discord application client ID
echo    - your-discord-user-id-here with your Discord user ID
echo.
echo You can get your Discord bot token from:
echo https://discord.com/developers/applications
echo.
echo Note: RCON settings are configured per server, not globally.
echo.
pause 