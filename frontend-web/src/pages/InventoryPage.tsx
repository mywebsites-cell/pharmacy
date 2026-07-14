import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, Upload, X, AlertCircle, CheckCircle2, FileSpreadsheet, AlertTriangle, Calendar, Zap, Download } from 'lucide-react';
import api, { rankMedicineResults } from '../services/api';
import { useAuthStore } from '../store';
import { toast } from '../components/toast';
import { useConfirm } from '../components/ConfirmModal';

const COLUMNS = [
  { key: 'generic_name', label: 'Generic Name', required: true },
  { key: 'brand_name', label: 'Brand Name', required: false },
  { key: 'dosage_form', label: 'Dosage Form', required: false },
  { key: 'strength', label: 'Strength', required: false },
  { key: 'purchase_price', label: 'Purchase Price', required: false },
  { key: 'selling_price', label: 'Selling Price', required: false },
  { key: 'reorder_level', label: 'Reorder Level', required: false },
  { key: 'quantity_on_hand', label: 'Stock Qty', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'manufacturing_date', label: 'Manufacturing Date', required: true },
  { key: 'expiry_date', label: 'Expiry Date', required: true },
  { key: 'barcode', label: 'Barcode', required: false },
];

const TEMPLATE_CSV = `generic_name,brand_name,dosage_form,strength,purchase_price,selling_price,reorder_level,quantity_on_hand,category,manufacturing_date,expiry_date,barcode
Aspirin,Bayer,Tablet,500mg,30,50,20,100,Painkillers,2025-01-15,2027-01-15,8901234567001
Paracetamol,Crocin,Tablet,650mg,25,40,30,150,Painkillers,2025-02-10,2027-02-10,8901234567002`;

// Returns { label, color, daysLeft } for a given expiry date string
function getExpiryStatus(expiryDate: string) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Expired', color: 'bg-red-100 text-red-700 border-red-200', row: 'bg-red-50', daysLeft };
  if (daysLeft <= 30) return { label: `Exp in ${daysLeft}d`, color: 'bg-orange-100 text-orange-700 border-orange-200', row: 'bg-orange-50', daysLeft };
  if (daysLeft <= 90) return { label: `Exp in ${daysLeft}d`, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', row: 'bg-yellow-50', daysLeft };
  return { label: exp.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }), color: 'bg-green-50 text-green-700 border-green-100', row: '', daysLeft };
}

function parseSheet(raw: string): { headers: string[]; rows: any[]; errors: string[] } {
  const errors: string[] = [];
  const lines = raw.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    errors.push('Needs at least a header row and one data row.');
    return { headers: [], rows: [], errors };
  }

  // Detect separator: tab (Excel paste) or comma (CSV)
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  const normalizeCell = (header: string, value: string) => {
    if (header !== 'barcode') return value;

    const trimmed = value.trim();
    if (!/^[+-]?\d+(\.\d+)?e[+-]?\d+$/i.test(trimmed)) {
      return trimmed;
    }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      return trimmed;
    }

    return Math.trunc(numeric).toLocaleString('en-US', { useGrouping: false });
  };

  const rows = lines.slice(1).map((line, i) => {
    const cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    const row: any = {};
    headers.forEach((h, j) => { row[h] = normalizeCell(h, cells[j] || ''); });
    if (!row.generic_name) errors.push(`Row ${i + 2}: generic_name is required.`);
    return row;
  });

  return { headers, rows, errors };
}

