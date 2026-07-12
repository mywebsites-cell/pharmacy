import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, DollarSign, RotateCcw, User, X, AlertTriangle, CreditCard, Search, Percent } from 'lucide-react';
import api, { rankMedicineResults } from '../services/api';
import { useAuthStore } from '../store';
import { toast } from '../components/toast';
import { useConfirm } from '../components/ConfirmModal';
import { ReceiptModal } from '../components/ReceiptModal';

export default function POSPage() {
  const user = useAuthStore((s) => s.user);
  const confirm = useConfirm();

  const [searchQuery, setSearchQuery] = useState('');
  const [medicines, setMedicines] = useState([]);
  const [cart, setCart] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionMode, setTransactionMode] = useState<'sale' | 'refund'>('sale');
  const [refundReason, setRefundReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Receipt modal
  const [receiptData, setReceiptData] = useState<any>(null);

  // Customer autocomplete
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // New customer form (shown when "+ Add" is clicked from dropdown)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);

  // Due
  const [isDue, setIsDue] = useState(false);
  const [amountPaidNow, setAmountPaidNow] = useState('0');
  const [dueNote, setDueNote] = useState('');

  // ─── Customer autocomplete search ─────────────────────────────────────────

  const searchCustomers = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setCustomerResults([]); setCustomerDropdownOpen(false); return; }
    try {
      setCustomerSearchLoading(true);
      const res = await api.get(`/customers/customers/?search=${q}`);
      setCustomerResults(res.data?.results || res.data || []);
      setCustomerDropdownOpen(true);
    } catch {
      setCustomerResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (customerQuery) searchCustomers(customerQuery); }, 300);
    return () => clearTimeout(t);
  }, [customerQuery, searchCustomers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCustomerQuery('');
    setCustomerResults([]);
    setCustomerDropdownOpen(false);
    setShowNewCustomerForm(false);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
    setIsDue(false);
    setAmountPaidNow('0');
    setDueNote('');
    setShowNewCustomerForm(false);
  };

  const handleCreateNewCustomer = async () => {
    if (!newCustomerName.trim()) { toast.warning('Please enter a customer name.'); return; }
    try {
      setNewCustomerLoading(true);
      const nameParts = newCustomerName.trim().split(' ');
      const res = await api.post('/customers/customers/', {
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || '',
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || '—'
      });
      selectCustomer(res.data);
      setNewCustomerName('');
      setNewCustomerPhone('');
      toast.success('Customer created and selected.');
    } catch {
      toast.error('Error creating customer. Please try again.');
    } finally {
      setNewCustomerLoading(false);
    }
  };

  // ─── Medicine search ───────────────────────────────────────────────────────

  const searchMedicines = async (query: string) => {
    if (query.length < 1) { setMedicines([]); return; }
    try {
      const response = await api.get(`/inventory/medicines/?search=${query}`);
      const items = response.data?.results || response.data || [];
      setMedicines(rankMedicineResults(items, query));
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  // ─── Cart helpers ──────────────────────────────────────────────────────────

  const addToCart = async (medicine: any) => {
    const stock = medicine.quantity_on_hand ?? medicine.quantity ?? 0;
    if (stock <= 0 && transactionMode === 'sale') {
      toast.error('This medicine is out of stock.');
      return;
    }

    if (medicine.expiry_date && transactionMode === 'sale') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const exp = new Date(medicine.expiry_date); exp.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000);

      if (daysLeft < 0) {
        toast.error(`${medicine.generic_name || medicine.name} has EXPIRED (${medicine.expiry_date}). Cannot add to cart.`);
        return;
      }
      if (daysLeft <= 30) {
        const ok = await confirm({
          message: `${medicine.generic_name || medicine.name} expires in ${daysLeft} day(s) (${medicine.expiry_date}). Still add to cart?`,
          confirmLabel: 'Add Anyway',
          destructive: true
        });
        if (!ok) return;
      } else if (daysLeft <= 90) {
        const ok = await confirm({
          message: `${medicine.generic_name || medicine.name} expires in ${daysLeft} day(s). Still add to cart?`,
          confirmLabel: 'Add'
        });
        if (!ok) return;
      }
    }

    const existingItem = cart.find(item => item.id === medicine.id);
    if (existingItem) {
      if (transactionMode === 'sale' && existingItem.quantity + 1 > stock) {
        toast.warning(`Only ${stock} units available.`);
        return;
      }
      setCart(cart.map(item =>
        item.id === medicine.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...medicine, quantity: 1, discount: 0 }]);
    }
    setSearchQuery('');
    setMedicines([]);
  };

  const removeFromCart = (medicineId: number) => setCart(cart.filter(item => item.id !== medicineId));

  const updateQuantity = (medicineId: number, quantity: number) => {
    if (quantity <= 0) { removeFromCart(medicineId); return; }
    const item = cart.find(i => i.id === medicineId);
    if (transactionMode === 'sale') {
      const stock = item?.quantity_on_hand ?? 0;
      if (quantity > stock) { toast.warning(`Only ${stock} units available.`); return; }
    }
    setCart(cart.map(item => item.id === medicineId ? { ...item, quantity } : item));
  };

  const updateDiscount = (medicineId: number, discount: number) => {
    const d = Math.max(0, Math.min(100, discount));
    setCart(cart.map(item => item.id === medicineId ? { ...item, discount: d } : item));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + ((item.selling_price || item.price || 0) * item.quantity), 0);
    const discountTotal = cart.reduce((sum, item) => {
      const lineTotal = (item.selling_price || item.price || 0) * item.quantity;
      return sum + (lineTotal * (item.discount || 0) / 100);
    }, 0);
    const total = subtotal - discountTotal;
    return { subtotal, discountTotal, total };
  };

  // ─── Checkout ─────────────────────────────────────────────────────────────

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.warning('Cart is empty. Add items before checkout.'); return; }
    if (isDue && !selectedCustomer) { toast.warning('Please select a customer to create a due.'); return; }

    try {
      setLoading(true);
      const { total, discountTotal, subtotal } = calculateTotals();
      const saleData = {
        items: cart.map(item => ({
          medicine: item.id,
          quantity_sold: item.quantity,
          unit_price: item.selling_price || item.price,
          discount_percentage: item.discount || 0
        })),
        subtotal_amount: subtotal,
        discount_amount: discountTotal,
        total_amount: total,
        payment_method: isDue ? 'CREDIT' : paymentMethod,
        customer_id: selectedCustomer?.id || null,
        is_due: isDue
      };

      const saleRes = await api.post('/sales/sales/', saleData);
      const saleId = saleRes.data?.id;
      const billNumber = saleRes.data?.bill_number || saleRes.data?.invoice_no || `#${saleId}`;

      let amountPaid = total;
      let outstanding = 0;

      if (isDue) {
        const paid = parseFloat(amountPaidNow) || 0;
        amountPaid = paid;
        outstanding = Math.max(0, total - paid);
        await api.post('/dues/', {
          customer_id: selectedCustomer.id,
          sale_id: saleId,
          total_amount: total,
          amount_paid: paid,
          payment_method: paymentMethod,
          notes: dueNote
        });
      }

      // Build receipt data and show modal
      setReceiptData({
        billNumber,
        date: new Date().toLocaleString('en-PK'),
        pharmacyName: user?.pharmacy_name || user?.username || 'Pharmacy',
        branchName: user?.branch_name,
        cashierName: user?.full_name || user?.username,
        customerName: selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : undefined,
        items: cart.map(item => ({
          name: item.generic_name || item.name,
          quantity: item.quantity,
          unitPrice: item.selling_price || item.price || 0,
          discount: item.discount || 0,
        })),
        subtotal,
        discountTotal,
        total,
        paymentMethod: isDue ? paymentMethod : paymentMethod,
        isDue,
        amountPaid,
        outstanding
      });

      setCart([]);
      if (!isDue) clearCustomer();
    } catch (error: any) {
      console.error('Error completing sale:', error);
      const msg = error?.response?.data?.detail || error?.response?.data?.error || 'Error completing sale. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (cart.length === 0) { toast.warning('Cart is empty.'); return; }
    try {
      setLoading(true);
      const { total } = calculateTotals();
      await api.post('/refunds/', {
        items: cart.map(item => ({
          medicine: item.id,
          medicine_name: item.generic_name || item.name || '',
          quantity: item.quantity,
          unit_price: item.selling_price || item.price
        })),
        total_amount: total,
        reason: refundReason
      });
      toast.success('Refund processed successfully!');
      setCart([]);
      setRefundReason('');
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error('Error processing refund. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, discountTotal, total } = calculateTotals();

  return (
    <>
      {/* Receipt modal */}
      {receiptData && (
        <ReceiptModal
          receipt={receiptData}
          onClose={() => {
            setReceiptData(null);
            clearCustomer();
          }}
        />
      )}

      <div className="p-6 grid grid-cols-3 gap-6 h-screen">
        {/* Left — Search & Products */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">{transactionMode === 'sale' ? 'Point of Sale' : 'Process Refund'}</h1>
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setTransactionMode('sale')}
                className={`px-4 py-2 rounded font-medium transition ${transactionMode === 'sale' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-800'}`}
              >
                Sale
              </button>
              <button
                onClick={() => setTransactionMode('refund')}
                className={`px-4 py-2 rounded font-medium transition flex items-center gap-1 ${transactionMode === 'refund' ? 'bg-white text-red-600 shadow' : 'text-gray-600 hover:text-gray-800'}`}
              >
                <RotateCcw size={16} /> Refund
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <input
              type="text"
              placeholder="Search medicine by name, barcode, or SKU..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); searchMedicines(e.target.value); }}
              className="w-full border rounded px-4 py-2 focus:outline-none focus:border-blue-500 text-lg"
              autoFocus
            />
          </div>

          {medicines.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {medicines.map((medicine: any) => {
                  const stock = medicine.quantity_on_hand ?? medicine.quantity ?? 0;
                  const outOfStock = stock <= 0;
                  const canAdd = !outOfStock || transactionMode === 'refund';
                  let expiryBadge: React.ReactNode = null;
                  if (medicine.expiry_date) {
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const daysLeft = Math.ceil((new Date(medicine.expiry_date).getTime() - today.getTime()) / 86400000);
                    if (daysLeft < 0) expiryBadge = <span className="text-xs font-semibold text-red-600">❌ EXPIRED</span>;
                    else if (daysLeft <= 30) expiryBadge = <span className="text-xs font-semibold text-orange-600">⚠️ Exp in {daysLeft}d</span>;
                    else if (daysLeft <= 90) expiryBadge = <span className="text-xs text-yellow-700">📅 Exp in {daysLeft}d</span>;
                  }
                  return (
                    <div
                      key={medicine.id}
                      className={`border rounded p-3 transition ${canAdd ? 'cursor-pointer hover:bg-blue-50' : 'opacity-60 cursor-not-allowed bg-red-50 border-red-200'}`}
                      onClick={() => canAdd && addToCart(medicine)}
                    >
                      <div className="font-semibold text-sm">{medicine.generic_name || medicine.name}</div>
                      <div className="text-xs text-gray-600">{medicine.brand_name || medicine.brand}</div>
                      <div className="text-sm font-bold text-blue-600 mt-1">Rs {medicine.selling_price || medicine.price}</div>
                      <div className={`text-xs mt-1 font-medium ${outOfStock ? transactionMode === 'refund' ? 'text-orange-600' : 'text-red-600' : 'text-gray-500'}`}>
                        {outOfStock ? (transactionMode === 'refund' ? '⚠️ Out of Stock (can refund)' : '❌ Out of Stock') : `Stock: ${stock}`}
                      </div>
                      {expiryBadge && <div className="mt-1">{expiryBadge}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right — Cart & Checkout */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={24} className="text-blue-600" />
            <h2 className="text-xl font-bold">Cart ({cart.length})</h2>
          </div>

          {/* Customer section (sale mode only) */}
          {transactionMode === 'sale' && (
            <div className="mb-3 space-y-1.5">
              {selectedCustomer ? (
                /* Selected customer chip */
                <div className={`rounded-lg p-2 text-sm flex items-start justify-between gap-2 ${selectedCustomer.outstanding_balance > 0 ? 'bg-yellow-50 border border-yellow-300' : 'bg-blue-50 border border-blue-200'}`}>
                  <div>
                    <div className="flex items-center gap-1 font-semibold text-gray-800">
                      <User size={14} className="text-blue-600" />
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </div>
                    <div className="text-xs text-gray-500">{selectedCustomer.phone}</div>
                    {selectedCustomer.outstanding_balance > 0 && (
                      <div className="flex items-center gap-1 text-yellow-700 text-xs mt-1 font-medium">
                        <AlertTriangle size={12} /> Existing due: Rs {selectedCustomer.outstanding_balance}
                      </div>
                    )}
                  </div>
                  <button onClick={clearCustomer} className="text-gray-400 hover:text-red-500 flex-shrink-0"><X size={16} /></button>
                </div>
              ) : showNewCustomerForm ? (
                /* New customer mini-form */
                <div className="border border-blue-200 rounded-lg p-2 space-y-1.5 bg-blue-50">
                  <div className="text-xs font-semibold text-blue-700 mb-1">New Customer</div>
                  <input
                    type="text"
                    placeholder="Name *"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Phone (optional)"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateNewCustomer()}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleCreateNewCustomer}
                      disabled={newCustomerLoading}
                      className="flex-1 bg-blue-600 text-white py-1.5 rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {newCustomerLoading ? 'Saving...' : 'Save & Select'}
                    </button>
                    <button
                      onClick={() => { setShowNewCustomerForm(false); setNewCustomerName(''); setNewCustomerPhone(''); }}
                      className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded text-xs hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Autocomplete search */
                <div ref={customerSearchRef} className="relative">
                  <div className="relative flex items-center">
                    <Search size={14} className="absolute left-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search customer (optional — walk-in default)"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      onFocus={() => { if (customerResults.length > 0) setCustomerDropdownOpen(true); }}
                      className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                    {customerSearchLoading && (
                      <div className="absolute right-3 w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>

                  {/* Dropdown */}
                  {customerDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      {customerResults.length === 0 && !customerSearchLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500">No customers found</div>
                      ) : (
                        customerResults.slice(0, 6).map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition text-sm border-b last:border-0"
                          >
                            <div className="font-medium text-gray-800">{c.first_name} {c.last_name}</div>
                            <div className="text-xs text-gray-500">{c.phone}</div>
                          </button>
                        ))
                      )}
                      <button
                        onClick={() => { setCustomerDropdownOpen(false); setShowNewCustomerForm(true); setNewCustomerName(customerQuery); }}
                        className="w-full text-left px-3 py-2 text-sm text-blue-600 font-semibold hover:bg-blue-50 flex items-center gap-1.5 border-t"
                      >
                        <Plus size={14} /> Add "{customerQuery || 'new customer'}"
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {cart.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Cart is empty</div>
            ) : (
              cart.map((item: any) => {
                let cartExpiry: React.ReactNode = null;
                if (item.expiry_date) {
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - today.getTime()) / 86400000);
                  if (daysLeft < 0) cartExpiry = <div className="text-xs font-semibold text-red-600 mt-1">❌ EXPIRED — check before dispensing</div>;
                  else if (daysLeft <= 30) cartExpiry = <div className="text-xs font-semibold text-orange-500 mt-1">⚠️ Expires in {daysLeft} day(s)</div>;
                  else if (daysLeft <= 90) cartExpiry = <div className="text-xs text-yellow-700 mt-1">📅 Expires in {daysLeft} day(s)</div>;
                }
                const linePrice = (item.selling_price || item.price || 0) * item.quantity;
                const lineAfterDiscount = linePrice * (1 - (item.discount || 0) / 100);
                return (
                  <div key={item.id} className={`border rounded p-3 text-sm ${cartExpiry ? 'border-orange-200 bg-orange-50' : ''}`}>
                    <div className="font-semibold">{item.generic_name || item.name}</div>
                    <div className="text-xs text-gray-600">Rs {item.selling_price || item.price} each</div>
                    {cartExpiry}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="text-red-600"><Minus size={16} /></button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                          className="w-12 text-center border rounded"
                        />
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="text-green-600"><Plus size={16} /></button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-600"><Trash2 size={16} /></button>
                    </div>
                    {/* Discount per item */}
                    <div className="flex items-center gap-2 mt-2">
                      <Percent size={12} className="text-gray-400 flex-shrink-0" />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={item.discount || 0}
                        onChange={(e) => updateDiscount(item.id, parseFloat(e.target.value) || 0)}
                        className="w-14 text-center border rounded text-xs px-1 py-0.5"
                        placeholder="0"
                        title="Discount %"
                      />
                      <span className="text-xs text-gray-500">% disc</span>
                      <span className="ml-auto font-semibold text-right">
                        {(item.discount || 0) > 0
                          ? <><span className="line-through text-gray-400 text-xs mr-1">Rs {linePrice.toFixed(0)}</span>Rs {lineAfterDiscount.toFixed(0)}</>
                          : <>Rs {linePrice.toFixed(0)}</>
                        }
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals */}
          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal:</span><span>Rs {subtotal.toFixed(2)}</span></div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Discount:</span><span>- Rs {discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold bg-blue-50 p-2 rounded">
              <span>Total:</span><span>Rs {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Checkout actions */}
          <div className="space-y-2 mt-4">
            {transactionMode === 'sale' ? (
              <>
                {/* Pay Now / Due toggle */}
                <div className="flex items-center gap-2 pb-2 border-b">
                  <button
                    onClick={() => setIsDue(false)}
                    className={`flex-1 py-1.5 rounded text-sm font-medium transition ${!isDue ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Pay Now
                  </button>
                  <button
                    onClick={() => setIsDue(true)}
                    className={`flex-1 py-1.5 rounded text-sm font-medium transition flex items-center justify-center gap-1 ${isDue ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    <CreditCard size={14} /> Mark as Due
                  </button>
                </div>

                {isDue ? (
                  <>
                    {!selectedCustomer && (
                      <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded p-2 flex items-center gap-1">
                        <AlertTriangle size={12} /> Select a customer above to create a due
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-1">Amount Paid Now (Rs)</label>
                      <input
                        type="number" min="0" max={total}
                        value={amountPaidNow}
                        onChange={(e) => setAmountPaidNow(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                        placeholder="0"
                      />
                      {total > 0 && (
                        <div className="text-xs text-red-600 mt-1 font-medium">
                          Outstanding: Rs {Math.max(0, total - (parseFloat(amountPaidNow) || 0)).toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-1">Note (optional)</label>
                      <input
                        type="text" value={dueNote}
                        onChange={(e) => setDueNote(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                        placeholder="e.g. Will pay Thursday"
                      />
                    </div>
                    <button
                      onClick={handleCheckout}
                      disabled={loading || cart.length === 0 || !selectedCustomer}
                      className="w-full bg-orange-500 text-white py-3 rounded font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CreditCard size={20} /> {loading ? 'Processing...' : 'Create Due'}
                    </button>
                  </>
                ) : (
                  <>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="UPI">UPI</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                    <button
                      onClick={handleCheckout}
                      disabled={loading || cart.length === 0}
                      className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <DollarSign size={20} /> {loading ? 'Processing...' : 'Complete Sale'}
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <textarea
                  placeholder="Refund reason (optional)"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm resize-none h-20"
                />
                <button
                  onClick={handleRefund}
                  disabled={loading || cart.length === 0}
                  className="w-full bg-red-600 text-white py-3 rounded font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RotateCcw size={20} /> {loading ? 'Processing...' : 'Process Refund'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
