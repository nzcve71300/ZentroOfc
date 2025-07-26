@echo off
echo Installing PostgreSQL (No Docker needed!)
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ This script needs to run as Administrator!
    echo.
    echo Right-click on this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo ✅ Running as Administrator
echo.

REM Check if Chocolatey is installed
choco --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Chocolatey...
    powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    echo.
)

echo Installing PostgreSQL...
choco install postgresql -y

echo.
echo ✅ PostgreSQL installed successfully!
echo.
echo Now you need to:
echo 1. Restart your computer
echo 2. Run setup-postgres.bat after restart
echo.
pause 