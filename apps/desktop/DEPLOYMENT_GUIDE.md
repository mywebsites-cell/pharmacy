# Medicly Desktop App - Deployment Guide

## Quick Start for End Users

### Windows Installation & Running

#### 1. **First-Time Setup**
- Download `Medicly.exe` from your pharmacy's website
- Save it to any folder (e.g., `C:\Users\YourName\Downloads\`)
- **Do NOT run it yet** - see SmartScreen handling below

#### 2. **Handle Windows Defender SmartScreen**

When you first try to run `Medicly.exe`, Windows will likely show:
```
"Windows protected your PC"
"Microsoft Defender SmartScreen prevented an unrecognized app from starting"
```

**This is normal** - Medicly is unsigned (code signing requires a paid certificate).

**To proceed:**
1. Click **"More info"** on the warning dialog
2. Click **"Run anyway"** button
3. The app will start

**OR use the launcher:**
- Instead of clicking the .exe directly, use **`RUN_MEDICLY.bat`** (batch launcher)
- The batch file handles the same launch process
- You can create a desktop shortcut to `RUN_MEDICLY.bat` for easier access

#### 3. **First Login**

When Medicly launches:
1. Enter your pharmacy email and password
2. App will verify your subscription with the cloud server
3. Desktop app will sync data and load your inventory

#### 4. **Troubleshooting Login Issues**

If you see "Cannot connect to server":
- **Check internet connection** - Desktop app needs to reach `pharmacy-django-fj01.onrender.com`
- **Wait 30 seconds** - First startup syncs with cloud, may take time
- **Restart the app** - Sometimes the connection needs to be re-established
- **Check your subscription** - Ensure your pharmacy has an active subscription on the web portal

If you see "Your plan does not include desktop access":
- Your pharmacy's subscription plan doesn't have desktop app enabled
- Contact your pharmacy administrator or upgrade your subscription on the web app

#### 5. **Desktop App Features**

Once logged in, you have:
- ✓ Full POS (Point of Sale) system
- ✓ Inventory management (sync with cloud)
- ✓ Sales & reports
- ✓ Customer management
- ✓ Works offline - syncs when online
- ✓ Local SQLite database (fast, encrypted)

---

## For System Administrators / Deployers

### Hosting the Executable

The `Medicly.exe` file (161MB) is unsigned. To distribute to end users:

**Option 1: Host on GitHub Releases** (Recommended)
```bash
# Create release at:
https://github.com/YOUR_ORG/pharmacy/releases

# Upload Medicly.exe as an asset
# Link in your download page:
https://github.com/YOUR_ORG/pharmacy/releases/download/v1.0.1/Medicly.exe
```

**Option 2: Host on Your Website**
```
/downloads/Medicly.exe
```

**Option 3: Code Signing** (Optional, for enterprise)
- Buy a code signing certificate (Sectigo, DigiCert, etc. - ~$200-500/year)
- Sign the exe with:
  ```bash
  signtool sign /f certificate.pfx /p password /t http://timestamp.server.com Medicly.exe
  ```
- Users won't see SmartScreen warning if properly signed

### Architecture

- **Medicly.exe**: Standalone Electron app with bundled React frontend
- **Backend**: Connects to `https://pharmacy-django-fj01.onrender.com` (cloud)
- **Database**: Uses local SQLite for offline capability + cloud sync
- **No Local Server Required**: Everything runs in "Cloud-First Mode"

### Updates

The app has auto-updater built in. To push updates:

1. Build new version:
   ```bash
   npm run build:win
   ```

2. Create GitHub Release with new exe:
   ```bash
   gh release create v1.0.2 apps/desktop/release/win-unpacked/Medicly.exe
   ```

3. Users will see "Update Available" on next app launch and can auto-install

---

## Security Notes

- **Unsigned Code**: The exe is not code-signed, so Windows may flag it as unknown. This is safe - it's your app.
- **SmartScreen**: This is a Windows security feature, not a virus or malware detection.
- **SSL Certificate**: All backend communication is encrypted (HTTPS to pharmacy-django-fj01.onrender.com).
- **Local Storage**: Sensitive data is encrypted in local SQLite database.

---

## Contact & Support

For technical issues:
- Check subscription status on web app: `https://pharmacy-blond-six.vercel.app`
- Verify backend at: `https://pharmacy-django-fj01.onrender.com/api/v1/health/`
- Contact your pharmacy administrator or system support

