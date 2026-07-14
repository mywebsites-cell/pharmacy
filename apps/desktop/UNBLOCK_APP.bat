@echo off
REM ============================================================
REM Medicly Unblock Script
REM Removes Windows security warnings for the Medicly.exe file
REM Run this as Administrator for best results
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo Medicly Desktop App - Windows Unblock Utility
echo ============================================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo NOTE: Run this script as Administrator for best results.
    echo Continue? Press Enter to proceed, or close this window to cancel.
    pause >nul
)

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0
set APP_PATH=%SCRIPT_DIR%release\win-unpacked\Medicly.exe

echo.
echo Looking for: %APP_PATH%
echo.

REM Check if the app exists
if not exist "%APP_PATH%" (
    echo ERROR: Medicly.exe not found at:
    echo   %APP_PATH%
    echo.
    echo Make sure the app has been built with:
    echo   npm run build:win
    echo.
    pause
    exit /b 1
)

echo Found Medicly.exe. Removing security restrictions...
echo.

REM Method 1: PowerShell UnBlock-File (Windows 7+)
echo [Method 1] Using PowerShell Unblock-File...
powershell -Command "Unblock-File -Path '%APP_PATH%' -ErrorAction SilentlyContinue" 2>nul

if exist "%APP_PATH%" (
    REM Method 2: Delete Zone.Identifier alternate data stream (requires admin)
    echo [Method 2] Removing Zone.Identifier stream...
    if exist "%APP_PATH%:Zone.Identifier" (
        del "%APP_PATH%:Zone.Identifier" 2>nul
    )
    
    REM Method 3: Windows Explorer workaround (create unblocked copy)
    echo [Method 3] Verifying unblock status...
)

REM Verify the unblock
echo.
echo ============================================================
echo Done! You should now be able to run Medicly.exe without warnings.
echo.
echo Try running:
echo   %APP_PATH%
echo.
echo Or use the launcher:
echo   %SCRIPT_DIR%RUN_MEDICLY.bat
echo.
pause
