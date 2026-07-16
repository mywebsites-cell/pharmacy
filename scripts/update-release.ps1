$token = 'YOUR_GITHUB_TOKEN_HERE'
$owner = 'mywebsites-cell'
$repo = 'pharmacy'
$tagName = 'v1.0.4'

Write-Host "Fetching existing release: $tagName..." -ForegroundColor Cyan

$getUrl = "https://api.github.com/repos/$owner/$repo/releases/tags/$tagName"
$releaseResponse = Invoke-RestMethod -Uri $getUrl -Method GET `
  -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

Write-Host "[OK] Found release ID: $($releaseResponse.id)" -ForegroundColor Green

$releaseId = $releaseResponse.id

Write-Host ''
Write-Host 'Uploading Medicly.exe asset...' -ForegroundColor Cyan
$exePath = 'd:\webs\pharmacy app\apps\desktop\release\win-unpacked\Medicly.exe'
$assetName = 'Medicly-1.0.4.exe'
$fileSize = (Get-Item $exePath).Length / 1MB

Write-Host "  File: $assetName (Size: $([Math]::Round($fileSize, 1))MB)" -ForegroundColor Gray

$uploadUrl = "https://uploads.github.com/repos/$owner/$repo/releases/$releaseId/assets?name=$assetName"
$fileBytes = [IO.File]::ReadAllBytes($exePath)

$uploadResponse = Invoke-RestMethod -Uri $uploadUrl -Method POST `
  -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/octet-stream' } `
  -Body $fileBytes

Write-Host '[OK] Asset uploaded successfully' -ForegroundColor Green
Write-Host "  Download URL: $($uploadResponse.browser_download_url)" -ForegroundColor Gray

Write-Host ''
Write-Host "[OK] Release updated at: https://github.com/$owner/$repo/releases/tag/$tagName" -ForegroundColor Green
