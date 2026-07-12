import React, { useState, useEffect } from 'react';
import { CreditCard, Search, Plus, CheckCircle, Clock, AlertCircle, DollarSign, User, Phone, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import { toast } from '../components/toast';

const STATUS_COLORS = {
  pending: 'bg-red-100 text-red-700 border border-red-200',
  partial: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  paid: 'bg-green-100 text-green-700 border border-green-200',
};

const STATUS_LABELS = {
  pending: 'Pending',
  partial: 'Partial',
  paid: 'Paid',
};

export default function DuesPage() {
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [paidAlert, setPaidAlert] = useState<string | null>(null);

  // Payment modal state
  const [payModal, setPayModal] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  // Expanded due details
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchDues();
  }, [filterStatus]);

  const fetchDues = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus === 'pending') params.status = 'pending';
      else if (filterStatus === 'partial') params.status = 'partial';
      // 'active' = no filter (backend returns all; we filter client-side to pending+partial)
      const res = await api.get('/dues/', { params });
      let data = res.data?.results || res.data || [];
      if (filterStatus === 'active') data = data.filter((d: any) => d.status !== 'paid');
      setDues(data);
      setTotalOutstanding(res.data?.total_outstanding || data.filter((d: any) => d.status !== 'paid').reduce((s: number, d: any) => s + d.balance, 0));
    } catch (err) {
      console.error('Error fetching dues:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.warning('Please enter a valid amount greater than zero.');
      return;
    }
    try {
      setPayLoading(true);
      const result = await api.post(`/dues/${payModal.id}/pay/`, {
        amount: parseFloat(payAmount),
        method: payMethod,
        note: payNote,
      });
      setPayModal(null);
      setPayAmount('');
      setPayNote('');
      setPayMethod('cash');
      if (result.data?.deleted) {
        setPaidAlert(`✅ Due fully paid! ${result.data.customer_name || 'Customer'} has been removed from the dues list.`);
        setTimeout(() => setPaidAlert(null), 5000);
      }
      fetchDues();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error recording payment.');
    } finally {
      setPayLoading(false);
    }
  };

  const filtered = dues.filter((d: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.customer_name?.toLowerCase().includes(q) ||
      d.customer_phone?.includes(q)
    );
  });

  const pendingCount = dues.filter((d: any) => d.status === 'pending').length;
  const partialCount = dues.filter((d: any) => d.status === 'partial').length;
  const paidCount = dues.filter((d: any) => d.status === 'paid').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard size={30} className="text-blue-600" /> Dues / Credit
          </h1>
          <p className="text-gray-500 mt-1">Track customer outstanding balances and payments</p>
        </div>
      </div>

      {/* Paid alert banner */}
      {paidAlert && (
        <div className="bg-green-50 border border-green-300 text-green-800 rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2">
          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
          {paidAlert}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Outstanding</div>
          <div className="text-2xl font-bold text-red-600">Rs {totalOutstanding.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-red-500">{pendingCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Partial</div>
          <div className="text-2xl font-bold text-yellow-600">{partialCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Paid</div>
          <div className="text-2xl font-bold text-green-600">{paidCount}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by customer name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[{key:'active',label:'Active (Unpaid)'},{key:'pending',label:'Pending'},{key:'partial',label:'Partial'}].map(({key,label}) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                  filterStatus === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dues List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
            <div>No dues found</div>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((due: any) => (
              <div key={due.id} className="hover:bg-gray-50 transition">
                <div className="p-4 flex items-center gap-4">
                  {/* Customer Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={15} className="text-gray-400 flex-shrink-0" />
                      <span className="font-semibold text-gray-900">{due.customer_name}</span>
                      {due.customer_phone && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone size={12} /> {due.customer_phone}
                        </span>
                      )}
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[due.status]}`}>
                        {STATUS_LABELS[due.status]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{due.date} {due.sale_id ? `· Sale #${due.sale_id}` : ''} {due.notes ? `· ${due.notes}` : ''}</div>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-gray-500">Total: </span>
                        <span className="font-medium">Rs {due.total_amount?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Paid: </span>
                        <span className="font-medium text-green-600">Rs {due.amount_paid?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Balance: </span>
                        <span className={`font-bold ${due.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          Rs {due.balance?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {due.status !== 'paid' && (
                      <button
                        onClick={() => { setPayModal(due); setPayAmount(String(due.balance)); }}
                        className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700 flex items-center gap-1"
                      >
                        <DollarSign size={14} /> Pay
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === due.id ? null : due.id)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded"
                    >
                      {expandedId === due.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Payment History */}
                {expandedId === due.id && (
                  <div className="bg-gray-50 border-t px-4 pb-4 pt-3">
                    <div className="text-sm font-semibold text-gray-600 mb-2">Payment History</div>
                    {due.payments?.length === 0 ? (
                      <div className="text-sm text-gray-400 italic">No payments recorded yet</div>
                    ) : (
                      <div className="space-y-2">
                        {due.payments.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-4 text-sm bg-white rounded border p-2">
                            <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                            <span className="text-gray-500">{p.date}</span>
                            <span className="font-semibold text-green-600">Rs {p.amount?.toLocaleString()}</span>
                            <span className="capitalize text-gray-600">{p.method}</span>
                            {p.note && <span className="text-gray-400 italic">— {p.note}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">Record Payment</h2>
              <button onClick={() => setPayModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="font-semibold text-gray-700">{payModal.customer_name}</div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Outstanding Balance</span>
                  <span className="font-bold text-red-600">Rs {payModal.balance?.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs) *</label>
                <input
                  type="number"
                  min="1"
                  max={payModal.balance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-lg font-bold"
                  placeholder="Enter amount"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  {[payModal.balance, Math.round(payModal.balance / 2), 500, 1000].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).slice(0, 4).map((amt) => (
                    <button key={amt} onClick={() => setPayAmount(String(amt))}
                      className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100">
                      Rs {amt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Paid via WhatsApp transfer"
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button
                onClick={() => setPayModal(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={payLoading}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
              >
                {payLoading ? 'Saving...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
