#!/bin/bash
set -e

echo "Starting pharmacy-django on Render..."
echo "DEBUG: Django Settings Module = $DJANGO_SETTINGS_MODULE"
echo "DEBUG: DATABASE_URL = ${DATABASE_URL:0:50}..."

# Run migrations
echo "Running migrations..."
python manage.py migrate --noinput || exit 1

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput || exit 1

# Start the application with Daphne
echo "Starting Daphne server on port $PORT..."
daphne -b 0.0.0.0 -p $PORT config.asgi:application
