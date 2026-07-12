# Pharmacy Management System - Complete Setup & Deployment Guide

## Project Overview

A comprehensive, enterprise-grade pharmacy management system built across **Web, Desktop, Mobile, and Backend** platforms with complete offline support, real-time synchronization, and advanced features for multi-branch pharmacy operations.

### Platforms & Technologies

| Platform | Technology | Status |
|----------|-----------|--------|
| **Backend API** | Django 4.2.11 + DRF 3.14.0 + PostgreSQL 15 | ✅ Complete |
| **Web Dashboard** | React 18.2.0 + TypeScript + Vite | ✅ Complete |
| **Desktop POS** | Electron + React + SQLite (Offline) | ✅ Complete |
| **Mobile App** | Flutter + Provider (State Management) | ✅ Complete (UI Layer) |
| **Infrastructure** | Docker, Docker Compose, Kubernetes | ✅ Configured |

---

## Part 1: Backend Setup

### Prerequisites
- Python 3.10+
- PostgreSQL 15
- Redis 6+
- RabbitMQ 3.11+
- Docker & Docker Compose

### Installation Steps

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Database migrations
python manage.py migrate

# 5. Create superuser
python manage.py createsuperuser

# 6. Load initial data (optional)
python manage.py loaddata fixtures/medicines.json

# 7. Run development server
python manage.py runserver
```

### Available Django Apps

#### Core Modules
1. **Pharmacy** - Medicine inventory, batch tracking, stock management
2. **Sales** - POS transactions, billing, payment processing
3. **Authentication** - User management, role-based access control (RBAC)

#### Advanced Modules (Newly Implemented)
4. **Prescriptions** - Prescription management with OCR, controlled drugs, refills
5. **Customers** - Customer profiles, loyalty programs, multi-address support
6. **Accounting** - Double-entry bookkeeping, GL, trial balance, tax reports
7. **Delivery** - Logistics management, real-time GPS tracking, rider performance
8. **Notifications** - Multi-channel (email, SMS, push, WhatsApp, in-app) messaging
9. **Analytics** - Business intelligence, KPIs, sales trends, dead stock analysis

### Backend API Endpoints

#### Authentication
```
POST /api/v1/auth/login/
POST /api/v1/auth/logout/
POST /api/v1/auth/refresh/
```

#### Pharmacy
```
GET    /api/v1/pharmacy/medicines/
POST   /api/v1/pharmacy/medicines/
GET    /api/v1/pharmacy/medicines/{id}/
PUT    /api/v1/pharmacy/medicines/{id}/
DELETE /api/v1/pharmacy/medicines/{id}/
GET    /api/v1/pharmacy/medicines/search/  # Search by name, barcode
```

#### Sales
```
GET    /api/v1/sales/sales/
POST   /api/v1/sales/sales/
GET    /api/v1/sales/sales/{id}/receipt/
POST   /api/v1/sales/sales/{id}/refund/
POST   /api/v1/sales/sales/{id}/payment-reversal/
```

#### Prescriptions (New)
```
GET    /api/v1/prescriptions/prescriptions/
POST   /api/v1/prescriptions/prescriptions/
POST   /api/v1/prescriptions/prescriptions/{id}/verify/
POST   /api/v1/prescriptions/prescriptions/{id}/mark-as-filled/
GET    /api/v1/prescriptions/prescriptions/expiring-soon/
```

#### Customers (New)
```
GET    /api/v1/customers/customers/
POST   /api/v1/customers/customers/
POST   /api/v1/customers/customers/{id}/add-loyalty-points/
POST   /api/v1/customers/customers/{id}/redeem-loyalty-points/
GET    /api/v1/customers/loyalty-programs/
```

#### Accounting (New)
```
POST   /api/v1/accounting/journal-entries/
GET    /api/v1/accounting/general-ledger/
GET    /api/v1/accounting/trial-balance/
GET    /api/v1/accounting/tax-reports/
```

#### Delivery (New)
```
GET    /api/v1/delivery/deliveries/
POST   /api/v1/delivery/deliveries/{id}/assign-rider/
POST   /api/v1/delivery/deliveries/{id}/verify-otp/
GET    /api/v1/delivery/riders/
```

#### Analytics (New)
```
GET    /api/v1/analytics/dashboard/
GET    /api/v1/analytics/sales-report/
GET    /api/v1/analytics/top-medicines/
GET    /api/v1/analytics/customer-retention/
```

### Environment Variables

Create `.env` file in backend directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pharmacy_db
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=pharmacy_db
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# Redis & Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=amqp://guest:guest@localhost:5672//
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# API & Security
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,api.pharmacy.local

# Email (for notifications)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# SMS Provider (e.g., Twilio)
SMS_PROVIDER=twilio
SMS_ACCOUNT_SID=your-twilio-sid
SMS_AUTH_TOKEN=your-twilio-token
SMS_PHONE_NUMBER=+1234567890

# AWS/S3 (for file storage)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_STORAGE_BUCKET_NAME=pharmacy-files

# Elasticsearch (optional)
ELASTICSEARCH_HOST=localhost:9200
```

