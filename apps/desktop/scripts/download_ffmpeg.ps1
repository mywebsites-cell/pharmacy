$ErrorActionPreference = 'Stop'
$repo = 'iteufel/nwjs-ffmpeg-prebuilt'
$api = "https://api.github.com/repos/$repo/releases/latest"
Write-Host "Fetching latest release metadata..."
$rel = Invoke-RestMethod -Uri $api -UseBasicParsing
$asset = $rel.assets | Where-Object { $_.name -match 'win' -and $_.name -match 'x64' } | Select-Object -First 1
if (-not $asset) { $asset = $rel.assets | Select-Object -First 1 }
$download = $asset.browser_download_url
Write-Host "Found asset: $($asset.name)"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$extraDir = Join-Path $scriptRoot "..\extra" | Resolve-Path -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }
if (-not $extraDir) { $extraDir = Join-Path $scriptRoot "..\extra" }
New-Item -ItemType Directory -Force -Path $extraDir | Out-Null
$destZip = Join-Path $extraDir 'ffmpeg_asset.zip'
Write-Host "Downloading $download to $destZip"
Invoke-WebRequest -Uri $download -OutFile $destZip
Write-Host "Extracting..."
Expand-Archive -Path $destZip -DestinationPath $extraDir -Force
# Find ffmpeg.dll
$found = Get-ChildItem -Path $extraDir -Recurse -Filter 'ffmpeg.dll' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($found) {
  Copy-Item $found.FullName -Destination (Join-Path $extraDir 'ffmpeg.dll') -Force
  Write-Host "ffmpeg.dll extracted to" (Join-Path $extraDir 'ffmpeg.dll')
} else {
  Write-Host 'No ffmpeg.dll found directly; searching for libffmpeg*.dll'
  $found2 = Get-ChildItem -Path $extraDir -Recurse -Include 'libffmpeg*.dll' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found2) {
    Copy-Item $found2.FullName -Destination (Join-Path $extraDir 'ffmpeg.dll') -Force
    Write-Host "Copied" $found2.Name "as ffmpeg.dll"
  } else {
    Write-Error 'No DLL found in archive.'
    exit 2
  }
}
Remove-Item $destZip -Force
# Git add and commit (repo root assumed at two levels up)
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..\..\")
Set-Location $repoRoot
git add 'apps/desktop/extra/ffmpeg.dll' 2>$null
try { git commit -m 'chore(desktop): add ffmpeg.dll (prebuilt) for bundled playback support' } catch { Write-Host 'Nothing to commit or commit failed' }
try { git push origin main } catch { Write-Host 'Push failed' }
Write-Host 'Done.'
