@echo off
echo Starting Zentro Bot (No Docker needed!)
echo.

REM Check if .env exists
if not exist .env (
    echo ❌ .env file not found!
    echo Please run setup-env.bat first
    echo.
    pause
    exit /b 1
)

REM Check if PostgreSQL service is running
sc query postgresql-x64-15 | findstr "RUNNING" >nul
if %errorlevel% neq 0 (
    sc query postgresql | findstr "RUNNING" >nul
    if %errorlevel% neq 0 (
        echo ❌ PostgreSQL service is not running!
        echo Please run setup-postgres.bat first
        echo.
        pause
        exit /b 1
    )
)

echo ✅ PostgreSQL is running

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