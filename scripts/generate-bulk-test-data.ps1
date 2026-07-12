# Bulk Import Test Data Generator
# Generates CSV files with test pharmacy data for performance testing

param(
    [Parameter(Mandatory=$false)]
    [int]$ItemCount = 1000,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "test-import-data.csv"
)

Write-Host "🧪 Generating $ItemCount test pharmacy items..." -ForegroundColor Cyan

# Sample medicine categories
$categories = @('Analgesics', 'Antibiotics', 'Antihypertensives', 'Antidiabetics', 'Antihistamines', 
                'Vitamins', 'Supplements', 'Cardiac', 'Respiratory', 'Gastrointestinal')

# Sample manufacturers
$manufacturers = @('Cipla', 'Sun Pharma', 'Lupin', 'Dr Reddy', 'Abbott', 'GSK', 'Pfizer', 
                   'Ranbaxy', 'Aurobindo', 'Torrent')

# Generate CSV header
$csv = @('generic_name,brand_name,category,barcode,purchase_price,selling_price,mrp,quantity_on_hand,min_quantity,max_quantity,batch_no,manufacturing_date,expiry_date,supplier,status')

# Generate items
$startDate = Get-Date "2024-01-01"
$endDate = Get-Date "2027-12-31"

for ($i = 1; $i -le $ItemCount; $i++) {
    $category = $categories[(Get-Random -Maximum $categories.Count)]
    $manufacturer = $manufacturers[(Get-Random -Maximum $manufacturers.Count)]
    
    $genericName = "TestMedicine$i"
    $brandName = "Brand$manufacturer$i"
    $barcode = "TEST{0:D13}" -f $i
    
    # Random pricing
    $purchasePrice = [math]::Round((Get-Random -Minimum 10 -Maximum 500), 2)
    $sellingPrice = [math]::Round($purchasePrice * (1 + (Get-Random -Minimum 15 -Maximum 50) / 100), 2)
    $mrp = [math]::Round($sellingPrice * (1 + (Get-Random -Minimum 5 -Maximum 15) / 100), 2)
    
    # Random stock quantities
    $quantity = Get-Random -Minimum 0 -Maximum 500
    $minQty = Get-Random -Minimum 5 -Maximum 20
    $maxQty = Get-Random -Minimum 100 -Maximum 500
    
    # Random dates
    $mfgDate = $startDate.AddDays((Get-Random -Minimum 0 -Maximum 730))
    $expDate = $mfgDate.AddDays((Get-Random -Minimum 730 -Maximum 1095))
    
    $batchNo = "BATCH{0:D6}" -f (Get-Random -Minimum 1 -Maximum 999999)
    $status = 'active'
    
    # Build CSV row
    $row = "$genericName,$brandName,$category,$barcode,$purchasePrice,$sellingPrice,$mrp,$quantity,$minQty,$maxQty,$batchNo,$($mfgDate.ToString('yyyy-MM-dd')),$($expDate.ToString('yyyy-MM-dd')),$manufacturer,$status"
    $csv += $row
    
    # Progress indicator
    if ($i % 1000 -eq 0) {
        Write-Host "  Generated $i items..." -ForegroundColor Gray
    }
}

# Write to file
$csv | Out-File -FilePath $OutputPath -Encoding UTF8

$fileSize = (Get-Item $OutputPath).Length / 1KB
Write-Host "✅ Generated $ItemCount items" -ForegroundColor Green
Write-Host "📄 File: $OutputPath ($([math]::Round($fileSize, 2)) KB)" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Sample data (first 3 rows):" -ForegroundColor Yellow
$csv[0..3] | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
Write-Host ""
Write-Host "🚀 To test import:" -ForegroundColor Cyan
Write-Host "  1. Open the pharmacy app" -ForegroundColor White
Write-Host "  2. Go to Inventory page" -ForegroundColor White
Write-Host "  3. Click 'Bulk Import' button" -ForegroundColor White
Write-Host "  4. Upload: $OutputPath" -ForegroundColor White
Write-Host ""
Write-Host "⏱️  Expected import time (desktop app):" -ForegroundColor Cyan
if ($ItemCount -lt 500) {
    Write-Host "  < 1 second" -ForegroundColor Green
} elseif ($ItemCount -lt 5000) {
    Write-Host "  ~$([math]::Round($ItemCount / 1000, 1)) seconds" -ForegroundColor Green
} else {
    Write-Host "  ~$([math]::Round($ItemCount / 1000, 1)) seconds" -ForegroundColor Yellow
    Write-Host "  (watch progress bar for updates)" -ForegroundColor Gray
}
Write-Host ""

# Generate performance test instructions
if ($ItemCount -ge 1000) {
    Write-Host "🔬 Performance Testing:" -ForegroundColor Magenta
    Write-Host "  - Check browser console for chunk progress" -ForegroundColor White
    Write-Host "  - Progress bar shows: Current / Total (Percentage)" -ForegroundColor White
    Write-Host "  - Final message includes items/sec metric" -ForegroundColor White
    Write-Host ""
}

# Additional test file recommendations
if ($ItemCount -eq 1000) {
    Write-Host "💡 Suggested additional tests:" -ForegroundColor Yellow
    Write-Host "  .\scripts\generate-bulk-test-data.ps1 -ItemCount 10000    # Stress test" -ForegroundColor Gray
    Write-Host "  .\scripts\generate-bulk-test-data.ps1 -ItemCount 50000    # Extreme test" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "✨ Done!" -ForegroundColor Green
