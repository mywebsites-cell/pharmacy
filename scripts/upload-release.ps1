$token = 'YOUR_GITHUB_TOKEN_HERE'
$owner = 'mywebsites-cell'
$repo = 'pharmacy'
$tagName = 'v1.0.4'
$releaseName = 'Medicly v1.0.4'
$releaseBody = @"
Medicly Desktop v1.0.4 - Portable Windows EXE

## Features
- Cloud-connected (no local server needed)
- Full POS, Inventory, Reports
- Works offline with local SQLite
- Auto-updates on new releases

## Installation
1. Download Medicly.exe
2. If Windows SmartScreen appears: Click More Info > Run Anyway
3. Login with your pharmacy credentials
4. App syncs with cloud automatically

## Requirements
- Windows 10 or later
- Active Medicly subscription with desktop access
"@

Write-Host 'Creating GitHub Release v1.0.4...' -ForegroundColor Cyan
$createUrl = "https://api.github.com/repos/$owner/$repo/releases"
$createBody = @{
    tag_name = $tagName
    name = $releaseName
    body = $releaseBody
    draft = $false
    prerelease = $false
} | ConvertTo-Json

$createResponse = Invoke-RestMethod -Uri $createUrl -Method POST `
  -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' } `
  -Body $createBody

Write-Host "[DONE] Release created: $($createResponse.html_url)" -ForegroundColor Green
Write-Host "  Release ID: $($createResponse.id)" -ForegroundColor Gray

$releaseId = $createResponse.id
$uploadUrl = $createResponse.upload_url -replace '\{.*\}', ''

# Upload asset
Write-Host '' 
Write-Host 'Uploading Medicly.exe...' -ForegroundColor Cyan
$exePath = 'd:\webs\pharmacy app\apps\desktop\release\win-unpacked\Medicly.exe'
$assetName = 'Medicly-1.0.4.exe'
$fileSize = (Get-Item $exePath).Length / 1MB

Write-Host "  File: $assetName (Size: $([Math]::Round($fileSize, 1))MB)" -ForegroundColor Gray

$uploadUri = "$uploadUrl`?name=$assetName"
$fileBytes = [IO.File]::ReadAllBytes($exePath)

$uploadResponse = Invoke-RestMethod -Uri $uploadUri -Method POST `
  -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/octet-stream' } `
  -Body $fileBytes

Write-Host '[DONE] Asset uploaded successfully' -ForegroundColor Green
Write-Host "  Download URL: $($uploadResponse.browser_download_url)" -ForegroundColor Gray

Write-Host ''
Write-Host "[DONE] Release ready at: https://github.com/$owner/$repo/releases/tag/$tagName" -ForegroundColor Green
