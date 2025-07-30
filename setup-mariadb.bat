@echo off
echo Setting up MariaDB database for Zentro Bot...

REM Check if MariaDB is installed
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ MariaDB is not installed!
    echo Please install MariaDB first:
    echo 1. Download from https://mariadb.org/download/
    echo 2. Or use XAMPP which includes MariaDB
    echo 3. Or use Docker: docker run --name zentro_mariadb -e MYSQL_ROOT_PASSWORD=admin -e MYSQL_DATABASE=zentro_bot -p 3306:3306 -d mariadb:latest
    pause
    exit /b 1
)

echo ✅ MariaDB is installed

REM Start MariaDB service
echo Starting MariaDB service...
net start mysql >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting MariaDB service (alternative method)...
    net start mariadb >nul 2>&1
)

REM Wait a moment for service to start
timeout /t 3 /nobreak >nul

REM Create database and user
echo Creating database and user...
mysql -u root -padmin -e "CREATE DATABASE IF NOT EXISTS zentro_bot;" 2>nul
if %errorlevel% neq 0 (
    echo Trying without password...
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS zentro_bot;" 2>nul
)

mysql -u root -padmin -e "CREATE USER IF NOT EXISTS 'zentro_user'@'localhost' IDENTIFIED BY 'zentro_password';" 2>nul
if %errorlevel% neq 0 (
    echo Trying without password...
    mysql -u root -e "CREATE USER IF NOT EXISTS 'zentro_user'@'localhost' IDENTIFIED BY 'zentro_password';" 2>nul
)

mysql -u root -padmin -e "GRANT ALL PRIVILEGES ON zentro_bot.* TO 'zentro_user'@'localhost';" 2>nul
if %errorlevel% neq 0 (
    echo Trying without password...
    mysql -u root -e "GRANT ALL PRIVILEGES ON zentro_bot.* TO 'zentro_user'@'localhost';" 2>nul
)

mysql -u root -padmin -e "FLUSH PRIVILEGES;" 2>nul
if %errorlevel% neq 0 (
    echo Trying without password...
    mysql -u root -e "FLUSH PRIVILEGES;" 2>nul
)

echo ✅ MariaDB setup complete!
echo.
echo Next steps:
echo 1. Run mysql_schema.sql to create tables
echo 2. Update your .env file with MariaDB credentials
echo 3. Run the bot with: npm start
pause 