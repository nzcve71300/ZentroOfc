@echo off
echo Applying MariaDB schema to zentro_bot database...

REM Check if schema file exists
if not exist "mysql_schema.sql" (
    echo ❌ mysql_schema.sql not found!
    echo Please ensure the schema file is in the current directory.
    pause
    exit /b 1
)

REM Apply schema
echo Applying schema...
mysql -u zentro_user -pzentro_password zentro_bot < mysql_schema.sql
if %errorlevel% neq 0 (
    echo Trying with root user...
    mysql -u root -padmin zentro_bot < mysql_schema.sql
    if %errorlevel% neq 0 (
        echo Trying without password...
        mysql -u root zentro_bot < mysql_schema.sql
    )
)

if %errorlevel% equ 0 (
    echo ✅ Schema applied successfully!
    echo.
    echo Database tables created:
    echo - guilds
    echo - rust_servers
    echo - players
    echo - economy
    echo - transactions
    echo - shop_categories
    echo - shop_items
    echo - shop_kits
    echo - autokits
    echo - kit_auth
    echo - killfeed_configs
    echo - player_stats
    echo - channel_settings
    echo - position_coordinates
    echo - zones
    echo - link_requests
    echo - link_blocks
    echo - event_configs
    echo.
    echo Your Zentro Bot database is ready!
) else (
    echo ❌ Failed to apply schema
    echo Please check your MariaDB installation and credentials
)

pause 