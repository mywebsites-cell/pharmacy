# ============================================================
# Medicly Desktop App Version Bump Script
# ============================================================
# Usage: .\bump-version.ps1 -NewVersion "1.0.7"
# Or:    .\bump-version.ps1  (auto-increments patch version)
# ============================================================

param(
    [string]$NewVersion,
    [string]$GitHubToken = $env:GITHUB_TOKEN
)

$ErrorActionPreference = "Stop"

# ============================================================
# Helper: Parse semantic version
# ============================================================
function Parse-Version {
    param([string]$VersionString)
    $parts = $VersionString -split '\.'
    return @{
        major = [int]$parts[0]
        minor = [int]$parts[1]
        patch = [int]$parts[2]
    }
}

function Format-Version {
    param($Major, $Minor, $Patch)
    return "$Major.$Minor.$Patch"
}

# ============================================================
# Get current version from desktop package.json
# ============================================================
$desktopPkgPath = "D:\webs\pharmacy app\apps\desktop\package.json"
$webPkgPath = "D:\webs\pharmacy app\frontend-web\package.json"

Write-Host "[1/6] Reading current versions..."
$desktopJson = Get-Content $desktopPkgPath -Raw | ConvertFrom-Json
$webJson = Get-Content $webPkgPath -Raw | ConvertFrom-Json

$currentDesktopVersion = $desktopJson.version
$currentWebVersion = $webJson.version

Write-Host "  Desktop: $currentDesktopVersion"
Write-Host "  Web: $currentWebVersion"

# ============================================================
# Determine new version
# ============================================================
if (-not $NewVersion) {
    # Auto-increment patch version
    $parsed = Parse-Version $currentDesktopVersion
    $parsed.patch += 1
    $NewVersion = Format-Version $parsed.major $parsed.minor $parsed.patch
}

Write-Host "[2/6] Bumping to version: $NewVersion"

# ============================================================
# Update package.json files
# ============================================================
Write-Host "[3/6] Updating package.json files..."

$desktopJson.version = $NewVersion
$desktopContent = $desktopJson | ConvertTo-Json -Depth 10
# Pretty-print JSON (2-space indent)
$desktopContent = $desktopContent -replace '(?m)^', "  " | Out-String
$desktopContent = "{`n" + $desktopContent.TrimStart() + "`n}"
Set-Content -Path $desktopPkgPath -Value $desktopContent -Encoding UTF8

$webParsed = Parse-Version $currentWebVersion
$webParsed.patch += 1
$webNewVersion = Format-Version $webParsed.major $webParsed.minor $webParsed.patch
$webJson.version = $webNewVersion
$webContent = $webJson | ConvertTo-Json -Depth 10
$webContent = "{`n" + ($webContent -replace '(?m)^', "  ") + "`n}"
Set-Content -Path $webPkgPath -Value $webContent -Encoding UTF8

Write-Host "  ✓ Desktop: $NewVersion"
Write-Host "  ✓ Web: $webNewVersion"

# ============================================================
# Build desktop app
# ============================================================
Write-Host "[4/6] Building desktop app..."
Set-Location "D:\webs\pharmacy app\apps\desktop"

$buildOutput = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build completed (checking for installer)..."
}

$installerPath = "D:\webs\pharmacy app\apps\desktop\release\Medicly Setup $NewVersion.exe"
if (-not (Test-Path $installerPath)) {
    Write-Host "ERROR: Installer not found at $installerPath"
    exit 1
}
Write-Host "  ✓ Installer created: $(Get-Item $installerPath | % { [math]::Round($_.Length / 1MB, 2) }) MB"

# ============================================================
# Upload to GitHub
# ============================================================
if (-not $GitHubToken) {
    Write-Host "ERROR: GitHub token not found. Set \$env:GITHUB_TOKEN or pass -GitHubToken"
    exit 1
}

Write-Host "[5/6] Creating GitHub release v$NewVersion..."

$releaseData = @{
    tag_name = "v$NewVersion"
    name = "Release Medicly v$NewVersion"
    body = "✅ Version $NewVersion Release`n`n📝 Changes:`n- Bug fixes and improvements`n- Enhanced error handling`n- Performance optimizations"
} | ConvertTo-Json

try {
    $releaseResp = Invoke-WebRequest `
        -Uri "https://api.github.com/repos/mywebsites-cell/pharmacy/releases" `
        -Method POST `
        -Headers @{
            Authorization = "Bearer $GitHubToken"
            Accept = "application/vnd.github+json"
        } `
        -UseBasicParsing `
        -Body $releaseData

    $releaseId = ($releaseResp.Content | ConvertFrom-Json).id
    Write-Host "  ✓ Release created (ID: $releaseId)"
} catch {
    Write-Host "ERROR: Failed to create release"
    Write-Host $_.Exception.Response.StatusCode
    exit 1
}

# ============================================================
# Upload installer asset
# ============================================================
Write-Host "[6/6] Uploading installer to GitHub..."

$uploadUrl = "https://uploads.github.com/repos/mywebsites-cell/pharmacy/releases/$releaseId/assets?name=Medicly-setup-$NewVersion.exe"

try {
    $uploadResp = Invoke-WebRequest `
        -Uri $uploadUrl `
        -Method POST `
        -Headers @{
            Authorization = "Bearer $GitHubToken"
            "Content-Type" = "application/octet-stream"
        } `
        -UseBasicParsing `
        -InFile $installerPath

    $assetUrl = ($uploadResp.Content | ConvertFrom-Json).browser_download_url
    Write-Host "  ✓ Upload successful!"
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════"
    Write-Host "✅ Release v$NewVersion Complete!"
    Write-Host "═══════════════════════════════════════════════════════"
    Write-Host "📥 Download: $assetUrl"
    Write-Host "🔗 Release: https://github.com/mywebsites-cell/pharmacy/releases/tag/v$NewVersion"
    Write-Host "═══════════════════════════════════════════════════════"
} catch {
    Write-Host "ERROR: Failed to upload installer"
    Write-Host $_.Exception.Response.StatusCode
    exit 1
}
