import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, Trash2 } from 'lucide-react';
import api from '../services/api';
import { toast } from '../components/toast';

export default function RefundsPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [refundItems, setRefundItems] = useState<any[]>([]);
  const [reason, setReason] = useState('Customer return');
  const [loading, setLoading] = useState(false);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchSales();
    fetchRefunds();
  }, []);

  const fetchSales = async () => {
    try {
      const res = await api.get('/sales/sales/', { params: { limit: 1500 } });
      const allSales = (res.data.results || res.data || [])
        .filter((sale: any) => sale.sale_type !== 'return' && !String(sale.invoice_no || '').startsWith('RET-SRC-'))
        .map((r: any) => ({ ...r, _timestamp: new Date(r.date || r.created_at).getTime() }))
        .sort((a: any, b: any) => b._timestamp - a._timestamp);
      setSales(allSales);
    } catch (error) {
      console.error('Failed to fetch sales:', error);
    }
  };

  const fetchRefunds = async () => {
    try {
      const res = await api.get('/refunds/');
      setRefunds((res.data.results || res.data || []));
    } catch (error) {
      console.error('Failed to fetch refunds:', error);
    }
  };

  const handleSaleSelect = (sale: any) => {
    setSelectedSale(sale);
    const items = sale.items.map((item: any) => ({
      medicine: item.medicine,
      medicine_name: item.medicine_name || item.medicine?.generic_name || item.medicine?.name || 'N/A',
      brand_name: item.medicine?.brand_name || '',
      quantity_sold: item.quantity_sold ?? item.quantity ?? 0,
      quantity_returned: 0,
      unit_price: item.unit_price
    }));
    setRefundItems(items);
  };

  const updateQuantityReturned = (idx: number, qty: number) => {
    const updated = [...refundItems];
    updated[idx].quantity_returned = Math.max(0, Math.min(qty, updated[idx].quantity_sold));
    setRefundItems(updated);
  };

  const removeRefundItem = (idx: number) => {
    setRefundItems(refundItems.filter((_, i) => i !== idx));
  };

  const submitRefund = async () => {
    if (!selectedSale || refundItems.filter(i => i.quantity_returned > 0).length === 0) {
      toast.warning('Please select a sale and set at least one item quantity to return.');
      return;
    }

    try {
      setLoading(true);
      const refundedItems = refundItems.filter(i => i.quantity_returned > 0);
      const total = refundedItems.reduce((sum, i) => sum + (i.unit_price * i.quantity_returned), 0);

      await api.post('/refunds/', {
        sale_id: selectedSale.id,
        items: refundedItems.map(item => ({
          medicine: item.medicine,
          quantity_returned: item.quantity_returned,
          unit_price: item.unit_price
        })),
        reason,
        total_amount: total
      });

      setSuccessMessage(`Refund processed successfully! Amount: Rs ${total.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setSelectedSale(null);
      setRefundItems([]);
      setReason('Customer return');
      setShowForm(false);
      fetchRefunds();
      fetchSales();
    } catch (error) {
      console.error('Failed to process refund:', error);
      toast.error('Failed to process refund. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Refunds & Returns</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition text-sm font-medium"
          >
            <Plus size={18} /> New Refund
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
          <h2 className="text-lg font-semibold text-gray-800">Process Refund</h2>
          
          {!selectedSale ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Sale to Refund</label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                {sales.length === 0 ? (
                  <p className="text-gray-500 text-sm">No sales available</p>
                ) : (
                  sales.map(sale => (
                    <button
                      key={sale.id}
                      onClick={() => handleSaleSelect(sale)}
                      className="w-full text-left p-3 border rounded hover:bg-blue-50 transition"
                    >
                      <div className="text-sm font-medium">Sale #{sale.id} - {new Date(sale.date).toLocaleDateString('en-PK')}</div>
                      <div className="text-xs text-gray-600">Rs {(sale.total_amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })} • {sale.items?.length || 0} items</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">Sale #{selectedSale.id}</p>
                  <p className="text-xs text-gray-600">{new Date(selectedSale.date || selectedSale.created_at).toLocaleDateString('en-PK')} • Rs {(selectedSale.total_amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedSale(null);
                    setRefundItems([]);
                  }}
                  className="text-xs px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Change
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Refund</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Items to Refund</label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-700">Medicine</th>
                        <th className="text-center px-3 py-2 font-semibold text-gray-700">Qty Sold</th>
                        <th className="text-center px-3 py-2 font-semibold text-gray-700">Qty Return</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-700">Price</th>
                        <th className="text-center px-3 py-2 font-semibold text-gray-700"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {refundItems.map((item, idx) => (
                        <tr key={idx} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-800">{item.medicine_name}</div>
                            <div className="text-xs text-gray-500">{item.brand_name}</div>
                          </td>
                          <td className="text-center px-3 py-2 text-gray-700">{item.quantity_sold}</td>
                          <td className="text-center px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={item.quantity_sold}
                              value={item.quantity_returned}
                              onChange={(e) => updateQuantityReturned(idx, parseInt(e.target.value) || 0)}
                              className="w-16 border rounded px-2 py-1 text-center text-sm"
                            />
                          </td>
                          <td className="text-right px-3 py-2 text-gray-700">Rs {(item.unit_price * item.quantity_returned).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</td>
                          <td className="text-center px-3 py-2">
                            <button
                              onClick={() => removeRefundItem(idx)}
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
              </div>

              <div className="text-right border-t pt-4">
                <p className="text-lg font-bold text-gray-800">
                  Refund Total: Rs {refundItems.reduce((sum, i) => sum + (i.unit_price * i.quantity_returned), 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedSale(null);
                    setRefundItems([]);
                    setShowForm(false);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRefund}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition text-sm font-medium"
                >
                  {loading ? 'Processing...' : 'Process Refund'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Refunds History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Refund History</h2>
        </div>
        
        {refunds.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No refunds recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Ref / Sale Order</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Reason</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Items Returned</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Total Refund</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => {
                  const items: any[] = refund.items || [];
                  const hasItems = items.length > 0 && items.some((i: any) => i.medicine?.generic_name || i.medicine_name);
                  return (
                    <tr key={refund.id} className="border-b hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(refund.date).toLocaleDateString('en-PK')}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{refund.invoice_no || refund.return_invoice_no || `RET-${refund.id}`}</div>
                        <div className="text-xs text-gray-500">Sale #{refund.sale_id || refund.original_sale_id}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{refund.reason || refund.return_reason}</td>
                      <td className="px-4 py-3">
                        {hasItems ? (
                          <div className="space-y-1">
                            {items.map((item: any, idx: number) => {
                              const name = item.medicine?.generic_name || item.medicine_name || '—';
                              const qty = item.quantity_returned || item.quantity_sold || 0;
                              const price = item.unit_price || 0;
                              const total = qty * price;
                              return (
                                <div key={idx} className="text-xs">
                                  <span className="font-medium text-gray-800">{name}</span>
                                  <span className="text-gray-500 ml-2">× {qty}</span>
                                  <span className="text-gray-500 ml-2">@ Rs {price.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
                                  <span className="text-red-600 font-semibold ml-2">= Rs {total.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-500">{refund.items_returned || items.length || 0} item(s)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 whitespace-nowrap">
                        Rs {(refund.total_amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
