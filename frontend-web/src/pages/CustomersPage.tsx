import React, { useState, useEffect } from 'react';
import { Search, Plus, Gift, Percent, Phone, Mail, Zap } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store';
import { toast } from '../components/toast';

export default function CustomersPage() {
  const features = useAuthStore((state) => state.features);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loyaltyAction, setLoyaltyAction] = useState(null);
  const [visibleCount, setVisibleCount] = useState(200);
  // Loyalty points inline input
  const [loyaltyPoints, setLoyaltyPoints] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/customers/customers/');
      setCustomers(response.data?.results || response.data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length > 1) {
      try {
        const response = await api.get(`/customers/customers/?search=${query}`);
        setCustomers(response.data?.results || response.data || []);
      } catch (error) {
        console.error('Search error:', error);
      }
    } else if (query.length === 0) {
      fetchCustomers();
    }
    setVisibleCount(200);
  };

  const handleAddLoyaltyPoints = async () => {
    const pts = parseFloat(loyaltyPoints);
    if (!pts || pts <= 0) { toast.warning('Please enter a valid number of points.'); return; }
    try {
      await api.post(`/customers/customers/${selectedCustomer.id}/add_loyalty_points/`, {
        points: pts,
        description: 'Manual addition'
      });
      setLoyaltyPoints('');
      setSelectedCustomer(null);
      fetchCustomers();
      toast.success(`${pts} loyalty points added successfully.`);
    } catch (error) {
      console.error('Error adding points:', error);
      toast.error('Failed to add loyalty points.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Customer Management</h1>
          {features?.max_customers != null && (
            <div className="mt-1 flex items-center gap-2">
              <div className="w-40 bg-gray-200 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (customers.length / features.max_customers) * 100)}%` }} />
              </div>
              <span className={`text-xs font-medium ${customers.length >= features.max_customers ? 'text-red-600' : 'text-gray-500'}`}>
                {customers.length} / {features.max_customers} customers
              </span>
              {customers.length >= features.max_customers && (
                <a href="/subscribe" className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Zap size={10} /> Upgrade</a>
              )}
            </div>
          )}
        </div>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={features?.max_customers != null && customers.length >= features.max_customers}
        >
          <Plus size={20} /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {customers.slice(0, visibleCount).map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className={`border rounded p-3 cursor-pointer hover:bg-blue-50 ${selectedCustomer?.id === customer.id ? 'bg-blue-100 border-blue-500' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{customer.first_name} {customer.last_name}</div>
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <Phone size={14} /> {customer.phone}
                      </div>
                    </div>
                    {customer.is_vip && <span className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded">VIP</span>}
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-600">Loyalty Balance: <span className="font-bold text-blue-600">Rs {customer.loyalty_balance}</span></span>
                    <span className="text-gray-600">Credit: <span className="font-bold">Rs {customer.outstanding_balance}</span></span>
                  </div>
                </div>
              ))}
              {customers.length > visibleCount && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setVisibleCount(v => v + 200)}
                    className="px-6 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition shadow-sm"
                  >
                    Load More (Showing {visibleCount} of {customers.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Customer Details */}
        {selectedCustomer && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xl font-bold mb-4">{selectedCustomer.first_name} {selectedCustomer.last_name}</h3>

            <div className="space-y-3 text-sm mb-6">
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-blue-600" />
                <span>{selectedCustomer.phone}</span>
              </div>
              {selectedCustomer.email && (
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-blue-600" />
                  <span>{selectedCustomer.email}</span>
                </div>
              )}
              <div className="bg-blue-50 p-3 rounded">
                <div className="font-semibold text-blue-900">Loyalty Points</div>
                <div className="text-2xl font-bold text-blue-600">Rs {selectedCustomer.loyalty_balance}</div>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <div className="font-semibold text-red-900">Outstanding Balance</div>
                <div className="text-2xl font-bold text-red-600">Rs {selectedCustomer.outstanding_balance}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Points to add"
                  value={loyaltyPoints}
                  onChange={(e) => setLoyaltyPoints(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLoyaltyPoints()}
                />
                <button
                  onClick={handleAddLoyaltyPoints}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 hover:bg-green-700 text-sm font-medium"
                >
                  <Gift size={16} /> Add
                </button>
              </div>
              <button className="w-full bg-blue-600 text-white py-2 rounded flex items-center justify-center gap-2 hover:bg-blue-700">
                <Percent size={18} /> Apply Discount
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

  );
}
