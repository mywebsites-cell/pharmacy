from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Purge SyncQueue events that have been processed (status=SYNCED) and are older than 30 days.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Delete SYNCED events older than this many days (default: 30)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print how many rows would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        from apps.pharmacy.models import SyncQueue

        days = options['days']
        dry_run = options['dry_run']
        cutoff = timezone.now() - timedelta(days=days)

        qs = SyncQueue.objects.filter(status='SYNCED', created_at__lt=cutoff)
        count = qs.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'[DRY RUN] Would delete {count} SYNCED SyncQueue events older than {days} days.'
                )
            )
        else:
            qs.delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully purged {count} SYNCED SyncQueue events older than {days} days.'
                )
            )
