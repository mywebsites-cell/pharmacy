@echo off
REM Upload Medicly.exe to GitHub Release v1.0.4

setlocal enabledelayedexpansion

set TOKEN=YOUR_GITHUB_TOKEN_HERE
set OWNER=mywebsites-cell
set REPO=pharmacy
set TAG=v1.0.4
set EXE_PATH=d:\webs\pharmacy app\apps\desktop\release\win-unpacked\Medicly.exe
set ASSET_NAME=Medicly-1.0.4.exe

echo.
echo Uploading %ASSET_NAME% to GitHub Release...
echo.

REM Get file size
for %%F in ("%EXE_PATH%") do set SIZE=%%~zF
set /a SIZE_MB=SIZE / 1048576
echo File: %ASSET_NAME% (%SIZE_MB% MB)
echo.

REM Upload using curl
curl -v --upload-file "%EXE_PATH%" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/octet-stream" ^
  "https://uploads.github.com/repos/%OWNER%/%REPO%/releases/tags/%TAG%?name=%ASSET_NAME%"

echo.
echo Upload complete!
echo Release URL: https://github.com/%OWNER%/%REPO%/releases/tag/%TAG%
