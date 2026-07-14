@echo off
REM ============================================================
REM Medicly Desktop App Launcher
REM Windows users can double-click this file to run the app
REM ============================================================

setlocal enabledelayedexpansion

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0
set APP_NAME=Medicly.exe
set APP_PATH=%SCRIPT_DIR%release\win-unpacked\%APP_NAME%

REM Check if the app exists
if not exist "%APP_PATH%" (
    echo.
    echo ERROR: %APP_NAME% not found at:
    echo %APP_PATH%
    echo.
    echo Please make sure the app has been built using:
    echo   npm run build:win
    echo.
    pause
    exit /b 1
)

REM Run the application
echo.
echo Starting Medicly Desktop Application...
echo.

start "" "%APP_PATH%"

REM If Windows Defender SmartScreen blocks the app, show instructions
timeout /t 2 /nobreak >nul

REM Check if the app started successfully by looking for the process
tasklist /FI "IMAGENAME eq %APP_NAME%" 2>nul | find /I %APP_NAME% >nul

if errorlevel 1 (
    echo.
    echo ⚠️  WINDOWS DEFENDER SMARTSCREEN WARNING
    echo.
    echo If you see a "Windows protected your PC" dialog:
    echo   1. Click "More info"
    echo   2. Click "Run anyway"
    echo.
    echo This is a normal security check for unsigned applications.
    echo Medicly is safe to run - it's your pharmacy management system.
    echo.
    pause
) else (
    echo ✓ App launched successfully!
    exit /b 0
)
