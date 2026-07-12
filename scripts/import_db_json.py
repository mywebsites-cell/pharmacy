import os
import json
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
# Ensure backend directory is on sys.path so Django can import config
import sys
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)
os.chdir(backend_path)

django.setup()

from django.contrib.auth import get_user_model
from apps.pharmacy.models import Pharmacy, Branch
from apps.inventory.models import MedicineCategory, Manufacturer, Medicine
from apps.customers.models import Customer

User = get_user_model()

DB_JSON_PATH = os.path.join(os.path.dirname(__file__), '..', 'backend', 'db.json')

with open(DB_JSON_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

mock = data.get('mockData', {})
store = data.get('userDataStore', {})

# Create or get a default pharmacy and branch
# Import users first so we can assign an owner to the pharmacy
users = mock.get('users', [])
created_users = 0
for u in users:
    try:
        if 'email' in u and u['email']:
            user, created = User.objects.get_or_create(email=u['email'], defaults={
                'username': u.get('username') or u['email'].split('@')[0],
                'first_name': u.get('first_name', ''),
                'last_name': u.get('last_name', ''),
                'is_staff': True if u.get('role') in ['admin','staff'] else False,
            })
            if created:
                user.set_password(u.get('password', 'password'))
                user.save()
                created_users += 1
    except Exception as e:
        print('User import error:', e)

# Create or get a default pharmacy and branch (assign owner if admin exists)
owner = None
try:
    owner = User.objects.filter(email='admin@pharmacy.com').first()
except Exception:
    owner = None

pharmacy, _ = Pharmacy.objects.get_or_create(
    name='Imported Pharmacy',
    defaults={
        'registration_number': 'IMPORT-001',
        'license_number': 'LIC-IMPORT-001',
        'license_expiry': '2030-01-01',
        'owner': owner,
        'phone_number': '0000000000',
        'email': 'import@pharmacy.local',
        'address_line_1': 'Imported',
        'city': 'Imported',
        'state': 'Imported',
        'country': 'Imported',
        'postal_code': '00000',
    }
)
branch, _ = Branch.objects.get_or_create(
    pharmacy=pharmacy,
    code='MAIN',
    defaults={'name': 'Main Branch'}
)

# Helper for dosage mapping
DOSAGE_MAP = {
    'tablet': 'TABLET',
    'capsule': 'CAPSULE',
    'injection': 'INJECTION',
    'liquid': 'LIQUID',
    'powder': 'POWDER',
    'cream': 'CREAM',
    'ointment': 'OINTMENT',
    'syrup': 'SYRUP'
}

# Import medicines for user 1 (main store) if present
imported_meds = 0
for user_id, content in store.items():
    meds = content.get('medicines', [])
    for m in meds:
        try:
            cat_name = m.get('category') or 'Uncategorized'
            category, _ = MedicineCategory.objects.get_or_create(name=cat_name, defaults={'description': '' , 'code': cat_name[:10].upper()})
            manu_name = m.get('brand_name') or 'Unknown'
            manufacturer, _ = Manufacturer.objects.get_or_create(name=manu_name, defaults={'code': manu_name[:10].upper(), 'country': 'Imported'})
            dosage = m.get('dosage_form', 'Tablet') or 'Tablet'
            dosage_key = DOSAGE_MAP.get(dosage.lower(), 'TABLET')
            sku = m.get('barcode') or f"SKU-{m.get('id') or ''}-{manu_name[:4]}"
            medicine, created = Medicine.objects.get_or_create(
                barcode=m.get('barcode') or None,
                defaults={
                    'generic_name': m.get('generic_name',''),
                    'brand_name': m.get('brand_name',''),
                    'sku': sku,
                    'category': category,
                    'manufacturer': manufacturer,
                    'dosage_form': dosage_key,
                    'strength': m.get('strength',''),
                    'packaging_unit': '1 pack',
                    'quantity_per_pack': 1,
                    'prescription_required': False,
                    'is_controlled_drug': False,
                    'gst_category': '5%',
                    'purchase_price': Decimal(str(m.get('purchase_price', 0))),
                    'selling_price': Decimal(str(m.get('selling_price', 0))),
                    'mrp': Decimal(str(m.get('selling_price', 0))),
                    'wholesale_price': None,
                    'reorder_level': m.get('reorder_level', 10),
                    'maximum_stock_level': 1000,
                }
            )
            if created:
                imported_meds += 1
        except Exception as e:
            print('Medicine import error:', e)

# Import customers
imported_customers = 0
for user_id, content in store.items():
    customers = content.get('customers', [])
    for c in customers:
        try:
            phone = c.get('phone') or c.get('phone_number') or None
            if not phone:
                continue
            cust, created = Customer.objects.get_or_create(
                phone=phone,
                defaults={
                    'pharmacy': pharmacy,
                    'first_name': c.get('first_name',''),
                    'last_name': c.get('last_name',''),
                    'email': c.get('email',''),
                    'loyalty_balance': Decimal(str(c.get('loyalty_balance',0))) if c.get('loyalty_balance') is not None else 0,
                    'outstanding_balance': Decimal(str(c.get('outstanding_balance',0))) if c.get('outstanding_balance') is not None else 0,
                    'is_vip': c.get('is_vip', False),
                }
            )
            if created:
                imported_customers += 1
        except Exception as e:
            print('Customer import error:', e)

print(f"Imported users: {created_users}")
print(f"Imported medicines: {imported_meds}")
print(f"Imported customers: {imported_customers}")
