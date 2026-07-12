@echo off
title PharmacyPro Launcher
color 0B

echo.
echo  ============================================
echo   PharmacyPro - Starting All Services
echo  ============================================
echo.

:: ── Step 1: Compile Desktop TypeScript (required before Electron starts) ──
echo  [1/4] Compiling Desktop TypeScript...
cd /d "%~dp0apps\desktop"
call npx tsc -p tsconfig-electron.json
if %errorlevel% neq 0 (
  echo  [ERROR] TypeScript compilation failed! Check the desktop source for errors.
  pause
  exit /b 1
)
echo  [1/4] TypeScript compiled OK.
echo.

:: ── Step 2: Start Mock Backend (port 8000) ──
echo  [2/4] Starting Mock Backend on port 8000...
start "PharmacyPro - Backend API" cmd /k "cd /d ""%~dp0backend"" && node mock-server.js"
timeout /t 2 /nobreak >nul

:: ── Step 3: Start Web App (port 3000) ──
echo  [3/4] Starting Web App on port 3000...
start "PharmacyPro - Web App" cmd /k "cd /d ""%~dp0frontend-web"" && npx vite --port 3000 --strictPort"
timeout /t 2 /nobreak >nul

:: ── Step 4: Start Desktop App (Vite on 5173 + Electron) ──
echo  [4/4] Starting Desktop App (Vite + Electron)...
start "PharmacyPro - Desktop" cmd /k "cd /d ""%~dp0apps\desktop"" && npm run dev"

echo.
echo  ============================================
echo   All services launched!
echo.
echo   Web App    ->  http://localhost:3000
echo              ->  Login: admin / admin123
echo.
echo   Backend    ->  http://localhost:8000
echo.
echo   Desktop    ->  Electron window opens shortly
echo  ============================================
echo.
echo  Close this window at any time.
echo  To stop: close each service window individually.
echo.
pause
