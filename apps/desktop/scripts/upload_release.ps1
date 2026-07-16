$ErrorActionPreference = 'Stop'

$repo = 'mywebsites-cell/pharmacy'
$token = $env:GITHUB_TOKEN

if (-not $token) {
  Write-Host "No GITHUB_TOKEN set. Please set it before running this script."
  exit 1
}

$exePath = 'd:\webs\pharmacy app\apps\desktop\release\win-unpacked\Medicly.exe'
if (-not (Test-Path $exePath)) {
  Write-Error "Medicly.exe not found at $exePath"
  exit 1
}

$exeSize = (Get-Item $exePath).Length
Write-Host "Medicly.exe size: $($exeSize / 1MB)MB"

$api = "https://api.github.com/repos/$repo/releases"
$headers = @{
  'Authorization' = "token $token"
  'Content-Type'  = 'application/json'
}

# Check if v1.0.5 exists
$existing = $null
try {
  $existing = Invoke-RestMethod -Uri "$api/tags/v1.0.5" -Headers $headers -ErrorAction SilentlyContinue
} catch {
  Write-Host "v1.0.5 does not exist yet"
}

if ($existing) {
  Write-Host "v1.0.5 already exists (ID: $($existing.id))"
  $relId = $existing.id
  $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$relId/assets"
} else {
  Write-Host "Creating v1.0.5 release..."
  $createBody = @{
    tag_name    = 'v1.0.5'
    name        = 'v1.0.5 - Desktop App with FFmpeg Support'
    body        = 'Windows Desktop App with ffmpeg.dll bundled for video/media support and password input fix'
    draft       = $false
    prerelease  = $false
  } | ConvertTo-Json

  $newRel = Invoke-RestMethod -Uri $api -Method Post -Headers $headers -Body $createBody
  $relId = $newRel.id
  $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$relId/assets"
  Write-Host "Created release v1.0.5 (ID: $relId)"
}

# Upload exe
Write-Host "Uploading Medicly-1.0.5.exe..."
$assetUrl = "$uploadUrl`?name=Medicly-1.0.5.exe"
$exeBytes = [System.IO.File]::ReadAllBytes($exePath)

$uploadHeaders = @{
  'Authorization' = "token $token"
  'Content-Type'  = 'application/octet-stream'
}

try {
  $upload = Invoke-WebRequest -Uri $assetUrl -Method Post -Headers $uploadHeaders -Body $exeBytes
  Write-Host "Upload complete! Status: $($upload.StatusCode)"
} catch {
  Write-Host "Upload error: $($_)"
  if ($_.Exception.Response.StatusCode -eq 'Conflict') {
    Write-Host "Asset already exists. Try updating release manually or use a different version."
  }
}
