#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings_desktop')
os.environ.setdefault('MEDICLY_DATA_DIR', os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'medicly-desktop', 'db'))

django.setup()

from django.contrib.auth import get_user_model
from apps.inventory.models import Medicine, MedicineCategory, Manufacturer
from apps.customers.models import Customer

User = get_user_model()

# Create default category and manufacturer if needed
category, _ = MedicineCategory.objects.get_or_create(
    code='GEN',
    defaults={'name': 'General', 'description': 'General medicines'}
)

manufacturer, _ = Manufacturer.objects.get_or_create(
    code='TEST',
    defaults={'name': 'Test Pharma', 'country': 'USA'}
)

# Create test medicines
meds = []
med_names = [
    ('Paracetamol', 'Acetaminophen', '500mg', 100, 50),
    ('Ibuprofen', 'Brufen', '200mg', 200, 75),
    ('Aspirin', 'Aspirin', '100mg', 75, 40),
    ('Amoxicillin', 'Amoxicillin', '250mg', 50, 30),
    ('Metformin', 'Glucophage', '500mg', 150, 80),
]

for generic_name, brand_name, strength, purchase_price, selling_price in med_names:
    med, created = Medicine.objects.get_or_create(
        generic_name=generic_name,
        defaults={
            'brand_name': brand_name,
            'sku': f'SKU-{generic_name[:3].upper()}001',
            'barcode': f'BAR-{generic_name[:4].upper()}001',
            'strength': strength,
            'dosage_form': 'TABLET',
            'packaging_unit': '1 strip of 10',
            'quantity_per_pack': 10,
            'purchase_price': purchase_price,
            'selling_price': selling_price,
            'mrp': selling_price,
            'reorder_level': 10,
            'maximum_stock_level': 500,
            'category': category,
            'manufacturer': manufacturer,
        }
    )
    if created:
        meds.append(med)

# Create test customers
customers = []
for i in range(3):
    try:
        cust, created = Customer.objects.get_or_create(
            phone=f'555-000{i}',
            defaults={
                'first_name': f'Customer{i}',
                'last_name': f'Test{i}',
                'email': f'cust{i}@test.com',
            }
        )
        if created:
            customers.append(cust)
    except Exception as e:
        pass

print(f'✓ Populated database with {len(meds)} medicines and {len(customers)} customers')
