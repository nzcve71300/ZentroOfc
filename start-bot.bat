@echo off
echo Starting Zentro Bot...
echo.

REM Check if .env exists
if not exist .env (
    echo ❌ .env file not found!
    echo Please run setup-env.bat first
    echo.
    pause
    exit /b 1
)

REM Check if PostgreSQL is running
docker ps | findstr "zentro_postgres" >nul
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL is not running!
    echo Please run start-postgres.bat first
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

echo.
echo ✅ Starting Zentro Bot...
echo.
npm start

pause 