---

## Part 2: Web Dashboard Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation Steps

```bash
# Navigate to frontend directory
cd frontend-web

# Install dependencies
npm install

# Development server
npm run dev  # Runs on http://localhost:5173

# Production build
npm run build
npm run preview  # Preview production build
```

### Frontend Structure

```
frontend-web/
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── Header.tsx          # Top navigation
│   │   ├── AuthGuard.tsx       # Protected routes
│   │   └── ...
│   ├── pages/
│   │   ├── LoginPage.tsx       # Authentication
│   │   ├── DashboardPage.tsx   # Main dashboard
│   │   ├── InventoryPage.tsx   # Medicine management
│   │   ├── POSPage.tsx         # Point of sale
│   │   ├── SalesPage.tsx       # Sales history
│   │   ├── CustomersPage.tsx   # Customer management
│   │   ├── AccountingPage.tsx  # Financial reports
│   │   ├── AnalyticsPage.tsx   # Business intelligence
│   │   └── ...
│   ├── services/
│   │   ├── api.ts             # API client
│   │   └── auth.ts            # Authentication service
│   └── App.tsx                 # Main app component
├── package.json
└── vite.config.ts
```

### Key Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Updates**: WebSocket integration for live inventory
- **Offline Support**: Service worker caching for critical pages
- **Dark Mode**: Theme toggle support
- **Multi-language**: I18n ready

---

## Part 3: Desktop POS Application

### Prerequisites
- Electron 25+
- Node.js 18+
- SQLite 3 (built-in for offline data)

### Installation Steps

```bash
# Navigate to desktop app directory
cd desktop-app

# Install dependencies
npm install

# Development mode with dev tools
npm run dev

# Build executable (Windows)
npm run build:win

# Build executable (macOS)
npm run build:mac

# Build executable (Linux)
npm run build:linux
```

### Features

#### Barcode Scanning
- Real-time barcode input via USB scanner
- Support for EAN-13, Code-128, QR codes
- Fast lookup in local SQLite cache
- Immediate cart addition with Enter key

#### Keyboard Shortcuts
- **F2**: Quick Checkout - Complete current sale
- **F3**: Refund Mode - Process refund for last transaction
- **F4**: Pending Sales - View hold/pending transactions
- **ESC**: Clear Cart - Remove all items and start new sale

#### Payment Methods
- Cash
- Card (Stripe/Square integration ready)
- UPI (NPCI integration ready)
- Cheque
- Store Credit

#### Offline Support
- Full POS operation without internet
- SQLite database for medicines, customers, transactions
- Automatic sync when connection restored
- Queue management for offline transactions (up to 1000)
- Retry logic for failed syncs (3 attempts with exponential backoff)

#### Receipt Printing
- Support for thermal printers (Star Micronics, Zebra, Epson)
- Customizable receipt templates
- Logo and store branding
- Customer information printing
- Itemized billing with tax breakdown

#### Performance
- <2 second checkout time (F2 key)
- <500ms barcode lookup
- Real-time cart updates
- Support for 1000+ concurrent items in history

### Desktop App Database Schema

```sqlite
-- Medicines cache
CREATE TABLE medicines (
  id TEXT PRIMARY KEY,
  generic_name TEXT NOT NULL,
  selling_price REAL,
  quantity_on_hand INTEGER,
  reorder_level INTEGER,
  barcode TEXT UNIQUE,
  last_updated TIMESTAMP
);

-- Sales transactions
CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  bill_number TEXT,
  total_before_tax REAL,
  tax_amount REAL,
  total_amount REAL,
  items TEXT,  -- JSON array
  payment_method TEXT,
  created_at TIMESTAMP,
  synced INTEGER DEFAULT 0
);

-- Sync queue for offline transactions
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_type TEXT,
  transaction_data TEXT,  -- JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0
);
```

