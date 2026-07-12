import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import api from '../services/api';
import { toast } from '../components/toast';

export default function PurchasesPage() {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMedicines, setFilteredMedicines] = useState<any[]>([]);

  useEffect(() => {
    fetchMedicines();
    fetchPurchases();
  }, []);

  useEffect(() => {
    const filtered = medicines.filter(m =>
      m.generic_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.brand_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredMedicines(filtered);
  }, [searchQuery, medicines]);

  const fetchMedicines = async () => {
    try {
      const res = await api.get('/inventory/medicines/');
      setMedicines((res.data.results || res.data || []).sort((a: any, b: any) => a.generic_name.localeCompare(b.generic_name)));
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
    }
  };

  const fetchPurchases = async () => {
    try {
      const res = await api.get('/purchases/', { params: { limit: 1500 } });
      setPurchases((res.data.results || res.data || [])
        .map((p: any) => ({ ...p, _timestamp: new Date(p.date || p.created_at).getTime() }))
        .sort((a: any, b: any) => b._timestamp - a._timestamp)
      );
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
    }
  };

  const addItem = (medicine: any) => {
    if (purchaseItems.some(item => item.medicine === medicine.id)) {
      toast.warning('Medicine already added to this purchase.');
      return;
    }
    setPurchaseItems([
      ...purchaseItems,
      {
        medicine: medicine.id,
        medicine_name: medicine.generic_name,
        brand_name: medicine.brand_name,
        quantity_purchased: 0,
        purchase_price: medicine.purchase_price || 0
      }
    ]);
    setSearchQuery('');
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...purchaseItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setPurchaseItems(updated);
  };

  const removeItem = (idx: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== idx));
  };

  const submitPurchase = async () => {
    if (!supplier || purchaseItems.filter(i => i.quantity_purchased > 0).length === 0) {
      toast.warning('Please enter a supplier name and add at least one item with quantity.');
      return;
    }

    try {
      setLoading(true);
      const purchasedItems = purchaseItems.filter(i => i.quantity_purchased > 0);
      const total = purchasedItems.reduce((sum, i) => sum + (i.purchase_price * i.quantity_purchased), 0);

      await api.post('/purchases/', {
        items: purchasedItems.map(item => ({
          medicine: item.medicine,
          quantity_purchased: item.quantity_purchased,
          cost_per_unit: item.purchase_price
        })),
        supplier_name: supplier,
        total_cost: total,
        notes
      });

      setSuccessMessage(`Purchase recorded! Total: Rs ${total.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setPurchaseItems([]);
      setSupplier('');
      setNotes('');
      setShowForm(false);
      fetchPurchases();
      fetchMedicines();
    } catch (error) {
      console.error('Failed to record purchase:', error);
      toast.error('Failed to record purchase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const totalCost = purchaseItems.reduce((sum, i) => sum + (i.purchase_price * i.quantity_purchased), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Stock Purchases</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition text-sm font-medium"
          >
            <Plus size={18} /> New Purchase
          </button>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Record Stock Purchase</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Name *</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g., ABC Pharma"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Add Medicines</label>
            <div className="relative mb-2">
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or brand..."
                className="w-full border rounded-lg px-10 py-2 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            {searchQuery && filteredMedicines.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {filteredMedicines.slice(0, 10).map(medicine => (
                  <button
                    key={medicine.id}
                    onClick={() => addItem(medicine)}
                    className="w-full text-left p-3 border-b hover:bg-blue-50 transition text-sm"
                  >
                    <div className="font-medium text-gray-800">{medicine.generic_name}</div>
                    <div className="text-xs text-gray-600">{medicine.brand_name} • Stock: {medicine.quantity_on_hand}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Purchase Items */}
          {purchaseItems.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Purchase Items</label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700">Medicine</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-700">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Unit Cost</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Total</th>
                      <th className="text-center px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseItems.map((item, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800">{item.medicine_name}</div>
                          <div className="text-xs text-gray-500">{item.brand_name}</div>
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={item.quantity_purchased}
                            onChange={(e) => updateItem(idx, 'quantity_purchased', parseInt(e.target.value) || 0)}
                            className="w-16 border rounded px-2 py-1 text-center text-sm"
                          />
                        </td>
                        <td className="text-right px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.purchase_price}
                            onChange={(e) => updateItem(idx, 'purchase_price', parseFloat(e.target.value) || 0)}
                            className="w-20 border rounded px-2 py-1 text-right text-sm"
                          />
                        </td>
                        <td className="text-right px-3 py-2 font-semibold text-gray-800">
                          Rs {(item.purchase_price * item.quantity_purchased).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-center px-3 py-2">
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-red-600 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-right border-t pt-4">
                <p className="text-lg font-bold text-gray-800">
                  Total Cost: Rs {totalCost.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowForm(false);
                setPurchaseItems([]);
                setSupplier('');
                setNotes('');
                setSearchQuery('');
              }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={submitPurchase}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition text-sm font-medium"
            >
              {loading ? 'Recording...' : 'Record Purchase'}
            </button>
          </div>
        </div>
      )}

      {/* Purchases History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Purchase History</h2>
        </div>
        
        {purchases.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No purchases recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-gray-700">Date</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-700">Supplier</th>
                  <th className="text-center px-6 py-3 font-semibold text-gray-700">Items</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-700">Notes</th>
                  <th className="text-right px-6 py-3 font-semibold text-gray-700">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-3">{new Date(purchase.date).toLocaleDateString('en-PK')}</td>
                    <td className="px-6 py-3 font-medium text-gray-800">{purchase.supplier_name}</td>
                    <td className="px-6 py-3 text-center">{purchase.items?.length || 0}</td>
                    <td className="px-6 py-3 text-gray-600 text-xs">{purchase.notes || '-'}</td>
                    <td className="px-6 py-3 text-right font-semibold text-green-600">Rs {(purchase.total_cost || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
