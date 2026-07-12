# PharmacyPro - Enterprise Pharmacy Management System

## Overview

PharmacyPro is a comprehensive, production-ready pharmacy management ecosystem designed for real-world enterprise pharmacy operations. It includes web admin dashboard, desktop POS application, mobile app, and cloud backend infrastructure.

### Key Features

- **Multi-Platform Support**: Web, Desktop (Windows), Mobile (Android/iOS), Tablet
- **Offline-First Architecture**: Seamless offline operation with automatic sync
- **Real-Time Inventory**: FIFO batch tracking with expiry management
- **Ultra-Fast Billing**: <2 second transaction processing
- **Multi-Tenant SaaS**: Support for pharmacy chains with multiple branches
- **Enterprise Security**: JWT auth, RBAC, audit logging, encryption
- **Cloud-Native**: Docker, Kubernetes, CI/CD ready
- **Scalability**: Load balancing, auto-scaling, caching

## Project Structure

```
pharmacy-app/
├── backend/                 # Django REST API
│   ├── apps/               # Modular Django apps
│   │   ├── authentication/ # Auth & RBAC
│   │   ├── pharmacy/       # Pharmacy management
│   │   ├── inventory/      # Inventory management
│   │   ├── sales/          # POS & billing
│   │   ├── purchases/      # Purchase orders
│   │   ├── prescriptions/  # Prescriptions
│   │   ├── customers/      # Customer management
│   │   ├── accounting/     # Ledger & reports
│   │   ├── delivery/       # Delivery tracking
│   │   ├── notifications/  # Notifications
│   │   └── analytics/      # Analytics & reports
│   ├── config/             # Django settings
│   ├── services/           # Business logic
│   ├── tasks/              # Celery tasks
│   ├── tests/              # Test suite
│   └── manage.py           # Django CLI
├── frontend-web/           # React admin dashboard
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── store/          # Zustand stores
│   │   └── App.tsx         # Main app
│   └── package.json
├── desktop-app/            # Electron POS app
│   ├── main.js             # Electron main
│   └── preload.js          # Electron preload
├── mobile-app/             # Flutter mobile
│   ├── lib/
│   └── pubspec.yaml
├── docker/                 # Docker files
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx.conf
├── kubernetes/             # K8s manifests
│   ├── backend.yaml
│   ├── frontend.yaml
│   └── postgres-redis.yaml
├── docs/                   # Documentation
└── scripts/                # Setup/deploy scripts
```

## Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15
- Redis 7

### Quick Start (Docker)

```bash
# Clone the repository
git clone <repository-url>
cd pharmacy-app

# Run setup script
bash scripts/setup.sh

# Access services
# Backend: http://localhost:8000
# Frontend: http://localhost
# Admin: http://localhost:8000/admin
```

### Manual Setup

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver

# In another terminal, start Celery
celery -A config worker -l info
```

#### Frontend Setup

```bash
cd frontend-web

# Install dependencies
npm install

