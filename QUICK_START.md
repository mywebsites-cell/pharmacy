# Quick Start Guide - Pharmacy Management System

## ⚡ 5-Minute Setup

### Option 1: All Services with Docker Compose (Recommended)

```bash
# Start all services (Backend, Frontend, Database, Redis, RabbitMQ)
docker-compose up -d

# Wait 30 seconds for services to start
sleep 30

# Access services:
# 📱 Frontend Web:  http://localhost:80 (or :3000)
# 🛠️ Backend API:   http://localhost:8000
# 🗄️ PgAdmin:       http://localhost:5050 (user: admin@admin.com / admin)
# 📊 Redis:         localhost:6379
# 🐰 RabbitMQ:      http://localhost:15672 (guest/guest)

# Stop all services
docker-compose down

# Reset everything (caution: deletes data)
docker-compose down -v
docker-compose up -d
```

### Option 2: Individual Service Setup

#### Backend API
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser  # Create admin user
python manage.py runserver
# Available at http://localhost:8000
```

#### Frontend Web Dashboard
```bash
cd frontend-web
npm install
npm run dev
# Available at http://localhost:5173
```

#### Desktop POS Application
```bash
cd desktop-app
npm install
npm run dev  # Development mode with dev tools
# Or: npm run build:win (to create Windows executable)
```

#### Mobile App (Flutter)
```bash
cd mobile-app
flutter pub get
flutter run
# Or: flutter build apk --release (Android)
# Or: flutter build ios --release (iOS)
```

---

## 🔐 Default Login Credentials

| Platform | Username | Password | Notes |
|----------|----------|----------|-------|
| Web Admin | admin | admin123 | Change on first login |
| Django Admin | admin | admin123 | Available at /admin |
| PgAdmin | admin@admin.com | admin | Access at :5050 |

---

## 📋 Key Features Quick Access

### Web Dashboard
- **Login**: http://localhost:8000
- **Dashboard**: See KPIs and analytics
- **Inventory**: Search medicines by name or barcode
- **POS**: Create sales transactions
- **Customers**: Manage customer loyalty
- **Accounting**: View P&L and GL reports
- **Analytics**: Business intelligence

### Desktop POS
- **F2**: Complete checkout (main button)
- **F3**: Process refund
- **F4**: View pending transactions
- **ESC**: Clear cart
- **Barcode Scanner**: Plug USB scanner and scan (automatic lookup)
- **Offline Mode**: Works without internet, auto-syncs when online

### Mobile App
- **Dashboard**: Real-time KPIs and sales metrics
- **Inventory**: Browse medicines with stock levels
- **Customers**: Customer profiles with loyalty points
- **Quick Orders**: Fast order entry with checkout

---

## 🐛 Troubleshooting

### Backend Issues

**Database connection error**
```bash
# Verify PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Check/update DATABASE_URL in .env
# Format: postgresql://user:password@localhost:5432/pharmacy_db
```

**Port 8000 already in use**
```bash
# Use different port
python manage.py runserver 8001
```

**Migration errors**
```bash
# Reset migrations (development only!)
python manage.py migrate apps 0001
python manage.py migrate
```

### Frontend Issues

**API connection refused**
```bash
# Verify backend is running: http://localhost:8000/api/v1/
# Check API URL in frontend-web/src/services/api.ts
# Should be: http://localhost:8000
```

**Port 5173 already in use**
```bash
# Frontend will prompt to use different port, press Y
```

### Desktop POS Issues

**Barcode scanner not working**
- Check USB connection and permissions
- Test with manual barcode entry (type and press Enter)
- Verify barcode format (EAN-13 recommended)

**Offline mode not syncing**
- Check internet connection
- Verify backend server is reachable
- Try menu option "Sync Now"
- Check sync queue in SQLite database

### Mobile Issues

**Cannot connect to backend**
- Verify backend is running and reachable
- Check API URL in `lib/services/api_service.dart`
- For physical device: use computer IP instead of localhost
- Example: `http://192.168.1.100:8000`

---

## 📊 API Documentation

### Interactive Docs (Swagger)
```
GET http://localhost:8000/api/docs/
```

### API Endpoints (Examples)

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get JWT token from response, use in headers:
# Authorization: Bearer <token>

# List medicines
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/pharmacy/medicines/

# Search by barcode
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/v1/pharmacy/medicines/search/?barcode=123456789012"

# Create sale
curl -X POST http://localhost:8000/api/v1/sales/sales/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"medicine_id":"1","quantity":2,"price":50}],
    "payment_method": "CASH",
    "total": 100
  }'
