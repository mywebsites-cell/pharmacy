-- Initial database schema
CREATE EXTENSION IF NOT EXISTS uuid-ossp;

-- Create necessary indexes
CREATE INDEX idx_medicines_sku ON apps_common_customuser(email);
CREATE INDEX idx_medicines_barcode ON apps_inventory_medicine(barcode);
CREATE INDEX idx_sales_date ON sales_sale(created_at DESC);
CREATE INDEX idx_inventory_branch ON inventory_inventory(branch_id);
