@echo off
echo Setting up PostgreSQL database...
echo.

REM Check if PostgreSQL is installed
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL is not installed!
    echo Please run install-postgres.bat first
    echo.
    pause
    exit /b 1
)

echo ✅ PostgreSQL is installed
echo.

REM Start PostgreSQL service
echo Starting PostgreSQL service...
net start postgresql-x64-15 >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting PostgreSQL service (alternative method)...
    net start postgresql >nul 2>&1
)

echo.
echo Creating database and user...
echo.

REM Create database and user using psql
psql -U postgres -c "CREATE DATABASE zentro_bot;" 2>nul
if %errorlevel% neq 0 (
    echo Database already exists or error occurred
)

psql -U postgres -c "CREATE USER zentro_user WITH PASSWORD 'zentro_password';" 2>nul
if %errorlevel% neq 0 (
    echo User already exists or error occurred
)

psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE zentro_bot TO zentro_user;" 2>nul

echo.
echo Setting up database schema...
psql -U zentro_user -d zentro_bot -f schema.sql

echo.
echo ✅ PostgreSQL setup complete!
echo.
echo Database Details:
echo - Host: localhost
echo - Port: 5432
echo - Database: zentro_bot
echo - Username: zentro_user
echo - Password: zentro_password
echo.
echo You can now run setup-env.bat and start-bot.bat
echo.
pause 