---

## Part 4: Mobile App (Flutter)

### Prerequisites
- Flutter 3.13+
- Dart 3.1+
- Android Studio or Xcode
- iOS deployment target: 12.0+
- Android SDK: API 21+

### Installation Steps

```bash
# Navigate to mobile app directory
cd mobile-app

# Get dependencies
flutter pub get

# Run on emulator/device
flutter run

# Build APK (Android)
flutter build apk --release

# Build IPA (iOS)
flutter build ios --release

# Build for web
flutter build web

# Build for Windows desktop
flutter build windows

# Build for macOS
flutter build macos
```

### Mobile App Structure

```
mobile-app/lib/
├── main.dart                      # Entry point
├── pharmacy_app.dart              # App shell with navigation
├── screens/
│   ├── owner_dashboard_screen.dart    # KPIs, sales metrics
│   ├── inventory_view_screen.dart     # Stock levels, expiry alerts
│   ├── customer_view_screen.dart      # Purchase history, loyalty
│   └── quick_orders_screen.dart       # Fast order entry
├── providers/
│   └── providers.dart             # State management (Provider pattern)
└── services/
    ├── api_service.dart           # API client
    └── database_service.dart      # Local SQLite
```

### Mobile App Features

#### 4 Main Screens

1. **Owner Dashboard**
   - Today's revenue, transactions, new customers
   - Gross margin percentage
   - 7-day sales trend chart
   - Top 5 medicines by revenue
   - Pull-to-refresh for data updates

2. **Inventory View**
   - Search by generic name, brand, SKU
   - Filter by low stock, expiring soon
   - Stock level with visual indicators
   - Days to expiry display
   - Monthly sales tracking
   - Tap for detailed medicine information

3. **Customer View**
   - Search by name or phone number
   - Sort by name, loyalty points, recent
   - VIP indicator with gold badge
   - Loyalty tier display (Bronze/Silver/Gold/Platinum)
   - Total purchases and lifetime value
   - Purchase history timeline
   - Tap to view full customer details

4. **Quick Orders**
   - Fast medicine search with barcode
   - Add to cart with quantity controls
   - Running order total with tax calculation
   - Multiple item support in single order
   - Optional customer lookup
   - Quick checkout
   - Offline order queuing

#### State Management (Provider)
- `AuthProvider`: User authentication
- `SalesProvider`: Transaction history and creation
- `InventoryProvider`: Medicine data with search/filter
- `CustomersProvider`: Customer data and loyalty tracking
- `AnalyticsProvider`: Dashboard KPIs and trends

#### Offline Capabilities
- Local SQLite database with auto-sync
- App continues functioning without internet
- Transactions queued for sync
- Auto-sync when connection restored
- Sync status indicator in UI
- Last updated timestamp display

#### Push Notifications
- Firebase Cloud Messaging integration ready
- Order status updates
- Inventory alerts (low stock, expiry)
- Promotional notifications
- User preference management

---

## Part 5: Docker & Container Deployment

### Docker Compose Setup (Development)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d
```

### Docker Services

```yaml
Services:
  - backend:8000 (Django API)
  - postgres:5432 (Database)
  - redis:6379 (Cache & Celery Broker)
  - rabbitmq:5672 (Message Queue)
  - nginx:80 (Reverse Proxy)
```

### Production Kubernetes Deployment

```bash
# Initialize Kubernetes cluster
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml

# Deploy services
kubectl apply -f kubernetes/backend-deployment.yaml
kubectl apply -f kubernetes/postgres-statefulset.yaml
kubectl apply -f kubernetes/redis-deployment.yaml
kubectl apply -f kubernetes/ingress.yaml

# Check deployment status
kubectl get pods -n pharmacy
kubectl get services -n pharmacy

# Scale deployment
kubectl scale deployment backend --replicas=3 -n pharmacy

# View logs
kubectl logs -f deployment/backend -n pharmacy
```

---

## Part 6: Testing

### Backend Testing

```bash
# Unit tests
pytest tests/unit/ -v --cov=apps

# Integration tests
pytest tests/integration/ -v

# API tests
pytest tests/api/ -v

# All tests with coverage
pytest --cov=. --cov-report=html

# Run specific test
pytest tests/unit/test_models.py::TestMedicineModel -v
```

### Frontend Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Load Testing

```bash
# Using Apache Bench
ab -n 1000 -c 100 http://localhost:8000/api/v1/pharmacy/medicines/

