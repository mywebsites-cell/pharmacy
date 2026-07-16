# Medicly v1.0.6 - Release Notes & Improvements

## 🎯 What's Fixed in v1.0.6

### 1. ✅ Global Error Handling (Main)
**Problem**: Unhandled exceptions and promise rejections could crash the app silently  
**Solution**: 
- Added global error listeners in Electron main process
- All uncaught exceptions now logged to console
- Unhandled promise rejections captured and reported

**Files Changed**:
- `apps/desktop/electron/main.ts` - Added process error handlers

### 2. ✅ Global Error Handling (Renderer)
**Problem**: React component errors caused blue screen with no error message  
**Solution**:
- Added global error and unhandled rejection listeners in renderer process
- All JavaScript errors now logged with stack traces
- All failed promises now caught and reported

**Files Changed**:
- `apps/desktop/src/main.tsx` - Added window error handlers

### 3. ✅ React Error Boundary
**Problem**: Component rendering errors not caught by default  
**Solution**:
- Implemented `AppShellErrorBoundary` React Error Boundary
- Displays user-friendly error card when dashboard fails to load
- Shows "Reload Application" button for recovery

**Files Changed**:
- `apps/desktop/src/AppShell.tsx` - Error boundary class component

### 4. ✅ Comprehensive API Error Handling
**Problem**: IPC (Inter-Process Communication) call failures returned empty Error objects  
**Solution**:
- All `desktopApi` methods wrapped with try-catch
- Each IPC call has error logging and fallback data
- Errors no longer cause silent crashes

**Files Changed**:
- `frontend-web/src/services/api.ts` - Error handling for GET/POST/PUT/DELETE

### 5. ✅ Bridge Error Handling & Logging
**Problem**: Auth store initialization errors not visible  
**Solution**:
- AppShell bridge effect has comprehensive try-catch
- All state setter calls logged with detailed messages
- Cancellation logic prevents stale updates

**Files Changed**:
- `apps/desktop/src/AppShell.tsx` - Enhanced bridge with error logging

### 6. ✅ Async Operation Safety
**Problem**: Async operations could reference unmounted components  
**Solution**:
- Added `cancelled` flag to prevent stale state updates
- Proper cleanup in useEffect dependencies
- Awaits store operations to complete

**Files Changed**:
- `apps/desktop/src/AppShell.tsx` - Async safety measures

## 📊 Version Comparison

| Issue | v1.0.5 | v1.0.6 |
|-------|--------|--------|
| Unhandled exceptions | ❌ Silent crash | ✅ Logged & displayed |
| Promise rejections | ❌ No visibility | ✅ Caught & logged |
| Component errors | ❌ Blue screen | ✅ Error boundary shows message |
| IPC failures | ❌ Empty errors | ✅ Detailed error messages |
| Async errors | ❌ Lost | ✅ Caught with context |
| User feedback | ❌ No info | ✅ Reload button |

## 🚀 Installation

Download and run:
```
Medicly-setup-1.0.6.exe
```

**System Requirements**:
- Windows 10 or later (x64)
- 500 MB free disk space
- Internet connection for initial login

## 🔄 Upgrade from v1.0.5

1. Uninstall Medicly v1.0.5
2. Download Medicly Setup 1.0.6.exe from GitHub Releases
3. Run installer
4. Log in with your account
5. Test all features (Dashboard, Inventory, Sales, etc.)

## 📝 Known Limitations

- Desktop app requires internet for initial login only
- Local SQLite database syncs with cloud backend (read-only mode available)
- ffmpeg.dll bundled for media support

## 🆘 Troubleshooting

### If App Still Shows Blue Screen
1. **Check Console Logs** (F12 in app)
   - Look for error messages after login
   - Report exact error to developer

2. **Try Uninstall + Reinstall**
   ```powershell
   # Delete app data
   rm -r "$env:APPDATA\Medicly"
   ```

3. **Check Network Connection**
   - Ensure internet is stable
   - Try opening medicly.org in browser

### If Installer Doesn't Run
- Update Windows Installer: `msiexec /i msi_update.exe`
- Run as Administrator
- Check system requirements (Windows 10+)

## 📞 Support

- Report issues: https://github.com/mywebsites-cell/pharmacy/issues
- Check logs: `%APPDATA%\Medicly\logs\` (if available)
- Contact: [support email]

## 🔐 Security Notes

- All passwords encrypted during transmission (HTTPS)
- Token stored securely in browser localStorage
- No sensitive data stored in local SQLite
- Install only from official GitHub Releases

---

**Version**: 1.0.6  
**Release Date**: July 14, 2026  
**Build**: Electron 29.4.6, React 18.2.0  
**Status**: Stable ✅
