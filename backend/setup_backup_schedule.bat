@echo off
REM Setup Windows Task Scheduler for Pharmacy App Daily Backup
REM Run as Administrator

setlocal enabledelayedexpansion

REM Configuration
set TASK_NAME=Pharmacy App Daily Backup
set SCRIPT_PATH=d:\webs\pharmacy app\backend\run_backup.ps1
set BACKUP_TIME=02:00:00

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERROR: This script must be run as Administrator!
    echo.
    echo Please:
    echo 1. Right-click on Command Prompt
    echo 2. Select "Run as administrator"
    echo 3. Run this script again
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Pharmacy App Backup Scheduler Setup
echo ========================================
echo.

REM Verify script exists
if not exist "%SCRIPT_PATH%" (
    echo ERROR: Script not found at %SCRIPT_PATH%
    pause
    exit /b 1
)

echo.
echo Creating scheduled task: "%TASK_NAME%"
echo Script: %SCRIPT_PATH%
echo Trigger: Daily at %BACKUP_TIME%
echo.

REM Delete existing task if it exists
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

REM Create new task
schtasks /create /tn "%TASK_NAME%" /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT_PATH%\"" /sc daily /st %BACKUP_TIME% /ru SYSTEM /f

if %errorLevel% equ 0 (
    echo.
    echo ✓ Task created successfully!
    echo.
    echo Next steps:
    echo 1. Set the DB_PASSWORD environment variable:
    echo    - Press Win+R, type: sysdm.cpl
    echo    - Go to Advanced tab
    echo    - Click "Environment Variables"
    echo    - Add: DB_PASSWORD = ^<your_postgres_password^>
    echo.
    echo 2. Test the backup manually:
    echo    cd "d:\webs\pharmacy app\backend"
    echo    .\venv\Scripts\Activate.ps1
    echo    python backup_manager.py cycle
    echo.
    echo 3. Check Task Scheduler:
    echo    - Press Win+R, type: taskschd.msc
    echo    - Find: "%TASK_NAME%"
    echo    - Verify it's enabled and scheduled for %BACKUP_TIME%
    echo.
) else (
    echo.
    echo ERROR: Failed to create scheduled task
    echo.
    pause
    exit /b 1
)

pause
exit /b 0
