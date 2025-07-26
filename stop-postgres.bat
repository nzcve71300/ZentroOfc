@echo off
echo Stopping PostgreSQL...
echo.

REM Stop PostgreSQL container
docker-compose down

echo.
echo ✅ PostgreSQL stopped successfully!
echo.
pause 