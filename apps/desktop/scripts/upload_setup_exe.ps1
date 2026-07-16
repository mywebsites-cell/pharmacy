$ErrorActionPreference = 'Stop'

$repo = 'mywebsites-cell/pharmacy'
$tag = 'v1.0.5'
$filePath = 'd:\webs\pharmacy app\apps\desktop\release2\Medicly Setup 1.0.5.exe'
$assetName = 'Medicly-setup-1.0.5.exe'

$token = $env:GITHUB_TOKEN
if (-not $token) {
  Write-Host "Error: GITHUB_TOKEN env var not set"
  exit 1
}

if (-not (Test-Path $filePath)) {
  Write-Host "Error: File not found at $filePath"
  exit 1
}

$fileSize = (Get-Item $filePath).Length / 1MB
Write-Host "Uploading $assetName ($fileSize MB) to release $tag..."

# Get release ID
$releaseUrl = "https://api.github.com/repos/$repo/releases/tags/$tag"
$headers = @{
  'Authorization' = "token $token"
  'Accept' = 'application/vnd.github+json'
}

try {
  $releaseRes = Invoke-RestMethod -Uri $releaseUrl -Headers $headers
  $relId = $releaseRes.id
  Write-Host "Found release ID: $relId"
} catch {
  Write-Host "Error fetching release: $($_)"
  exit 1
}

# Delete existing asset if present
$releaseRes.assets | Where-Object { $_.name -eq $assetName } | ForEach-Object {
  Write-Host "Deleting existing asset: $($_.name)"
  $deleteUrl = "https://api.github.com/repos/$repo/releases/assets/$($_.id)"
  try {
    Invoke-RestMethod -Uri $deleteUrl -Method Delete -Headers $headers
  } catch {
    Write-Host "Warning: Could not delete existing asset: $($_)"
  }
}

# Upload new asset
$uploadUrl = "https://uploads.github.com/repos/$repo/releases/$relId/assets?name=$assetName"
$uploadHeaders = @{
  'Authorization' = "token $token"
  'Content-Type' = 'application/octet-stream'
}

try {
  $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
  Write-Host "Uploading to $uploadUrl..."
  $response = Invoke-WebRequest -Uri $uploadUrl -Method Post -Headers $uploadHeaders -Body $fileBytes
  Write-Host "Upload successful! Status: $($response.StatusCode)"
  Write-Host "Asset URL: https://github.com/$repo/releases/download/$tag/$assetName"
} catch {
  Write-Host "Upload failed: $($_)"
  exit 1
}

Write-Host "Done."
