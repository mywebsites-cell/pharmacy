# Architecture & Design

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend Tier                       │
├──────────────┬──────────────┬──────────────┬────────────┤
│   Web App    │   Desktop    │   Mobile     │   Tablet   │
│   (React)    │   (Electron) │   (Flutter)  │   (Flutter)│
└──────────────┴──────────────┴──────────────┴────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────┐
│                  API Gateway / Load Balancer            │
├─────────────────────────────────────────────────────────┤
│  (Nginx / AWS ALB with SSL/TLS termination)             │
└─────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────┐
│                    Backend Services                      │
├──────────────┬──────────────┬──────────────┬────────────┤
│   Django     │   Celery     │   Redis      │   Postgres │
│   REST API   │   Workers    │   Cache      │   Database │
│   (3+ pods)  │   (2+ pods)  │   (1 pod)    │   (HA)     │
└──────────────┴──────────────┴──────────────┴────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────┐
│                   External Services                      │
├──────────────┬──────────────┬──────────────┬────────────┤
│   Email      │   SMS        │   Payments   │   Storage  │
│   (AWS SES)  │   (Twilio)   │   (Stripe)   │   (S3)     │
└──────────────┴──────────────┴──────────────┴────────────┘
```

## Module Architecture

### Clean Architecture Layers

```
┌─────────────────────────────────────┐
│        Presentation Layer           │
│  (REST Endpoints, Serializers)      │
└──────────────┬──────────────────────┘
               │
┌──────────────↓──────────────────────┐
│         Application Layer           │
│  (Business Logic, Services)         │
└──────────────┬──────────────────────┘
               │
┌──────────────↓──────────────────────┐
│         Domain Layer                │
│  (Models, Entities, Value Objects)  │
└──────────────┬──────────────────────┘
               │
┌──────────────↓──────────────────────┐
│      Infrastructure Layer           │
│  (Database, Caching, External APIs) │
└─────────────────────────────────────┘
```

## Data Flow - Sales Transaction

```
1. POS Screen (Frontend)
   └─→ Product Search
       └─→ Barcode Scan / Manual Search
           └─→ Inventory Check

2. Shopping Cart
   └─→ Add Item
       └─→ Validate Stock
           └─→ Calculate Total

3. Billing
   └─→ Apply Discount
       └─→ Calculate Tax
           └─→ Select Payment Method

4. Payment Processing
   └─→ Payment Gateway (if online)
       └─→ Transaction Record

5. Inventory Update
   └─→ Deduct from Stock
       └─→ Create Stock Movement Record
           └─→ Check Reorder Level

6. Transaction Complete
   └─→ Generate Receipt
       └─→ Sync to Server (if offline)
           └─→ Update Customer Loyalty
```

## Offline Synchronization Flow

```
┌─────────────────┐
│  User Action    │
│  (Offline)      │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────┐
│  Local SQLite Database          │
│  ├─ Medicines                   │
│  ├─ Sales (pending)             │
│  ├─ Customers                   │
│  └─ Stock (cached)              │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  Sync Queue (in-memory)         │
│  FIFO ordered operations        │
└────────┬────────────────────────┘
         │
    [Wait for Internet]
         │
         ↓
┌─────────────────────────────────┐
│  Batch Upload to Server         │
│  (Max 100 items per batch)      │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  Server Validation & Processing │
│  ├─ Data Validation             │
│  ├─ Duplicate Detection         │
│  ├─ Conflict Resolution         │
│  └─ Database Update             │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  Sync Confirmation              │
│  ├─ Mark synced in local DB     │
│  ├─ Update local cache          │
│  └─ Clear sync queue            │
└─────────────────────────────────┘
```

## Database Relationships

```
User
├─ user_role → UserRole
│             ├─ role → Role
│             └─ pharmacy → Pharmacy
├─ pharmacies → Pharmacy (owner)
├─ audit_logs → AuditLog
├─ device_sessions → DeviceSession
├─ login_history → LoginHistory
├─ mfa_methods → MFAMethod
└─ sales (cashier) → Sale

Pharmacy
├─ branches → Branch
│           ├─ warehouses → Warehouse
│           │            ├─ shelves → Shelf
│           │            └─ stock_movements
│           ├─ inventory → Inventory
│           │            └─ medicine → Medicine
│           └─ settings → BranchSettings
├─ licenses → License
└─ tax_config → TaxConfiguration

