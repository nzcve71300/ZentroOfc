@echo off
echo Setting up PostgreSQL (Manual Installation)
echo.

echo This script will help you set up PostgreSQL after manual installation.
echo.
echo Make sure you have:
echo 1. Downloaded PostgreSQL from https://www.postgresql.org/download/windows/
echo 2. Installed it with default settings
echo 3. Remembered the password you set for 'postgres' user
echo.

set /p postgres_password=Enter the password you set for 'postgres' user: 

echo.
echo Creating database and user...

REM Try to connect and create database
psql -U postgres -c "CREATE DATABASE zentro_bot;" -W
if %errorlevel% neq 0 (
    echo Database already exists or error occurred
)

psql -U postgres -c "CREATE USER zentro_user WITH PASSWORD 'zentro_password';" -W
if %errorlevel% neq 0 (
    echo User already exists or error occurred
)

psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE zentro_bot TO zentro_user;" -W

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
echo You can now run setup-env.bat and start-bot-simple.bat
echo.
pause 