# Pharmacy App - Database & Server Setup Guide

## 🏗️ Architecture Overview

Your pharmacy app has a **3-tier architecture**:

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND LAYER (React + Vite)                         │
│  • Web: localhost:3000 (browser)                        │
│  • Desktop: localhost:5173 (Electron app)               │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP API Calls
┌──────────────────▼──────────────────────────────────────┐
│  BACKEND API LAYER                                      │
│  • Mock Server: localhost:8000 (Node.js - mock data)   │
│  • Django API: localhost:8001 (Real PostgreSQL DB)     │
└──────────────────┬──────────────────────────────────────┘
                   │ SQL Queries
┌──────────────────▼──────────────────────────────────────┐
│  DATABASE LAYER                                         │
│  • PostgreSQL: localhost:5432                           │
│  • Desktop SQLite: Desktop/database.db (local)          │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Current Configuration

### **Currently Running: Mock Node.js Server**
- **Location**: `backend/mock-server.js`
- **Port**: `localhost:8000`
- **Database**: In-memory (no persistence)
- **Data**: Hardcoded test data
- **Best For**: Quick testing, UI prototyping
- **Problem**: Data resets when server restarts, no real database

### **Real Backend: Django + PostgreSQL**
- **Location**: `backend/` (Django project)
- **Port**: `localhost:8001` (when running)
- **Database**: PostgreSQL (persistent)
- **Best For**: Production, real data, scalable
- **Advantage**: Real database, user data persists

---

## 🚀 How to Start: Step-by-Step

### **Option 1: Quick Testing (Mock Server - Current Setup)**

1. **Start the Mock Server:**
   ```powershell
   cd "d:\webs\pharmacy app\backend"
   node mock-server.js
   ```
   - Runs on `http://localhost:8000`
   - No database needed
   - Test data available immediately
   - **Data resets on restart**

2. **Start the Frontend:**
   ```powershell
   cd "d:\webs\pharmacy app\frontend-web"
   npm install  # First time only
   npm run dev
   ```
   - Runs on `http://localhost:3000`
   - Access admin panel at `/admin/subscriptions`

### **Option 2: Real Database (Django + PostgreSQL - Production)**

