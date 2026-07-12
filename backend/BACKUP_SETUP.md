# Backup Automation Setup Guide

## Overview
This guide explains how to set up automated PostgreSQL backups for the Pharmacy App database.

## Files
- **backup_manager.py**: Main backup/restore utility
- **run_backup.ps1**: PowerShell wrapper for scheduled execution
- **setup_backup_schedule.bat**: Windows Task Scheduler setup script

## Installation & Configuration

### Step 1: Set Environment Variables
Set the database password so the backup manager can authenticate:

```powershell
# In PowerShell (Admin)
[Environment]::SetEnvironmentVariable("DB_PASSWORD", "your_postgres_password", "User")
```

Or use System properties → Environment Variables to add:
- Variable: `DB_PASSWORD`
- Value: `your_postgres_password`

### Step 2: Verify Backup Manager
Test the backup manager manually first:

```powershell
cd "d:\webs\pharmacy app\backend"
.\venv\Scripts\Activate.ps1
python backup_manager.py cycle
```

Expected output:
```
[2026-05-18 14:30:00] Starting backup of pharmacy_db...
[2026-05-18 14:30:15] ✅ Backup completed: backup_pharmacy_db_20260518_143015.sql.gz (245.32 MB)
[2026-05-18 14:30:16] ✅ No old backups to delete
```

### Step 3: Create Scheduled Task

**Option A: Manual Setup (GUI)**

1. Open **Task Scheduler** (Press Win+R, type `taskschd.msc`, Enter)
2. Click **Create Basic Task** on the right
3. **General Tab:**
   - Name: `Pharmacy App Daily Backup`
   - Description: `Automated database backup at 2 AM daily`
   - ☑ Run whether user is logged in or not
   - ☑ Run with highest privileges

4. **Trigger Tab:**
   - New Trigger → Daily
   - Start: `2:00 AM` (or your preferred time)
   - ☑ Enabled

5. **Action Tab:**
   - Program: `powershell.exe`
   - Arguments: `-NoProfile -ExecutionPolicy Bypass -File "d:\webs\pharmacy app\backend\run_backup.ps1"`

6. Click Finish

**Option B: PowerShell Setup (Recommended)**

Run as Administrator:

```powershell
# Define task parameters
$taskName = "Pharmacy App Daily Backup"
$scriptPath = "d:\webs\pharmacy app\backend\run_backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File '$scriptPath'"
$settings = New-ScheduledTaskSettingsSet -RunOnlyIfNetworkAvailable `
  -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Create the task
Register-ScheduledTask -TaskName $taskName `
  -Trigger $trigger `
  -Action $action `
  -Settings $settings `
  -RunLevel Highest `
  -Force

Write-Host "Task '$taskName' created successfully" -ForegroundColor Green
```

**Option C: Batch File Setup**

Run `setup_backup_schedule.bat` as Administrator (will create the task).

### Step 4: Monitor Backups

**View backup log:**
```powershell
Get-Content "d:\webs\pharmacy app\backend\backups\backup.log" -Tail 20
```

**List available backups:**
```powershell
python backup_manager.py list
```

**Manual backup (anytime):**
```powershell
python backup_manager.py backup
```

## Restore Procedures

### Quick Restore
```powershell
python backup_manager.py restore --backup-file "d:\webs\pharmacy app\backend\backups\backup_pharmacy_db_20260518_143015.sql.gz"
```

### Full Restore with Verification
1. **Stop the application** (stop web server, desktop app, etc.)
2. **Restore the database:**
   ```powershell
   python backup_manager.py restore --backup-file "path/to/backup.sql.gz"
   ```
3. **Apply Django migrations** (if database was reset):
   ```powershell
   cd "d:\webs\pharmacy app\backend"
   .\venv\Scripts\Activate.ps1
   python manage.py migrate
   ```
4. **Restart the application**

## Configuration

### Change Backup Time
Edit `run_backup.ps1` or modify the scheduled task trigger in Task Scheduler.

### Change Retention Period
- **Default**: 30 days (keep last 30 days of backups)
- **Modify**: Edit the `$RetentionDays` parameter in `run_backup.ps1`

### Change Backup Location
```powershell
# In run_backup.ps1
[string]$BackupDir = "D:\backup-location"  # Change this path
```

## Troubleshooting

### "Database password authentication failed"
- Ensure `DB_PASSWORD` environment variable is set
- Verify PostgreSQL is running: `pg_isready -h localhost`
- Test credentials: `psql -h localhost -U postgres -d pharmacy_db`

### "pg_dump not found"
- PostgreSQL tools not in PATH
- Add `C:\Program Files\PostgreSQL\<version>\bin` to System PATH

### Task runs but no backup created
1. Check backup log: `backups\backup.log`
2. Run script manually to see errors
3. Check Task Scheduler history for exit codes

### Out of disk space
- Increase retention (`--retention-days 14` for 2 weeks)
- Move backup directory to larger drive: `[string]$BackupDir = "E:\db-backups"`
- Archive older backups to external storage

## Monitoring & Alerts

### Email Notification on Failure
Modify `run_backup.ps1` to send email on error:

```powershell
if ($LASTEXITCODE -ne 0) {
    $EmailParams = @{
        To = "admin@pharmacy.local"
        From = "backup@pharmacy.local"
        Subject = "❌ Pharmacy App Backup Failed"
        Body = "Backup cycle failed. Check logs at: d:\webs\pharmacy app\backend\backups\backup.log"
        SmtpServer = "your-smtp-server"
    }
    Send-MailMessage @EmailParams
}
```

### Backup Verification Script
```powershell
# Check if today's backup exists
$today = Get-Date -Format "yyyyMMdd"
$backups = Get-ChildItem "d:\webs\pharmacy app\backend\backups" -Filter "*$today*.sql.gz"
if ($backups.Count -gt 0) {
    Write-Host "✅ Today's backup exists: $($backups[0].Name)"
} else {
    Write-Host "❌ No backup found for today"
}
```

## Maintenance Schedule

- **Weekly**: Verify backup log shows successful backups
- **Monthly**: Test restore to a development database
- **Quarterly**: Update retention policy based on storage usage
- **Annually**: Review and document any changes to backup procedures

## Support & Reference

- PostgreSQL Backup Docs: https://www.postgresql.org/docs/current/backup-dump.html
- Windows Task Scheduler: https://docs.microsoft.com/en-us/windows/win32/taskschd/about-the-task-scheduler
- Backup Manager Usage: `python backup_manager.py --help`
