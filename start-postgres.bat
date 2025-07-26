@echo off
echo Starting PostgreSQL with Docker...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop first.
    echo.
    pause
    exit /b 1
)

REM Start PostgreSQL container
echo Starting PostgreSQL container...
docker-compose up -d

echo.
echo PostgreSQL is starting up...
echo Waiting for database to be ready...
timeout /t 10 /nobreak >nul

REM Check if container is running
docker ps | findstr "zentro_postgres" >nul
if %errorlevel% equ 0 (
    echo.
    echo ✅ PostgreSQL is running successfully!
    echo.
    echo Database Details:
    echo - Host: localhost
    echo - Port: 5432
    echo - Database: zentro_bot
    echo - Username: zentro_user
    echo - Password: zentro_password
    echo.
    echo You can now start your bot with: npm start
    echo.
) else (
    echo.
    echo ❌ Failed to start PostgreSQL
    echo Check Docker Desktop is running
    echo.
)

pause 