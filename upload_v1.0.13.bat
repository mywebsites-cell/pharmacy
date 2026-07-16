@echo off
cd /d "d:\webs\pharmacy app"

REM Check if release files exist
echo === Checking Release Files ===
dir apps\desktop\release\*.exe 2>nul && echo ✓ Installer found
dir apps\desktop\release\latest.yml 2>nul && echo ✓ latest.yml found  
dir apps\desktop\release\*.blockmap 2>nul && echo ✓ blockmap found

REM Display build artifacts
echo.
echo === Build Artifacts ===
for %%F in (apps\desktop\release\Medicly*.exe apps\desktop\release\latest.yml apps\desktop\release\*.blockmap) do (
  echo File: %%F
)

REM Run Python upload script
echo.
echo === Starting Upload to GitHub ===
python upload_release.py

echo.
echo === Upload Complete ===
pause
