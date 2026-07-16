# Medicly Desktop App - Version Management Guide

## Overview
This guide explains how to manage versions and release updates for Medicly desktop and web apps.

## Current Versions
- **Desktop App**: 1.0.6 (in `apps/desktop/package.json`)
- **Web App**: 1.0.1 (in `frontend-web/package.json`)

## Version Bump Process

### Automatic Version Bump & Release (Recommended)
The easiest way to release an update is to use the automated script:

```powershell
# Option 1: Auto-bump patch version (e.g., 1.0.6 → 1.0.7)
Set-Location "D:\webs\pharmacy app"
$env:GITHUB_TOKEN = 'your-github-token-here'
.\apps\desktop\scripts\bump-version.ps1

# Option 2: Bump to specific version
.\apps\desktop\scripts\bump-version.ps1 -NewVersion "1.1.0"
```

### What the Script Does
1. ✅ Reads current versions from both `package.json` files
2. ✅ Updates desktop app version
3. ✅ Automatically increments web app patch version
4. ✅ Rebuilds desktop app with `npm run build`
5. ✅ Creates GitHub release (v1.0.x)
6. ✅ Uploads installer (.exe) to GitHub Releases

### Manual Version Bump (If Needed)

**Step 1: Update Desktop App Version**
```json
// apps/desktop/package.json
{
  "name": "medicly-desktop",
  "version": "1.0.7"  // Change this
}
```

**Step 2: Update Web App Version**
```json
// frontend-web/package.json
{
  "name": "pharmacy-dashboard",
  "version": "1.0.2"  // Bump patch version
}
```

**Step 3: Build**
```powershell
cd "d:\webs\pharmacy app\apps\desktop"
npm run build
```

**Step 4: Create GitHub Release**
- Go to: https://github.com/mywebsites-cell/pharmacy/releases/new
- Tag: `v1.0.7`
- Title: `Release Medicly v1.0.7`
- Upload: `apps/desktop/release/Medicly Setup 1.0.7.exe`

## Release Notes Template

When creating a new release, include:

```markdown
## Changes in v1.0.7
- ✅ Bug fix: [Description]
- ✨ Feature: [Description]
- 🔧 Improvement: [Description]

## Installation
Download and run: **Medicly-setup-1.0.7.exe**
```

## Version Numbering Scheme

Medicly uses **Semantic Versioning** (MAJOR.MINOR.PATCH):

- **MAJOR** (1.x.x): Breaking changes, major features
  - Examples: 1.0 → 2.0 (new architecture, major UI redesign)

- **MINOR** (x.1.x): New features, backward compatible
  - Examples: 1.0 → 1.1 (new payment methods, new reports)

- **PATCH** (x.x.1): Bug fixes, security patches
  - Examples: 1.0 → 1.0.1 (error handling improvements, small fixes)

## Version History

| Version | Date | Key Changes |
|---------|------|------------|
| 1.0.6 | 2026-07-14 | Global error handlers, comprehensive API error handling |
| 1.0.5 | 2026-07-14 | Fixed white screen, password caret, desktop backend routing |
| 1.0.4 | Previous | Initial release |

## Troubleshooting

### Build Fails
```powershell
# Clean and rebuild
rm -r "D:\webs\pharmacy app\apps\desktop\release"
rm -r "D:\webs\pharmacy app\apps\desktop\dist-electron"
npm run build
```

### Upload Fails
- Verify GitHub token is valid: `$env:GITHUB_TOKEN`
- Check network connection
- Ensure installer file exists: `apps/desktop/release/Medicly Setup 1.0.x.exe`

### Version Already Exists on GitHub
- Delete the existing release on GitHub first
- Then run the bump script again

## Important Notes

⚠️ **Always test locally before releasing:**
1. Build the app
2. Run the portable version: `release/win-unpacked/Medicly.exe`
3. Test login and core features
4. Then release to GitHub

⚠️ **GitHub Token Security:**
- Never commit your token to the repository
- Store in environment variable: `$env:GITHUB_TOKEN = '....'`
- Use a Personal Access Token with `repo` scope only

## Next Steps

After release, users can:
1. Download from GitHub Releases page
2. Run the installer (one-click setup)
3. App auto-detects updates (electron-updater)

---

**For questions or issues, check:**
- Build logs: `apps/desktop/npm-debug.log`
- Release page: https://github.com/mywebsites-cell/pharmacy/releases
- GitHub Actions: https://github.com/mywebsites-cell/pharmacy/actions