# Using Locust
locust -f locustfile.py --host=http://localhost:8000
```

---

## Part 7: Authentication & Security

### User Roles & Permissions

```
Owner (Admin)
├── View all dashboards
├── Manage all inventory
├── Access all customer data
├── View financial reports
└── Manage users and permissions

Store Manager
├── Daily POS operations
├── Inventory ordering
├── Customer queries
└── Generate sales reports

Pharmacist
├── Prescription verification
├── Medicine recommendations
└── Inventory checking

Delivery Agent
├── View assigned deliveries
├── Update delivery status
└── Upload proof of delivery

Customer Service
├── Customer queries
├── Loyalty program management
└── Complaint handling
```

### API Authentication

All API endpoints require JWT token:

```bash
# Login to get token
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8000/api/v1/pharmacy/medicines/
```

---

## Part 8: Monitoring & Logging

### Backend Monitoring

- **Prometheus**: Metrics collection (`/metrics` endpoint)
- **Grafana**: Dashboard visualization
- **ELK Stack**: Log aggregation (Elasticsearch, Logstash, Kibana)
- **Sentry**: Error tracking and alerting

### Frontend Monitoring

- **Sentry**: Client-side error tracking
- **Google Analytics**: Usage tracking
- **Performance Monitoring**: Core Web Vitals tracking

### Database Monitoring

- **pgAdmin**: PostgreSQL administration
- **Redis Commander**: Redis monitoring
- **Database Backups**: Automated daily backups to S3

---

## Part 9: Performance Optimization

### Backend

- Database query optimization with select_related/prefetch_related
- Redis caching for frequently accessed data
- Celery async tasks for heavy computations
- Database connection pooling
- API rate limiting per user/IP

### Frontend

- Code splitting with lazy loading
- Image optimization and CDN
- Service worker for offline caching
- Bundle size monitoring
- Performance budgets

### Desktop POS

- Local SQLite caching for instant lookups
- Batch medicine updates
- Efficient state management
- Indexed database queries

### Mobile

- Image caching and compression
- Database query optimization
- Lazy loading of lists
- Background sync for notifications

---

## Part 10: Deployment Checklist

### Pre-Production

- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] SSL certificates generated
- [ ] Backup strategy verified
- [ ] Monitoring and logging enabled
- [ ] Security audit completed
- [ ] Performance load tests passed
- [ ] Disaster recovery plan documented

### Production

- [ ] Deploy on cloud (AWS/GCP/Azure)
- [ ] Enable auto-scaling
- [ ] Configure CDN for static files
- [ ] Set up automated backups
- [ ] Enable application monitoring
- [ ] Configure alerting rules
- [ ] Document runbooks for common issues
- [ ] Schedule regular security updates

---

## Troubleshooting

### Backend Issues

**Database connection error**
```bash
# Check PostgreSQL is running
psql -U postgres -d pharmacy_db -c "SELECT 1"

# Check .env DATABASE_URL
python manage.py shell -c "from django.conf import settings; print(settings.DATABASES)"
```

**Redis connection error**
```bash
# Check Redis is running
redis-cli ping

# Check REDIS_URL in .env
```

**API slow response**
```bash
# Check database query performance
python manage.py django-extensions shell
>>> from django.db import connection
>>> from django.test.utils import CaptureQueriesContext
```

### Frontend Issues

**CORS errors**
```json
// Add to backend CORS_ALLOWED_ORIGINS
"CORS_ALLOWED_ORIGINS": [
  "http://localhost:5173",
  "http://localhost:3000"
]
```

**API 401 Unauthorized**
- Verify JWT token in browser console
- Check token expiration
- Re-login to get fresh token

### Desktop POS Issues

**Barcode scanner not working**
- Check USB device permissions
- Verify barcode scanner format (EAN-13)
- Test with manual barcode input

**Offline sync failing**
- Check internet connection
- Verify server is reachable
- Clear sync queue if corrupted
- Check SQLite database integrity

---

## Support & Documentation

- **API Documentation**: http://localhost:8000/api/docs (Swagger/OpenAPI)
- **Backend Admin**: http://localhost:8000/admin
- **PgAdmin**: http://localhost:5050
- **Issues**: GitHub Issues tracker
- **Documentation**: See `/docs` folder

---

## License

Proprietary - All rights reserved

## Contributors

- Backend Development: Django team
- Frontend Development: React team
- Mobile Development: Flutter team
- DevOps: Infrastructure team
