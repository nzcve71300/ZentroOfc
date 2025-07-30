@echo off
echo Setting up environment for Zentro Bot...

REM Check if .env file exists
if exist ".env" (
    echo ⚠️  .env file already exists!
    set /p overwrite="Do you want to overwrite it? (y/N): "
    if /i not "%overwrite%"=="y" (
        echo Setup cancelled.
        pause
        exit /b 0
    )
)

echo Creating .env file...

REM Create .env file with MariaDB configuration
(
echo # Discord Bot Configuration
echo DISCORD_TOKEN=your_discord_bot_token_here
echo.
echo # MariaDB Database Configuration
echo DB_HOST=localhost
echo DB_USER=zentro_user
echo DB_PASSWORD=zentro_password
echo DB_NAME=zentro_bot
echo DB_PORT=3306
echo.
echo # RCON Configuration
echo RCON_DEFAULT_PORT=28016
echo RCON_DEFAULT_PASSWORD=your_rcon_password_here
) > .env

echo ✅ .env file created successfully!
echo.
echo Please edit the .env file and update:
echo 1. DISCORD_TOKEN - Your Discord bot token
echo 2. DB_PASSWORD - Your MariaDB password (if different)
echo 3. RCON_DEFAULT_PASSWORD - Your RCON password
echo.
echo Next steps:
echo 1. Run setup-mariadb.bat to set up the database
echo 2. Run apply-mariadb-schema.bat to create tables
echo 3. Run npm install to install dependencies
echo 4. Run npm start to start the bot
pause 
pause 