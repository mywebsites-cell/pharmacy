# Testing Strategy

## Unit Tests

### Backend Unit Tests

```python
# tests/test_sales.py
from django.test import TestCase
from apps.sales.models import Sale, SaleItem
from apps.inventory.models import Medicine

class SaleTestCase(TestCase):
    def setUp(self):
        self.medicine = Medicine.objects.create(
            generic_name="Aspirin",
            brand_name="Aspirin Plus",
            sku="ASP-500",
            purchase_price=1.50,
            selling_price=2.50
        )
    
    def test_create_sale(self):
        sale = Sale.objects.create(
            bill_number="BL001",
            subtotal=2.50,
            total_amount=2.50
        )
        self.assertEqual(sale.payment_status, "PENDING")
    
    def test_sale_item_calculation(self):
        item = SaleItem(
            medicine=self.medicine,
            quantity=2,
            unit_price=2.50
        )
        self.assertEqual(item.total_amount, 5.00)
```

## Integration Tests

```python
# tests/test_sales_integration.py
class SalesIntegrationTestCase(TestCase):
    def test_complete_sale_workflow(self):
        # Create inventory
        inventory = Inventory.objects.create(...)
        
        # Create and process sale
        sale = self.create_sale_with_items()
        
        # Verify inventory updated
        inventory.refresh_from_db()
        self.assertEqual(inventory.available_quantity, 95)
        
        # Verify audit log created
        audit_logs = AuditLog.objects.filter(entity_id=str(sale.id))
        self.assertEqual(audit_logs.count(), 1)
```

## API Tests

```python
# tests/test_api.py
from rest_framework.test import APITestCase

class MedicineAPITestCase(APITestCase):
    def setUp(self):
        self.medicine = Medicine.objects.create(...)
    
    def test_medicine_search_api(self):
        url = '/api/v1/inventory/medicines/search_medicine/?q=aspirin'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)
```

## Frontend Tests

```typescript
// tests/components/Header.test.tsx
import { render, screen } from '@testing-library/react';
import { Header } from './Header';

describe('Header Component', () => {
  test('renders logout button', () => {
    render(<Header />);
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });
  
  test('displays username', () => {
    render(<Header />);
    expect(screen.getByText('john_doe')).toBeInTheDocument();
  });
});
```

## E2E Tests

```javascript
// tests/e2e/sales.spec.ts
describe('Sales Flow', () => {
  it('should complete a sale transaction', () => {
    cy.visit('/sales');
    cy.get('[data-testid="search-medicine"]').type('Aspirin');
    cy.get('[data-testid="medicine-item"]').first().click();
    cy.get('[data-testid="quantity-input"]').clear().type('2');
    cy.get('[data-testid="add-to-cart"]').click();
    cy.get('[data-testid="checkout"]').click();
    cy.get('[data-testid="payment-method-cash"]').click();
    cy.get('[data-testid="confirm-payment"]').click();
    
    cy.contains('Payment Successful').should('be.visible');
  });
});
```

## Performance Tests

```python
# tests/test_performance.py
from django.test import TestCase
import time

class PerformanceTestCase(TestCase):
    def test_billing_performance(self):
        start = time.time()
        
        # Simulate billing
        sale = self.create_sale_with_100_items()
        
        elapsed = time.time() - start
        self.assertLess(elapsed, 2.0, "Billing took more than 2 seconds")
```

## Load Tests

```bash
# Using locust
locust -f tests/load_tests.py --host=http://localhost:8000

# Using apache bench
ab -n 10000 -c 100 http://localhost:8000/api/v1/inventory/medicines/
```

## Security Tests

```bash
# OWASP ZAP
zaproxy -cmd -quickurl http://localhost:8000 \
  -quickout security_report.html

# Bandit (Python security)
bandit -r backend/apps

# npm audit (JavaScript)
cd frontend-web
npm audit
```

## Test Coverage

- Target: 80%+ code coverage
- Critical paths: 100% coverage
- Run coverage report: `pytest --cov=apps`

## CI/CD Testing Pipeline

- Unit tests on every commit
- Integration tests on pull requests
- E2E tests before merge to main
- Performance tests weekly
- Security scans on main branch
