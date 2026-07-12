# Daily Backup Automation Script for Pharmacy App
# Run via Windows Task Scheduler daily at 2 AM

param(
    [string]$BackendPath = "d:\webs\pharmacy app\backend",
    [string]$VenvPath = "$BackendPath\venv",
    [string]$BackupDir = "$BackendPath\backups",
    [string]$DbName = "pharmacy_db",
    [string]$DbUser = "postgres",
    [string]$DbHost = "localhost",
    [int]$RetentionDays = 30
)

# Activate virtual environment
$activateScript = "$VenvPath\Scripts\Activate.ps1"

if (-not (Test-Path $activateScript)) {
    Write-Host "ERROR: Virtual environment not found at $activateScript" -ForegroundColor Red
    exit 1
}

Set-Location $BackendPath

try {
    # Activate venv
    & $activateScript
    
    # Run backup manager
    Write-Host "Starting backup cycle at $(Get-Date)" -ForegroundColor Green
    
    python backup_manager.py cycle `
        --db-name $DbName `
        --db-user $DbUser `
        --db-host $DbHost `
        --backup-dir $BackupDir `
        --retention-days $RetentionDays
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Backup cycle completed successfully" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "Backup cycle failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
}
