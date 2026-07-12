#!/bin/bash

# Pharmacy Management System Setup Script
# This script sets up the complete development environment

set -e

echo "🏥 Pharmacy Management System - Setup"
echo "======================================"

# Check prerequisites
echo "✓ Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed."; exit 1; }

# Create .env file
echo "✓ Creating environment configuration..."
cat > backend/.env << EOF
DEBUG=False
SECRET_KEY=change-this-in-production-with-a-secure-key
DB_NAME=pharmacy_db
DB_USER=pharmacy_user
DB_PASSWORD=change-this-secure-password
DB_HOST=postgres
DB_PORT=5432
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
USE_S3=False
EOF

# Build and start containers
echo "✓ Building Docker containers..."
docker-compose build

echo "✓ Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "✓ Waiting for services to be ready..."
sleep 10

# Run migrations
echo "✓ Running database migrations..."
docker-compose exec -T backend python manage.py migrate

# Create superuser
echo "✓ Creating superuser..."
docker-compose exec -T backend python manage.py createsuperuser --noinput \
    --username=admin \
    --email=admin@pharmacy.local || true

# Install frontend dependencies
echo "✓ Installing frontend dependencies..."
cd frontend-web
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Services running at:"
echo "  Backend API:     http://localhost:8000"
echo "  Frontend:        http://localhost"
echo "  Admin Panel:     http://localhost:8000/admin"
echo "  API Docs:        http://localhost:8000/api/docs"
echo ""
echo "To stop services: docker-compose down"
echo "To view logs: docker-compose logs -f [service-name]"
