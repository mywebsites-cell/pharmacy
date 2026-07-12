# API Reference

## Authentication

### Login
```http
POST /api/v1/auth/login/
Content-Type: application/json

{
  "username": "pharmacist1",
  "password": "secure_password"
}

Response:
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "pharmacist1",
    "email": "pharmacist@pharmacy.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+1234567890"
  },
  "role": "PHARMACIST",
  "permissions": ["view_medicines", "create_sale", "process_refund"]
}
```

## Inventory Management

### Search Medicines
```http
GET /api/v1/inventory/medicines/search_medicine/?q=aspirin

Response:
{
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "generic_name": "Acetylsalicylic Acid",
      "brand_name": "Aspirin",
      "sku": "ASP-500",
      "barcode": "8901234567890",
      "dosage_form": "TABLET",
      "strength": "500mg",
      "selling_price": "2.50",
      "is_active": true
    }
  ]
}
```

### Get Inventory Levels
```http
GET /api/v1/inventory/inventory/?branch_id=550e8400-e29b-41d4-a716-446655440000

Response:
{
  "results": [
    {
      "medicine_name": "Aspirin",
      "medicine_sku": "ASP-500",
      "total_quantity": 500,
      "available_quantity": 450,
      "reserved_quantity": 50,
      "last_stock_check": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Get Low Stock Items
```http
GET /api/v1/inventory/medicines/low_stock/?branch_id=550e8400-e29b-41d4-a716-446655440000

Response:
{
  "results": [
    {
      "brand_name": "Paracetamol",
      "sku": "PAR-500",
      "available_quantity": 25,
      "reorder_level": 50
    }
  ]
}
```

## Sales

### Create Sale
```http
POST /api/v1/sales/sales/create_sale/
Content-Type: application/json
Authorization: Bearer <token>

{
  "branch_id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "550e8400-e29b-41d4-a716-446655440001",
  "payment_method": "CASH",
  "items": [
    {
      "medicine_id": "550e8400-e29b-41d4-a716-446655440002",
      "batch_id": "550e8400-e29b-41d4-a716-446655440003",
      "quantity": 2,
      "unit_price": "2.50",
      "discount_percentage": 0
    },
    {
      "medicine_id": "550e8400-e29b-41d4-a716-446655440004",
      "batch_id": "550e8400-e29b-41d4-a716-446655440005",
      "quantity": 1,
      "unit_price": "5.00",
      "discount_percentage": 10
    }
  ]
}

Response:
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "bill_number": "BL15012024000001",
  "subtotal": "9.50",
  "tax_amount": "0.48",
  "discount_amount": "0.50",
  "total_amount": "9.48",
  "payment_status": "PENDING",
  "items": [
    {
      "medicine": "Aspirin",
      "quantity": 2,
      "unit_price": "2.50",
      "total_amount": "5.00"
    }
  ]
}
```

### Process Payment
```http
POST /api/v1/sales/sales/550e8400-e29b-41d4-a716-446655440006/process_payment/
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": "9.48",
  "payment_method": "CASH"
}

Response:
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "bill_number": "BL15012024000001",
  "payment_status": "COMPLETED",
  "payments": [
    {
      "payment_method": "CASH",
      "amount_paid": "9.48",
      "created_at": "2024-01-15T10:35:00Z"
    }
  ]
}
```

## Reporting

### Daily Sales Summary
```http
GET /api/v1/sales/sales/550e8400-e29b-41d4-a716-446655440000/daily_sales/
Authorization: Bearer <token>

Response:
{
  "total_sales": "5000.00",
  "total_items": 250,
  "total_discount": "200.00",
  "cash_sales": "3000.00",
  "card_sales": "2000.00"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request data",
  "details": {
    "quantity": "Must be greater than 0"
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "detail": "No authentication credentials provided"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "detail": "You don't have permission to perform this action"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "detail": "Medicine not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "detail": "An unexpected error occurred"
}
```

## Rate Limiting

Endpoints are rate-limited based on authentication status:
- Anonymous: 100 requests/hour
- Authenticated: 1000 requests/hour
- Admin: 5000 requests/hour

Response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1705329600
```
