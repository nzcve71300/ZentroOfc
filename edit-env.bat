@echo off
echo Editing .env file...
echo.

REM Check if .env exists
if not exist .env (
    echo ❌ .env file not found!
    echo Please run setup-env.bat first
    echo.
    pause
    exit /b 1
)

echo Current .env contents:
echo.
type .env
echo.

echo.
echo ⚠️  IMPORTANT: You need to edit the .env file!
echo.
echo 1. Open .env in your text editor
echo 2. Replace 'your-discord-bot-token-here' with your actual Discord bot token
echo 3. Replace 'your-discord-client-id-here' with your Discord application client ID
echo 4. Replace 'your-discord-user-id-here' with your Discord user ID
echo.
echo Note: RCON settings are configured per server using Discord commands,
echo not globally in the .env file.
echo.

set /p choice=Do you want to open .env in Notepad? (y/n): 
if /i "%choice%"=="y" (
    notepad .env
)

echo.
echo After editing .env, you can run start-bot-simple.bat to start your bot!
echo.
pause 