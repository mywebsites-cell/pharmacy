#!/usr/bin/env python
"""
PostgreSQL Backup Manager
Automated backup with retention policy and restore functionality
"""
import os
import sys
import subprocess
import gzip
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import json


class BackupManager:
    def __init__(self, db_name='pharmacy_db', db_user='postgres', db_host='localhost', 
                 backup_dir='./backups', retention_days=30):
        self.db_name = db_name
        self.db_user = db_user
        self.db_host = db_host
        self.backup_dir = Path(backup_dir)
        self.retention_days = retention_days
        self.log_file = self.backup_dir / 'backup.log'
        
        # Create backup directory
        self.backup_dir.mkdir(parents=True, exist_ok=True)
    
    def log(self, message):
        """Log message to file and console"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_msg = f"[{timestamp}] {message}"
        print(log_msg)
        with open(self.log_file, 'a') as f:
            f.write(log_msg + '\n')
    
    def create_backup(self):
        """Create compressed database backup"""
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_file = self.backup_dir / f"backup_{self.db_name}_{timestamp}.sql"
            backup_gz = self.backup_dir / f"backup_{self.db_name}_{timestamp}.sql.gz"
            
            self.log(f"Starting backup of {self.db_name}...")
            
            # Create uncompressed dump
            env = os.environ.copy()
            env['PGPASSWORD'] = os.getenv('DB_PASSWORD', 'postgres')
            
            result = subprocess.run(
                [
                    'pg_dump',
                    '-h', self.db_host,
                    '-U', self.db_user,
                    '-d', self.db_name,
                    '-F', 'p',  # Plain text format
                    '-v'
                ],
                capture_output=True,
                text=True,
                env=env,
                timeout=600  # 10 min timeout
            )
            
            if result.returncode != 0:
                self.log(f"❌ Backup failed: {result.stderr}")
                return None
            
            # Write to file
            with open(backup_file, 'w') as f:
                f.write(result.stdout)
            
            # Compress
            with open(backup_file, 'rb') as f_in:
                with gzip.open(backup_gz, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            backup_file.unlink()  # Delete uncompressed
            
            file_size_mb = backup_gz.stat().st_size / (1024 * 1024)
            self.log(f"✅ Backup completed: {backup_gz.name} ({file_size_mb:.2f} MB)")
            
            # Save metadata
            self._save_backup_metadata(backup_gz)
            return backup_gz
            
        except Exception as e:
            self.log(f"❌ Backup error: {str(e)}")
            return None
    
    def _save_backup_metadata(self, backup_file):
        """Save backup metadata for restore tracking"""
        metadata_file = self.backup_dir / 'metadata.json'
        metadata = {
            'filename': backup_file.name,
            'timestamp': datetime.now().isoformat(),
            'size_bytes': backup_file.stat().st_size,
            'database': self.db_name
        }
        
        # Append to metadata log
        try:
            existing = []
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    existing = json.load(f)
            existing.append(metadata)
            with open(metadata_file, 'w') as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            self.log(f"⚠️  Metadata save failed: {str(e)}")
    
    def cleanup_old_backups(self):
        """Delete backups older than retention period"""
        try:
            cutoff_date = datetime.now() - timedelta(days=self.retention_days)
            deleted_count = 0
            
            for backup_file in self.backup_dir.glob(f'backup_{self.db_name}_*.sql.gz'):
                if backup_file.stat().st_mtime < cutoff_date.timestamp():
                    backup_file.unlink()
                    deleted_count += 1
                    self.log(f"🗑️  Deleted old backup: {backup_file.name}")
            
            if deleted_count == 0:
                self.log("✅ No old backups to delete")
            else:
                self.log(f"✅ Deleted {deleted_count} old backup(s)")
                
        except Exception as e:
            self.log(f"❌ Cleanup error: {str(e)}")
    
    def restore_backup(self, backup_file):
        """Restore database from backup"""
        try:
            backup_path = Path(backup_file)
            if not backup_path.exists():
                self.log(f"❌ Backup file not found: {backup_file}")
                return False
            
            self.log(f"Starting restore from {backup_path.name}...")
            
            # Decompress if needed
            if backup_path.suffix == '.gz':
                sql_file = self.backup_dir / backup_path.stem
                with gzip.open(backup_path, 'rb') as f_in:
                    with open(sql_file, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                restore_file = sql_file
            else:
                restore_file = backup_path
            
            env = os.environ.copy()
            env['PGPASSWORD'] = os.getenv('DB_PASSWORD', 'postgres')
            
            # Drop and recreate database
            result = subprocess.run(
                [
                    'psql',
                    '-h', self.db_host,
                    '-U', self.db_user,
                    '-d', 'postgres',
                    '-c', f'DROP DATABASE IF EXISTS {self.db_name};'
                ],
                capture_output=True,
                env=env,
                timeout=60
            )
            
            result = subprocess.run(
                [
                    'psql',
                    '-h', self.db_host,
                    '-U', self.db_user,
                    '-d', 'postgres',
                    '-c', f'CREATE DATABASE {self.db_name};'
                ],
                capture_output=True,
                env=env,
                timeout=60
            )
            
            # Restore
            with open(restore_file, 'r') as f:
                result = subprocess.run(
                    [
                        'psql',
                        '-h', self.db_host,
                        '-U', self.db_user,
                        '-d', self.db_name
                    ],
                    stdin=f,
                    capture_output=True,
                    env=env,
                    timeout=600
                )
            
            if restore_file != backup_path:
                restore_file.unlink()
            
            if result.returncode == 0:
                self.log(f"✅ Restore completed successfully")
                return True
            else:
                self.log(f"❌ Restore failed: {result.stderr.decode() if result.stderr else 'Unknown error'}")
                return False
                
        except Exception as e:
            self.log(f"❌ Restore error: {str(e)}")
            return False
    
    def list_backups(self):
        """List all available backups"""
        backups = list(self.backup_dir.glob(f'backup_{self.db_name}_*.sql.gz'))
        backups.sort(reverse=True)
        
        if not backups:
            print("No backups found")
            return
        
        print(f"\n{'Backup File':<50} {'Size':<12} {'Date':<20}")
        print("-" * 82)
        for backup in backups:
            size_mb = backup.stat().st_size / (1024 * 1024)
            mtime = datetime.fromtimestamp(backup.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')
            print(f"{backup.name:<50} {size_mb:>10.2f}MB {mtime:<20}")
    
    def run_backup_cycle(self):
        """Run backup and cleanup"""
        self.create_backup()
        self.cleanup_old_backups()


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='PostgreSQL Backup Manager')
    parser.add_argument('action', choices=['backup', 'restore', 'list', 'cycle'],
                       help='Action to perform')
    parser.add_argument('--backup-file', help='Backup file for restore action')
    parser.add_argument('--db-name', default='pharmacy_db', help='Database name')
    parser.add_argument('--db-user', default='postgres', help='Database user')
    parser.add_argument('--db-host', default='localhost', help='Database host')
    parser.add_argument('--backup-dir', default='./backups', help='Backup directory')
    parser.add_argument('--retention-days', type=int, default=30, help='Retention days')
    
    args = parser.parse_args()
    
    manager = BackupManager(
        db_name=args.db_name,
        db_user=args.db_user,
        db_host=args.db_host,
        backup_dir=args.backup_dir,
        retention_days=args.retention_days
    )
    
    if args.action == 'backup':
        manager.create_backup()
    elif args.action == 'restore':
        if not args.backup_file:
            print("Error: --backup-file required for restore action")
            sys.exit(1)
        manager.restore_backup(args.backup_file)
    elif args.action == 'list':
        manager.list_backups()
    elif args.action == 'cycle':
        manager.run_backup_cycle()


if __name__ == '__main__':
    main()