function normalizeDateForInput(value: string | null | undefined) {
  if (!value) return '';

  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const isoPrefixMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (isoPrefixMatch) return isoPrefixMatch[1];

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function InventoryPage() {
  const isElectron = !!(window as any).electronAPI;
  const features = useAuthStore((state) => state.features);
  const confirm = useConfirm();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [originalQty, setOriginalQty] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [flashMessage, setFlashMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkParsed, setBulkParsed] = useState<{ headers: string[]; rows: any[]; errors: string[] } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; updated: number; failed: number } | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visibleCount, setVisibleCount] = useState(200);
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'soon30' | 'soon90'>('all');
  const [formData, setFormData] = useState({
    generic_name: '', brand_name: '', dosage_form: '', strength: '',
    purchase_price: '', selling_price: '', reorder_level: '', quantity_on_hand: '', category: '', barcode: '',
    manufacturer: '',
    manufacturing_date: '', expiry_date: ''
  });

  useEffect(() => { fetchMedicines(); }, []);

  useEffect(() => {
    if (!flashMessage) return;
    const timeoutId = window.setTimeout(() => setFlashMessage(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [flashMessage]);

  const getErrorMessage = (error: any, fallback: string) =>
    error?.response?.data?.detail || error?.response?.data?.error || error?.message || fallback;

  const resetMedicineForm = () => {
    setFormData({ generic_name: '', brand_name: '', dosage_form: '', strength: '', purchase_price: '', selling_price: '', reorder_level: '', quantity_on_hand: '', category: '', barcode: '', manufacturer: '', manufacturing_date: '', expiry_date: '' });
    setEditingId(null);
    setOriginalQty(0);
  };

  const resetBulkModal = () => {
    setShowBulkModal(false);
    setBulkText('');
    setBulkParsed(null);
    setBulkResult(null);
  };

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const response = await api.get('/inventory/medicines/');
      setMedicines(response.data?.results || response.data || []);
    } catch (error) {
      console.error('Error fetching medicines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setVisibleCount(200);
    if (query.length > 0) {
      try {
        const response = await api.get(`/inventory/medicines/?search=${query}`);
        const items = response.data?.results || response.data || [];
        setMedicines(rankMedicineResults(items, query));
      } catch (error) { console.error('Search error:', error); }
    } else if (query.length === 0) { fetchMedicines(); }
  };

  const autoPurchase = async (medicineId: any, medicineName: string, qty: number, costPerUnit: number) => {
    if (qty <= 0) return;
    try {
      await api.post('/purchases/', {
        items: [{ medicine: medicineId, medicine_name: medicineName, quantity_purchased: qty, cost_per_unit: Number(costPerUnit) || 0 }],
        supplier_name: 'Inventory Addition',
        total_cost: qty * (Number(costPerUnit) || 0),
        notes: `Auto-recorded from inventory: ${medicineName}`,
      });
    } catch (err) {
      console.warn('Auto-purchase record failed (non-critical):', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.manufacturing_date) { toast.warning('Manufacturing date is required.'); return; }
    if (!formData.expiry_date) { toast.warning('Expiry date is required.'); return; }
    const submitData = isElectron
      ? formData
      : (({ manufacturer, ...rest }) => rest)(formData);
    try {
      if (editingId) {
        await api.put(`/inventory/medicines/${editingId}/`, submitData);
        const newQty = Number(formData.quantity_on_hand) || 0;
        const delta = newQty - originalQty;
        if (delta > 0) {
          await autoPurchase(editingId, formData.generic_name, delta, Number(formData.purchase_price));
        }
      } else {
        const res = await api.post('/inventory/medicines/', submitData);
        const savedId = res.data?.id ?? res.data?.data?.id;
        // NOTE: Don't create purchase record for new medicines - stock is already set correctly
        // Only create purchase records for quantity updates/modifications
        // if (savedId && qty > 0) {
        //   await autoPurchase(savedId, formData.generic_name, qty, Number(formData.purchase_price));
        // }
      }
      await fetchMedicines();
      setShowModal(false);
      resetMedicineForm();
      setFlashMessage({ type: 'success', text: editingId ? 'Medicine updated successfully.' : 'Medicine added successfully.' });
    } catch (error: any) {
      if (error.response?.data?.limit_reached) {
        const message = error.response.data.detail;
        setFlashMessage({ type: 'error', text: message });
      } else {
        const message = getErrorMessage(error, 'Error saving medicine');
        console.error('Error saving medicine:', error);
        setFlashMessage({ type: 'error', text: message });
      }
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ message: 'Delete this medicine? This cannot be undone.', confirmLabel: 'Delete', destructive: true });
    if (ok) {
      try {
        await api.delete(`/inventory/medicines/${id}/`);
      } catch (error) {
        console.error('Error deleting:', error);
        toast.error('Failed to delete medicine.');
      } finally {
        fetchMedicines();
      }
    }
  };

  const handleEdit = (medicine) => {
    const s = (v: any) => (v == null ? '' : String(v));
    setFormData({
      generic_name: s(medicine.generic_name ?? medicine.name),
      brand_name: s(medicine.brand_name ?? medicine.brand),
      dosage_form: s(medicine.dosage_form),
      strength: s(medicine.strength),
      purchase_price: s(medicine.purchase_price),
      selling_price: s(medicine.selling_price),
      reorder_level: s(medicine.reorder_level),
      quantity_on_hand: s(medicine.quantity_on_hand ?? medicine.quantity),
      category: s(medicine.category),
      barcode: s(medicine.barcode),
      manufacturer: s(medicine.manufacturer),
      manufacturing_date: normalizeDateForInput(medicine.manufacturing_date),
      expiry_date: normalizeDateForInput(medicine.expiry_date),
    });
    setEditingId(medicine.id);
    setOriginalQty(Number(medicine.quantity_on_hand ?? medicine.quantity) || 0);
    setShowModal(true);
  };

  // Bulk import handlers
  const handleBulkTextChange = (text: string) => {
    setBulkText(text);
    setBulkResult(null);
    if (text.trim()) {
      setBulkParsed(parseSheet(text));
    } else {
      setBulkParsed(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setBulkText(text);
      setBulkParsed(parseSheet(text));
      setBulkResult(null);
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (!bulkParsed || bulkParsed.rows.length === 0) return;
    setBulkLoading(true);
    setBulkResult(null);
    setBulkProgress(null);
    
    const startTime = Date.now();
    const items = bulkParsed.rows.filter(r => r.generic_name);
    const totalItems = items.length;
    const CHUNK_SIZE = 500; // Process 500 items per batch for optimal performance
    const isLargeImport = totalItems >= 1000;
    
    try {
      let totalCreated = 0, totalUpdated = 0, totalFailed = 0;
      let savedMeds: any[] = [];
      
      // Process items in chunks to avoid memory/timeout issues with 10k+ items
      for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
        const chunk = items.slice(i, Math.min(i + CHUNK_SIZE, totalItems));
        const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(totalItems / CHUNK_SIZE);
        
        // Update progress
        const current = Math.min(i + CHUNK_SIZE, totalItems);
        const percentage = Math.round((current / totalItems) * 100);
        setBulkProgress({ current, total: totalItems, percentage });
        
        if (isLargeImport) {
          console.log(`Processing chunk ${chunkNum}/${totalChunks} (${chunk.length} items)...`);
        }
        
        const response = await api.post('/inventory/medicines/bulk/', { items: chunk });
        const { created = 0, updated = 0, failed = 0, results = [] } = response.data || {};
        
        totalCreated += created;
        totalUpdated += updated;
        totalFailed += failed;
        savedMeds = savedMeds.concat(results || []);
        
        // Small delay between chunks to keep UI responsive (only for large imports)
        if (isLargeImport && i + CHUNK_SIZE < totalItems) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      if (isLargeImport) {
        console.log(`Bulk import complete: ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed in ${elapsed}s (${Math.round(totalItems / parseFloat(elapsed))} items/sec)`);
      }
      
      setBulkResult({ created: totalCreated, updated: totalUpdated, failed: totalFailed });
      
      // On the web, the backend bulk endpoint already creates purchase records and increments stock.
      // Only create purchase records here on desktop (Electron), where the IPC handler does not.
      if (isElectron && savedMeds.length > 0) {
        const savedIdMap = new Map<string, any>(
          savedMeds.map((s: any) => [(s.generic_name || s.name || '').toLowerCase().trim(), s])
        );
        const stockItems = items
          .filter((r: any) => Number(r.quantity_on_hand) > 0)
          .map((r: any) => {
            const saved = savedIdMap.get((r.generic_name || '').toLowerCase().trim());
            return {
              id: saved?.id,
              generic_name: r.generic_name,
              quantity_on_hand: r.quantity_on_hand,
              purchase_price: r.purchase_price || saved?.purchase_price,
            };
          });
        if (stockItems.length > 0) {
          try {
            await api.post('/purchases/', {
              items: stockItems.map((m: any) => ({
                medicine: m.id,
                medicine_name: m.generic_name || '',
                quantity_purchased: Number(m.quantity_on_hand),
                cost_per_unit: Number(m.purchase_price) || 0,
              })),
              supplier_name: 'Inventory Addition',
              total_cost: stockItems.reduce((s: number, m: any) => s + Number(m.quantity_on_hand) * (Number(m.purchase_price) || 0), 0),
              notes: 'Auto-recorded from bulk import',
            });
          } catch (err) {
            console.warn('Bulk auto-purchase record failed (non-critical):', err);
          }
        }
      }
      
      await fetchMedicines();
      setFlashMessage({
        type: 'success',
        text: [
          totalCreated > 0 ? `${totalCreated} medicines added` : '',
          totalUpdated > 0 ? `${totalUpdated} medicines updated` : '',
          isLargeImport ? `(${elapsed}s, ${Math.round(totalItems / parseFloat(elapsed))} items/sec)` : '',
        ].filter(Boolean).join(' · ') || 'Medicines imported successfully.',
      });
      resetBulkModal();
    } catch (error: any) {
      const message = getErrorMessage(error, 'Import failed. Please check your data and try again.');
      console.error('Bulk import error:', error);
      setBulkResult({ created: 0, updated: 0, failed: bulkParsed.rows.length });
      setFlashMessage({ type: 'error', text: message });
    } finally {
      setBulkLoading(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medicines_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute expiry summary counts
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiredList = medicines.filter((m: any) => m.expiry_date && new Date(m.expiry_date) < today);
  const expiring30 = medicines.filter((m: any) => { if (!m.expiry_date) return false; const d = Math.ceil((new Date(m.expiry_date).getTime() - today.getTime()) / 86400000); return d >= 0 && d <= 30; });
  const expiring90 = medicines.filter((m: any) => { if (!m.expiry_date) return false; const d = Math.ceil((new Date(m.expiry_date).getTime() - today.getTime()) / 86400000); return d > 30 && d <= 90; });

  const displayedMedicines = medicines.filter((m: any) => {
    if (expiryFilter === 'all') return true;
    if (!m.expiry_date) return false;
    const d = Math.ceil((new Date(m.expiry_date).getTime() - today.getTime()) / 86400000);
    if (expiryFilter === 'expired') return d < 0;
    if (expiryFilter === 'soon30') return d >= 0 && d <= 30;
    if (expiryFilter === 'soon90') return d > 30 && d <= 90;
    return true;
  });

  const currentItems = displayedMedicines.slice(0, visibleCount);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {flashMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${flashMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {flashMessage.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
          {features?.max_medicines != null && (
            <div className="mt-1 flex items-center gap-2">
              <div className="w-40 bg-gray-200 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (medicines.length / features.max_medicines) * 100)}%` }} />
              </div>
              <span className={`text-xs font-medium ${medicines.length >= features.max_medicines ? 'text-red-600' : 'text-gray-500'}`}>
                {medicines.length} / {features.max_medicines} medicines used
              </span>
              {medicines.length >= features.max_medicines && (
                <a href="/subscribe" className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Zap size={10} /> Upgrade</a>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => { setShowBulkModal(true); setBulkResult(null); }}
            className="bg-green-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-green-700 text-sm font-semibold shadow-sm transition whitespace-nowrap"
          >
            <FileSpreadsheet size={17} /> Bulk Import
          </button>
          <button
            onClick={() => { setShowModal(true); resetMedicineForm(); }}
            disabled={features?.max_medicines != null && medicines.length >= features.max_medicines}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-700 text-sm font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
          >
            <Plus size={17} /> Add Medicine
          </button>
        </div>
      </div>

      {/* Expiry Alert Cards */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => { setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired'); setVisibleCount(200); }}
          className={`rounded-xl border p-4 text-left transition ${expiryFilter === 'expired' ? 'ring-2 ring-red-400' : ''} ${expiredList.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} className="text-red-500" />
            <span className="text-xs font-medium text-red-600">Expired</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{expiredList.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">items past expiry</p>
        </button>
        <button onClick={() => { setExpiryFilter(expiryFilter === 'soon30' ? 'all' : 'soon30'); setVisibleCount(200); }}
          className={`rounded-xl border p-4 text-left transition ${expiryFilter === 'soon30' ? 'ring-2 ring-orange-400' : ''} ${expiring30.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} className="text-orange-500" />
            <span className="text-xs font-medium text-orange-600">Expiring ≤ 30 days</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{expiring30.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">items expiring soon</p>
        </button>
        <button onClick={() => { setExpiryFilter(expiryFilter === 'soon90' ? 'all' : 'soon90'); setVisibleCount(200); }}
          className={`rounded-xl border p-4 text-left transition ${expiryFilter === 'soon90' ? 'ring-2 ring-yellow-400' : ''} ${expiring90.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={18} className="text-yellow-600" />
            <span className="text-xs font-medium text-yellow-700">Expiring ≤ 90 days</span>
          </div>
          <p className="text-2xl font-bold text-yellow-700">{expiring90.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">items to watch</p>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, brand, or barcode..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
          {expiryFilter !== 'all' && (
            <button onClick={() => setExpiryFilter('all')} className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600 whitespace-nowrap">
              <X size={14} /> Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : displayedMedicines.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-30" />
            <p>{expiryFilter !== 'all' ? 'No medicines match this expiry filter.' : <>No medicines yet. Use <strong>Bulk Import</strong> to add many at once.</>}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Generic Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Brand</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Form / Strength</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Stock</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Expiry</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Price (Rs)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((medicine: any) => {
                  const expStatus = getExpiryStatus(medicine.expiry_date);
                  return (
                    <tr key={medicine.id} className={`border-b hover:opacity-90 ${expStatus?.row || 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 font-medium">{medicine.generic_name || medicine.name}</td>
                      <td className="px-4 py-3 text-gray-600">{medicine.brand_name || medicine.brand}</td>
                      <td className="px-4 py-3 text-gray-600">{[medicine.dosage_form, medicine.strength].filter(Boolean).join(' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${(medicine.quantity_on_hand ?? medicine.quantity) <= (medicine.reorder_level || 20) ? 'text-red-600' : 'text-green-600'}`}>
                          {medicine.quantity_on_hand ?? medicine.quantity ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {expStatus ? (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full border ${expStatus.color}`}>{expStatus.label}</span>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">{medicine.selling_price || medicine.price}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => handleEdit(medicine)} className="text-blue-600 hover:text-blue-800 p-1"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(medicine.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {displayedMedicines.length > visibleCount && (
          <div className="flex justify-center items-center px-4 py-4 border-t bg-gray-50 mt-4 rounded-b-xl">
            <button
              onClick={() => setVisibleCount(v => v + 200)}
              className="px-6 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition shadow-sm"
            >
              Load More (Showing {visibleCount} of {displayedMedicines.length})
            </button>
          </div>
        )}
      </div>

      {/* Single Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-0 w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Plus size={18} className="text-blue-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Medicine' : 'Add Medicine'}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Generic Name <span className="text-red-500">*</span></label>
                <input type="text" value={formData.generic_name} onChange={(e) => setFormData({...formData, generic_name: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Brand Name</label>
                <input type="text" value={formData.brand_name} onChange={(e) => setFormData({...formData, brand_name: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dosage Form</label>
                  <input type="text" placeholder="e.g. Tablet, Syrup" value={formData.dosage_form} onChange={(e) => setFormData({...formData, dosage_form: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Strength</label>
                  <input type="text" placeholder="e.g. 500mg" value={formData.strength} onChange={(e) => setFormData({...formData, strength: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Price (Rs)</label>
                  <input type="number" min="0" step="0.01" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Selling Price (Rs)</label>
                  <input type="number" min="0" step="0.01" value={formData.selling_price} onChange={(e) => setFormData({...formData, selling_price: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Stock Quantity</label>
                  <input type="number" min="0" value={formData.quantity_on_hand} onChange={(e) => setFormData({...formData, quantity_on_hand: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Level</label>
                  <input type="number" min="0" value={formData.reorder_level} onChange={(e) => setFormData({...formData, reorder_level: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <input type="text" placeholder="e.g. Painkillers, Antibiotics" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              {isElectron && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Manufacturer</label>
                  <input type="text" placeholder="e.g. GSK, Bayer" value={formData.manufacturer} onChange={(e) => setFormData({...formData, manufacturer: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Manufacturing Date <span className="text-red-500">*</span></label>
                  <input type="date" value={formData.manufacturing_date} onChange={(e) => setFormData({...formData, manufacturing_date: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date <span className="text-red-500">*</span></label>
                  <input type="date" value={formData.expiry_date} onChange={(e) => setFormData({...formData, expiry_date: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Barcode (Optional)</label>
                <input type="text" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" placeholder="Leave blank if not available" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-sm transition">Save Medicine</button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] border border-gray-100">

            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Upload size={20} className="text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Bulk Import Medicines</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Upload a CSV or paste data from Excel / Google Sheets</p>
                </div>
              </div>
              <button
                onClick={resetBulkModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => handleBulkTextChange(ev.target?.result as string || '');
                    reader.readAsText(file);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all p-8 text-center
                  ${isDragging
                    ? 'border-green-400 bg-green-50 scale-[1.01]'
                    : 'border-gray-200 hover:border-green-400 hover:bg-green-50/50 bg-gray-50'}`}
              >
                <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileUpload} />
                <Upload size={36} className={`mx-auto mb-3 transition-colors ${isDragging ? 'text-green-500' : 'text-gray-300'}`} />
                <p className="text-sm font-semibold text-gray-700">
                  {isDragging ? 'Drop your file here' : 'Drag & drop your CSV file here'}
                </p>
                <p className="text-xs text-gray-400 mt-1">or <span className="text-green-600 font-medium">click to browse</span> — supports .csv, .tsv, .txt</p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">OR PASTE DATA BELOW</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Paste Area */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Paste from Excel / Google Sheets</label>
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                  >
                    <Download size={13} /> Download template
                  </button>
                </div>
                <textarea
                  value={bulkText}
                  onChange={(e) => handleBulkTextChange(e.target.value)}
                  rows={5}
                  placeholder={`generic_name\tbrand_name\tselling_price\nAspirin\tBayer\t50\nParacetamol\tCrocin\t40`}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none bg-gray-50 placeholder:text-gray-300 transition"
                />
              </div>

              {/* How-to hint */}
              {!bulkParsed && (
                <div className="flex gap-4 text-xs text-gray-500">
                  {[['1', 'Open Excel or Sheets'], ['2', 'Copy all cells (Ctrl+A, Ctrl+C)'], ['3', 'Paste above & review'], ['4', 'Click Import']].map(([n, t]) => (
                    <div key={n} className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-xs flex-shrink-0">{n}</span>
                      {t}
                    </div>
                  ))}
                </div>
              )}

              {/* Parse Errors */}
              {bulkParsed?.errors && bulkParsed.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5"><AlertCircle size={14} /> Issues found:</p>
                  {bulkParsed.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-600 pl-5">• {e}</div>
                  ))}
                </div>
              )}

              {/* Import Result */}
              {bulkResult && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border ${
                  (bulkResult.created + bulkResult.updated) > 0
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <CheckCircle2 size={18} className="flex-shrink-0" />
                  {(bulkResult.created + bulkResult.updated) > 0
                    ? [
                        bulkResult.created > 0 && `${bulkResult.created} medicines added`,
                        bulkResult.updated > 0 && `${bulkResult.updated} updated`,
                        bulkResult.failed > 0 && `${bulkResult.failed} skipped`,
                      ].filter(Boolean).join(' · ') + '.'
                    : 'Import failed. Please check your data and try again.'}
                </div>
              )}

              {/* Progress Bar for Large Imports */}
              {bulkLoading && bulkProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-700">Processing items...</span>
                    <span className="text-gray-500 font-semibold">
                      {bulkProgress.current.toLocaleString()} / {bulkProgress.total.toLocaleString()} ({bulkProgress.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300 ease-out rounded-full shadow-sm"
                      style={{ width: `${bulkProgress.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Processing in {Math.ceil(bulkProgress.total / 500)} chunks of 500 items each for optimal performance
                  </p>
                </div>
              )}

              {/* Preview Table */}
              {bulkParsed && bulkParsed.rows.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-800">
                      Preview
                      <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                        {bulkParsed.rows.length} row{bulkParsed.rows.length > 1 ? 's' : ''}
                      </span>
                    </p>
                    {bulkParsed.errors.length === 0 && (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Ready to import</span>
                    )}
                  </div>
                  <div className="overflow-x-auto border border-gray-100 rounded-xl shadow-sm">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-gray-400 font-medium w-8">#</th>
                          {bulkParsed.headers.map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h.replace(/_/g, ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bulkParsed.rows.slice(0, 10).map((row, i) => (
                          <tr key={i} className={`border-b border-gray-50 ${!row.generic_name ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                            <td className="px-3 py-2 text-gray-300 font-mono">{i + 1}</td>
                            {bulkParsed.headers.map(h => (
                              <td key={h} className="px-3 py-2 whitespace-nowrap text-gray-700">{row[h] || <span className="text-gray-200">—</span>}</td>
                            ))}
                          </tr>
                        ))}
                        {bulkParsed.rows.length > 10 && (
                          <tr className="bg-gray-50">
                            <td colSpan={bulkParsed.headers.length + 1} className="px-3 py-2 text-center text-gray-400 text-xs">
                              + {bulkParsed.rows.length - 10} more rows not shown
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/80 rounded-b-2xl">
              <p className="text-xs text-gray-400">
                {bulkParsed
                  ? <span className="text-green-600 font-semibold">{bulkParsed.rows.filter(r => r.generic_name).length} valid rows ready</span>
                  : 'Upload a file or paste data above to get started'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={resetBulkModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={!bulkParsed || bulkParsed.rows.filter(r => r.generic_name).length === 0 || bulkLoading}
                  className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition"
                >
                  {bulkLoading
                    ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Importing...</>
                    : <><Upload size={15} />Import {bulkParsed?.rows.filter(r => r.generic_name).length || 0} Medicines</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
