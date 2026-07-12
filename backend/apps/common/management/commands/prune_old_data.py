from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.authentication.models import LoginHistory
from apps.common.models import AuditLog
from apps.notifications.models import NotificationAudit


class Command(BaseCommand):
    help = "Prune old operational logs to control database growth."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=365,
            help="Retention window in days (default: 365).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview deletions without changing data.",
        )

    def handle(self, *args, **options):
        retention_days = options["days"]
        dry_run = options["dry_run"]
        cutoff = timezone.now() - timedelta(days=retention_days)

        targets = [
            ("audit_logs", AuditLog.all_objects.filter(created_at__lt=cutoff)),
            ("login_history", LoginHistory.objects.filter(created_at__lt=cutoff)),
            ("notification_audit", NotificationAudit.objects.filter(created_at__lt=cutoff)),
        ]

        total = 0
        for label, queryset in targets:
            count = queryset.count()
            total += count
            if dry_run:
                self.stdout.write(f"[DRY-RUN] {label}: {count} rows older than {retention_days} days")
            else:
                queryset.delete()
                self.stdout.write(f"Deleted {count} rows from {label}")

        if dry_run:
            self.stdout.write(self.style.WARNING(f"[DRY-RUN] Total rows that would be pruned: {total}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Prune complete. Total rows deleted: {total}"))