Medicine
├─ category → MedicineCategory
├─ manufacturer → Manufacturer
├─ batches → MedicineBatch
│          ├─ supplier → Supplier
│          ├─ warehouse → Warehouse
│          ├─ shelf → Shelf
│          └─ purchase_order → PurchaseOrder
└─ stock_movements → StockMovement

Sale
├─ items → SaleItem
│        ├─ medicine → Medicine
│        └─ batch → MedicineBatch
├─ payments → Payment
├─ refunds → Refund
└─ deliveries → Delivery
```

## RBAC Structure

```
Super Admin
├─ Can manage all pharmacies
├─ User management
├─ System configuration
└─ View all analytics

Pharmacy Owner
├─ Can manage their pharmacy
├─ Branch management
├─ User management for pharmacy
├─ Pharmacy-level reports
└─ Financial management

Pharmacist
├─ Prescription verification
├─ Medicine dispensing
├─ Controlled drug tracking
├─ Patient counseling records
└─ Can view inventory

Cashier
├─ Process sales
├─ Process refunds
├─ Accept payments
├─ Print receipts
└─ Can view medicine catalog

Inventory Manager
├─ Manage stock
├─ Receive medicines
├─ Adjust inventory
├─ Monitor expiry
└─ Stock reports

Delivery Rider
├─ View assigned deliveries
├─ Update delivery status
├─ Collect payment
└─ OTP verification

Accountant
├─ View transactions
├─ Generate reports
├─ Manage accounts
├─ View ledgers
└─ Tax reports
```

## Caching Strategy

```
Redis Cache Layers:
├─ Session Cache (TTL: 24h)
│  └─ JWT token blacklist
├─ User Cache (TTL: 1h)
│  └─ User permissions & roles
├─ Inventory Cache (TTL: 5m)
│  └─ Stock levels per branch
├─ Medicine Cache (TTL: 24h)
│  └─ Medicine master data
├─ Settings Cache (TTL: 24h)
│  └─ Branch & pharmacy settings
└─ Report Cache (TTL: 1h)
   └─ Daily/monthly aggregates
```

## Task Queue (Celery)

```
Scheduled Tasks:
├─ Daily Reports (21:00)
│  └─ Generate sales, inventory reports
├─ Low Stock Alerts (Every 6h)
│  └─ Notify managers of low stock
├─ Expiry Alerts (Daily 08:00)
│  └─ Alert about expiring medicines
├─ Sync Data (Every 30min)
│  └─ Process offline sync queue
└─ Backup (Daily 23:00)
   └─ Database backup to S3

Async Tasks:
├─ Send notifications
├─ Process payments
├─ Generate reports
├─ Export data
└─ Image processing
```

## Search Strategy

### Medicine Search Types

1. **Exact Match** (Barcode)
   - Direct SQLite query
   - < 10ms response

2. **Prefix Match** (SKU)
   - Database index lookup
   - < 50ms response

3. **Fuzzy Search** (Name)
   - PostgreSQL full-text search
   - Elasticsearch for scale
   - < 100ms response

4. **Advanced Search**
   - Multiple filters
   - Cached results
   - < 200ms response

## Performance Targets

```
Transaction Processing
└─ Billing: < 2 seconds
└─ Inventory Update: < 500ms
└─ Report Generation: < 5 seconds

API Response Times
└─ Login: < 200ms
└─ Medicine Search: < 100ms
└─ Inventory Lookup: < 50ms
└─ Sales List: < 500ms

Database
└─ Connection Pool: 20-50 connections
└─ Query Timeout: 30 seconds
└─ Batch Insert: 1000 items/batch
```

## Scalability Strategy

### Horizontal Scaling

```
Backend Services:
├─ Multiple Django instances behind load balancer
├─ Stateless design for easy scaling
├─ Shared session store (Redis)
└─ Database connection pooling

Database:
├─ Read replicas for reporting queries
├─ Partition large tables by date/branch
├─ Connection pooling (pgBouncer)
└─ Separate reporting database

Caching:
├─ Redis cluster for high availability
├─ Cache invalidation strategy
└─ Distributed session storage
```

## Disaster Recovery

```
RTO: 4 hours
RPO: 15 minutes

Backup Strategy:
├─ Daily full backups to S3
├─ Hourly incremental backups
├─ Transaction logs archival
├─ Cross-region replication
└─ Point-in-time recovery

Recovery Process:
├─ Detect failure
├─ Failover to replica
├─ Restore from backup
├─ Verify data integrity
└─ Resume operations
```