#### **Prerequisites:**
1. **PostgreSQL Installed**: [Download PostgreSQL](https://www.postgresql.org/download/)
   - During installation, remember the password you set for `postgres` user
   - Default settings usually work fine

2. **Python 3.9+**: [Download Python](https://www.python.org/)

#### **Setup Steps:**

1. **Create PostgreSQL Database:**
   ```powershell
   # Connect to PostgreSQL
   psql -U postgres
   
   # Then run:
   CREATE DATABASE pharmacy_db;
   CREATE USER pharmacy_user WITH PASSWORD 'secure_password_here';
   ALTER ROLE pharmacy_user SET client_encoding TO 'utf8';
   ALTER ROLE pharmacy_user SET default_transaction_isolation TO 'read committed';
   ALTER ROLE pharmacy_user SET default_transaction_deferrable TO on;
   ALTER ROLE pharmacy_user SET timezone TO 'UTC';
   GRANT ALL PRIVILEGES ON DATABASE pharmacy_db TO pharmacy_user;
   \q
   ```

2. **Set Environment Variables** (create `backend/.env`):
   ```
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   DB_NAME=pharmacy_db
   DB_USER=pharmacy_user
   DB_PASSWORD=secure_password_here
   DB_HOST=localhost
   DB_PORT=5432
   ```

3. **Install Python Dependencies:**
   ```powershell
   cd "d:\webs\pharmacy app\backend"
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

4. **Run Database Migrations:**
   ```powershell
   cd "d:\webs\pharmacy app\backend"
   python manage.py migrate
   ```

5. **Create Superuser (Admin Account):**
   ```powershell
   python manage.py createsuperuser
   # Enter: username, email, password
   ```

6. **Start Django Server:**
   ```powershell
   python manage.py runserver 8001
   ```
   - Runs on `http://localhost:8001`
   - Admin dashboard: `http://localhost:8001/admin/`

7. **Start Frontend (in new terminal):**
   ```powershell
   cd "d:\webs\pharmacy app\frontend-web"
   npm run dev
   ```
   - Runs on `http://localhost:3000`

---

## 📡 API Endpoints

### **Mock Server Endpoints** (localhost:8000)
```
GET    /api/v1/admin/users/                    - List all users
GET    /api/v1/admin/subscription-plans/       - List subscription plans
GET    /api/v1/admin/payment-submissions/      - List pending payments
GET    /api/v1/admin/payment-submissions/:id/  - Get single payment with screenshot
POST   /api/v1/admin/payment-submissions/:id/approve/  - Approve payment
POST   /api/v1/admin/payment-submissions/:id/reject/   - Reject payment
```

### **Django Endpoints** (localhost:8001)
```
Same as above, plus:
GET    /api/v1/admin/tenant-subscriptions/    - List active subscriptions
GET    /admin/                                  - Admin dashboard
```

---

## 🗄️ Database Schema

### **Users Table**
```sql
id          | INTEGER PRIMARY KEY
username    | VARCHAR(150) UNIQUE
email       | VARCHAR(254) UNIQUE
password    | VARCHAR(255)
role        | VARCHAR(20) (admin, staff, user)
first_name  | VARCHAR(150)
last_name   | VARCHAR(150)
created_at  | TIMESTAMP
updated_at  | TIMESTAMP
```

### **Payment Submissions Table**
```sql
id                 | INTEGER PRIMARY KEY
user_id            | FOREIGN KEY → users.id
plan_id            | FOREIGN KEY → subscription_plans.id
amount_paid        | DECIMAL(10,2)
screenshot_base64  | TEXT (base64-encoded image)
status             | VARCHAR(20) (pending, approved, rejected)
rejection_reason   | TEXT
submitted_at       | TIMESTAMP
reviewed_at        | TIMESTAMP
reviewed_by        | INTEGER (admin user_id)
```

### **Subscription Plans Table**
```sql
id                    | INTEGER PRIMARY KEY
name                  | VARCHAR(100)
price                 | DECIMAL(10,2)
duration_days         | INTEGER
description           | TEXT
is_popular            | BOOLEAN
max_users             | INTEGER
features              | JSON (has_pos, has_inventory, etc.)
created_at            | TIMESTAMP
```

---

## 🔧 Troubleshooting

### **Problem: "Can't see user data in admin panel"**
- ✅ **Solution**: Make sure users are fetched on component mount
- Check console for errors: Press `F12` → Console tab
- Verify API is running: Open `http://localhost:8000/api/v1/admin/users/` in browser

### **Problem: "Images not displaying in payment proof"**
- ✅ **Solution**: 
  - Check if base64 string is valid
  - Verify image was uploaded with payment
  - Check browser console for errors
  - Use Network tab (F12) to see actual response

### **Problem: "PostgreSQL connection refused"**
- ✅ **Solution**:
  - Verify PostgreSQL is running: `pg_isready`
  - Check credentials in `.env` file match database setup
  - Make sure `DB_HOST=localhost` (not 127.0.0.1)

### **Problem: "Module 'psycopg2' not found"**
- ✅ **Solution**: Run `pip install psycopg2-binary` in Django venv

### **Problem: "Port 8000 already in use"**
- ✅ **Solution**: Run mock server on different port:
  ```powershell
  node mock-server.js 8002
  ```

---

## 📊 Current Test Data (Mock Server)

**Mock Users:**
- Username: `admin` | Password: `admin123` | Role: Admin
- Username: `ahmad` | Password: `Ahmad@123` | Role: Staff

**Mock Payment Submissions (for testing approval):**
- 2 test payments waiting for approval
- Each has: user_id, plan_id, amount, status, screenshot
- Test approve/reject functionality with these

---

## 🔒 Security Notes

⚠️ **Never** commit `.env` file with real secrets!

Create `.env` with:
```
SECRET_KEY=generate-a-random-secret-key
DEBUG=False  # Set to False in production
DB_PASSWORD=strong-password-here
```

---

## 🎯 Next Steps

1. **For Development/Testing**: Use Mock Server (Option 1)
   - No database setup needed
   - Quick testing
   - Use hardcoded test data

2. **For Production**: Use Django + PostgreSQL (Option 2)
   - Real data persistence
   - Scalable
   - Professional setup

3. **To Load Real Data**:
   - Create users in Django admin: `http://localhost:8001/admin/`
   - Upload payment submissions through app
   - Data automatically stored in PostgreSQL
   - Admin panel shows all data from database

---

## 📝 Example: Uploading Payment with Screenshot

```javascript
// Frontend code to upload payment with screenshot
const formData = new FormData();
formData.append('plan_id', 1);
formData.append('amount_paid', 100);
formData.append('screenshot', screenshotFile);  // Image file

await api.post('/subscriptions/payment-submit/', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

The screenshot is:
1. Uploaded to backend
2. Converted to base64
3. Stored in database
4. Retrieved in admin panel for review
5. Displayed in payment proof section

---

## 📞 Quick Reference Commands

```powershell
# Start Mock Server
node backend/mock-server.js

# Start Django
python manage.py runserver 8001

# Start Frontend
npm run dev

# Database backup
pg_dump -U postgres pharmacy_db > backup.sql

# Check if PostgreSQL is running
pg_isready

# Recreate database
dropdb -U postgres pharmacy_db
createdb -U postgres pharmacy_db
python manage.py migrate
```

---

**Happy coding! 🚀**