# Start development server
npm run dev
```

## Technology Stack

### Backend
- **Framework**: Django 4.2 + Django REST Framework
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Task Queue**: Celery with RabbitMQ
- **Search**: Elasticsearch
- **Authentication**: JWT (SimpleJWT)
- **API Documentation**: Swagger/OpenAPI

### Frontend Web
- **Framework**: React 18
- **Language**: TypeScript
- **State Management**: Zustand
- **Query**: TanStack Query (React Query)
- **CSS**: Tailwind CSS
- **UI Components**: Headless UI + Lucide Icons
- **Routing**: React Router v6

### Desktop
- **Framework**: Electron 27
- **Database**: SQLite (local)
- **Sync**: Custom sync queue system

### Mobile
- **Framework**: Flutter
- **Databases**: SQLite + Hive
- **State Management**: Provider
- **HTTP**: Dio
- **Push Notifications**: Firebase Cloud Messaging

## API Endpoints

### Authentication
```
POST   /api/v1/auth/login/
POST   /api/v1/auth/logout/
POST   /api/v1/auth/refresh/
POST   /api/v1/auth/password-reset/request_reset/
POST   /api/v1/auth/password-reset/confirm_reset/
```

### Inventory
```
GET    /api/v1/inventory/medicines/
GET    /api/v1/inventory/medicines/search_medicine/?q=query
GET    /api/v1/inventory/medicines/by_barcode/?barcode=123
GET    /api/v1/inventory/medicines/low_stock/?branch_id=xyz
GET    /api/v1/inventory/batches/expiring_soon/?branch_id=xyz&days=30
GET    /api/v1/inventory/inventory/?branch_id=xyz
GET    /api/v1/inventory/stock-movements/?branch_id=xyz
```

### Sales
```
POST   /api/v1/sales/sales/create_sale/
POST   /api/v1/sales/sales/{id}/process_payment/
GET    /api/v1/sales/sales/?branch_id=xyz
GET    /api/v1/sales/sales/{id}/daily_sales/
POST   /api/v1/sales/refunds/
```

### Pharmacy
```
GET    /api/v1/pharmacy/pharmacies/
GET    /api/v1/pharmacy/branches/
GET    /api/v1/pharmacy/branch-settings/?branch_id=xyz
GET    /api/v1/pharmacy/licenses/expiring_soon/
```

## Database Schema Highlights

### Key Tables
- `users`: Custom user model with device tracking
- `medicines`: Comprehensive medicine catalog
- `medicine_batches`: FIFO batch tracking with expiry management
- `inventory`: Real-time stock levels per branch
- `stock_movements`: Audit trail for all stock changes
- `sales` & `sale_items`: Transaction records
- `customers`: Customer profiles with loyalty points
- `audit_logs`: Complete system activity log

### Key Indexes
- Medicine SKU, barcode for fast search
- Inventory by branch for quick stock lookup
- Sales by date range for reporting
- Batches by expiry date for expiry tracking

## Security Features

### Authentication & Authorization
- JWT tokens with refresh mechanism
- Role-based access control (RBAC) with 7 roles
- Multi-factor authentication (MFA) support
- Device session tracking
- Login history and suspicious activity detection

### Data Protection
- Password encryption with strong hashing
- HTTPS everywhere in production
- SQL injection prevention (Django ORM)
- XSS protection with React escaping
- CSRF protection
- Rate limiting on API endpoints

### Audit & Compliance
- Complete audit logging of all changes
- User action tracking
- IP and device logging
- Encrypted password reset tokens
- Secure session management

## Offline Architecture

### Desktop App Sync Strategy

```
Offline Mode:
  ↓
[SQLite Local DB]
  ↓
Queue pending transactions
  ↓
Internet Connection Detected
  ↓
Sync Manager (FIFO batch processing)
  ↓
Conflict Resolution Engine
  ↓
Server Confirmation
  ↓
Local DB Update
```

## Deployment

### Docker Compose (Development)

```bash
docker-compose up -d
```

### Kubernetes (Production)

```bash
# Create namespace
kubectl create namespace pharmacy

# Apply configurations
kubectl apply -f kubernetes/configmap-secret.yaml
kubectl apply -f kubernetes/postgres-redis.yaml
kubectl apply -f kubernetes/backend.yaml
kubectl apply -f kubernetes/celery.yaml
kubectl apply -f kubernetes/frontend.yaml

# Scale as needed
kubectl scale deployment backend --replicas=5 -n pharmacy
```

### AWS ECS/Fargate

```bash
# Push images to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

docker tag pharmacy-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/pharmacy-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/pharmacy-backend:latest

# Deploy via CloudFormation or Terraform
```

## Performance Optimization

### Backend
- Connection pooling (pgbouncer)
- Query optimization with select_related/prefetch_related
- Redis caching for frequent queries
- Database indexes on common search fields
- Celery for async tasks

### Frontend
- Code splitting and lazy loading
- React Query for intelligent caching
- Zustand for lightweight state management
- Tailwind CSS for minimal CSS output
- Image optimization

### Database
- Partitioning for large tables (sales, movements)
- Materialized views for reports
- Connection pooling
- Read replicas for reporting queries

## Monitoring & Logging

### Application Monitoring
- Structured logging to files and stdout
- Sentry for error tracking
- Health check endpoints
- Prometheus metrics (optional)

### Database Monitoring
- PostgreSQL slow query log
- Index usage statistics
- Connection monitoring
- Vacuum analysis

### Infrastructure
- Kubernetes dashboard
- Pod resource monitoring
- Load balancer metrics
- Network traffic analysis

## Development Workflow

### Local Development
```bash
# Backend
cd backend
source venv/bin/activate
python manage.py runserver

# Frontend (in another terminal)
cd frontend-web
npm run dev

# Celery (in another terminal)
celery -A config worker -l info
```

### Testing
```bash
# Backend tests
cd backend
python manage.py test

# Frontend tests
cd frontend-web
npm test

# E2E tests
npm run test:e2e
```

### Code Quality
```bash
# Backend linting
flake8 backend/apps

# Frontend linting
cd frontend-web
npm run lint

# Type checking
mypy backend/apps
```

## Contributing

1. Create a feature branch
2. Make changes
3. Run tests
4. Submit pull request

## License

Proprietary - All rights reserved

## Support

For issues and support: support@pharmacypro.com