```

---

## 📱 Mobile Barcode

Show this QR code to quickly add a test medicine:

```
Barcode: 123456789012
Generic Name: Aspirin
Brand: Asprin 500
Strength: 500mg
Price: Rs 50
```

To create QR codes: https://www.qr-code-generator.com/

---

## 🔄 Data Sync Process

### Desktop POS Offline Sync

1. **Online Mode**
   - All transactions go directly to server
   - Real-time inventory updates

2. **Offline Mode** (No internet)
   - Transactions saved to local SQLite
   - Sync queue shows pending items
   - No internet indicator visible

3. **Auto-Sync** (When online)
   - Automatic sync every 5 minutes
   - Also syncs when app regains focus
   - Shows sync status in UI
   - Retries failed transactions up to 3 times

### Mobile Offline Support

1. **Local Cache**
   - Medicines downloaded and cached
   - Customer data cached locally
   - Search works offline

2. **Transaction Queue**
   - Orders saved locally when offline
   - Sync when internet available
   - Auto-retry with backoff

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Login works with correct credentials
- [ ] Can view dashboard with current metrics
- [ ] Search for medicine by name works
- [ ] Can add item to cart in POS
- [ ] Checkout calculates tax correctly (5%)
- [ ] Receipt prints or previews
- [ ] Customer loyalty points update
- [ ] Can create a prescription
- [ ] Can view accounting reports
- [ ] Mobile app loads all screens

### Automated Tests

```bash
# Backend tests
cd backend
pytest tests/ -v --cov=apps

# Frontend tests
cd frontend-web
npm run test

# E2E tests (requires running services)
npm run test:e2e
```

---

## 📦 Production Deployment

### Using Kubernetes

```bash
# Initialize cluster
kubectl apply -f kubernetes/

# Check status
kubectl get pods -n pharmacy

# View logs
kubectl logs -f deployment/backend -n pharmacy

# Scale replicas
kubectl scale deployment backend --replicas=5 -n pharmacy
```

### Using Cloud Platform

```bash
# AWS ECS
aws ecs create-service --cluster pharmacy --service-name backend ...

# Google Cloud Run
gcloud run deploy backend --image backend:latest

# Azure Container Instances
az container create --name pharmacy --image backend:latest
```

---

## 📞 Support

### Documentation Files

- **DEPLOYMENT_GUIDE.md** - Comprehensive setup guide (50+ sections)
- **PROJECT_SUMMARY.md** - Project overview and architecture
- **API Documentation** - http://localhost:8000/api/docs (Swagger)
- **Django Admin** - http://localhost:8000/admin

### Common Tasks

**Reset admin password**
```bash
cd backend
python manage.py changepassword admin
```

**Create new user**
```bash
cd backend
python manage.py createsuperuser
```

**Import sample data**
```bash
cd backend
python manage.py loaddata fixtures/medicines.json
```

**Backup database**
```bash
pg_dump -U postgres pharmacy_db > backup.sql
```

**Restore database**
```bash
psql -U postgres < backup.sql
```

---

## 🚀 Performance Tips

### For Desktop POS

- Keep SQLite database under 1GB for best performance
- Clear old transactions (>1 year) monthly
- Rebuild indexes monthly: `VACUUM ANALYZE;`

### For Web Dashboard

- Enable browser caching (browser dev tools)
- Use incognito mode if experiencing cache issues
- Clear browser cache: Ctrl+Shift+Delete

### For Mobile App

- Close unused apps to free memory
- Enable battery saving mode
- Use WiFi instead of cellular for better performance

### For Backend

- Monitor database connections: `SELECT count(*) FROM pg_stat_activity;`
- Check slow queries: Enable slow query log
- Scale horizontally with Kubernetes if needed

---

## ✅ Verification Checklist

After setup, verify everything works:

```bash
# Backend
curl -s http://localhost:8000/api/v1/ | grep -q "auth" && echo "✓ Backend"

# Frontend  
curl -s http://localhost:80 | grep -q "Pharmacy" && echo "✓ Frontend"

# Database
psql -U postgres -c "SELECT 1" >/dev/null && echo "✓ PostgreSQL"

# Redis
redis-cli ping | grep -q "PONG" && echo "✓ Redis"

# All good!
echo "🎉 System is ready!"
```

---

## 📚 Next Steps

1. **Change Default Passwords**
   - Admin user in Django
   - PgAdmin credentials
   - Database user password

2. **Configure Email/SMS**
   - Set up SMTP in .env
   - Add SMS provider credentials
   - Test notification delivery

3. **Load Sample Data**
   - Import medicines from fixtures
   - Create sample customers
   - Create sample prescriptions

4. **Set Up Backup Strategy**
   - Configure automated backups
   - Test restore procedures
   - Monitor backup storage

5. **Enable Monitoring**
   - Set up Prometheus
   - Configure Grafana dashboards
   - Enable error tracking (Sentry)

6. **Security Hardening**
   - Change all default passwords
   - Enable SSL/TLS certificates
   - Configure firewall rules
   - Set up VPN access

---

**Happy Pharmacy Management! 🏥💊**

For detailed information, see the complete DEPLOYMENT_GUIDE.md
