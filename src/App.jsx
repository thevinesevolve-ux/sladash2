import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { CheckCircle, XCircle, Package, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';

// ============================================
// GOOGLE SHEETS CSV URLS
// ============================================
const DAILY_ORDERS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQEB9EzUWiC8kSBDPaBLXfC-Rnb7QRJxa9S8lidERx15UNWH3Sevpb21iutH21VwGbIUOocmUpcRzte/pub?gid=0&single=true&output=csv';
const CLIENT_CONFIG_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQEB9EzUWiC8kSBDPaBLXfC-Rnb7QRJxa9S8lidERx15UNWH3Sevpb21iutH21VwGbIUOocmUpcRzte/pub?gid=1971410819&single=true&output=csv';

// Client colors for charts
const CLIENT_COLORS = {
  'Tiny Rituals': '#06b6d4',
  'Purusha': '#8b5cf6',
  'Orttu': '#10b981',
};

const DEFAULT_COLOR = '#6366f1';

// Date formatter helper
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) + ' ' + 
         date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// CSV PARSER
// ============================================
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
export default function App() {
  const [orders, setOrders] = useState([]);
  const [clientConfig, setClientConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [selectedClient, setSelectedClient] = useState('All Clients');
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Fetch data from Google Sheets
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [ordersRes, configRes] = await Promise.all([
        fetch(DAILY_ORDERS_URL),
        fetch(CLIENT_CONFIG_URL)
      ]);
      
      if (!ordersRes.ok || !configRes.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const ordersText = await ordersRes.text();
      const configText = await configRes.text();
      
      const parsedOrders = parseCSV(ordersText);
      const parsedConfig = parseCSV(configText);
      
      setOrders(parsedOrders);
      setClientConfig(parsedConfig);
      setLastRefresh(new Date());
      
      // Set initial date range to last 7 days of data
      if (parsedOrders.length > 0) {
        const dates = parsedOrders
          .map(o => new Date(o.Date))
          .filter(d => !isNaN(d))
          .sort((a, b) => b - a);
        
        if (dates.length > 0) {
          const end = dates[0];
          const start = new Date(end);
          start.setDate(start.getDate() - 6);
          setDateRange({ start, end });
        }
      } else {
        // No data yet - set to current week
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6);
        setDateRange({ start, end });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Map shop names to client names
  const shopToClient = useMemo(() => {
    const map = {};
    clientConfig.forEach(config => {
      map[config['Shop Name']] = {
        name: config['Client Name'],
        cutoff: config['Cutoff'] || '09:00',
        target: parseInt(config['Target']) || 99
      };
    });
    return map;
  }, [clientConfig]);

  // Get unique client names
  const clients = useMemo(() => {
    const names = new Set();
    clientConfig.forEach(c => {
      if (c['Client Name']) names.add(c['Client Name']);
    });
    return ['All Clients', ...Array.from(names).sort()];
  }, [clientConfig]);

  // Process orders with client mapping
  const processedOrders = useMemo(() => {
    return orders.map(order => {
      const clientInfo = shopToClient[order['Shop Name']] || { 
        name: order['Shop Name'], 
        cutoff: '09:00', 
        target: 99 
      };
      
      return {
        id: order['Order ID'],
        shipheroId: order['ShipHero ID'],
        shopName: order['Shop Name'],
        client: clientInfo.name,
        date: order['Date'],
        readyAt: order['Ready At'],
        shippedAt: order['Shipped At'],
        slaMet: order['SLA Met']?.toUpperCase() === 'YES',
        cutoff: clientInfo.cutoff,
        target: clientInfo.target
      };
    }).filter(o => o.date && o.id);
  }, [orders, shopToClient]);

  // Filter orders by date range and client
  const filteredOrders = useMemo(() => {
    return processedOrders.filter(order => {
      const orderDate = new Date(order.date);
      
      if (dateRange.start && dateRange.end) {
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        if (orderDate < startDate || orderDate > endDate) {
          return false;
        }
      }
      
      if (selectedClient !== 'All Clients' && order.client !== selectedClient) {
        return false;
      }
      
      return true;
    });
  }, [processedOrders, dateRange, selectedClient]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = filteredOrders.length;
    const met = filteredOrders.filter(o => o.slaMet).length;
    const missed = total - met;
    const rate = total > 0 ? ((met / total) * 100).toFixed(1) : 0;
    
    let target = 99;
    if (selectedClient !== 'All Clients') {
      const clientInfo = Object.values(shopToClient).find(c => c.name === selectedClient);
      if (clientInfo) target = clientInfo.target;
    }
    
    return { total, met, missed, rate, target };
  }, [filteredOrders, selectedClient, shopToClient]);

  // Daily trend data
  const dailyTrend = useMemo(() => {
    const byDate = {};
    
    filteredOrders.forEach(order => {
      const date = order.date;
      if (!byDate[date]) {
        byDate[date] = { date, total: 0, met: 0 };
      }
      byDate[date].total++;
      if (order.slaMet) byDate[date].met++;
    });
    
    return Object.values(byDate)
      .map(d => ({
        ...d,
        rate: d.total > 0 ? ((d.met / d.total) * 100).toFixed(1) : 0,
        displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [filteredOrders]);

  // Aging orders (missed SLA, days since ready)
  const agingOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return processedOrders
      .filter(order => !order.slaMet)
      .filter(order => selectedClient === 'All Clients' || order.client === selectedClient)
      .map(order => {
        // Parse the Ready At timestamp (format: 2025-12-31 02:07:23)
        const readyDate = new Date(order.readyAt);
        readyDate.setHours(0, 0, 0, 0);
        const daysOld = Math.floor((today - readyDate) / (1000 * 60 * 60 * 24));
        return { ...order, daysOld };
      })
      .filter(order => !isNaN(order.daysOld))
      .sort((a, b) => b.daysOld - a.daysOld);
  }, [processedOrders, selectedClient]);

  // Client breakdown
  const clientBreakdown = useMemo(() => {
    const byClient = {};
    
    processedOrders.forEach(order => {
      const orderDate = new Date(order.date);
      if (dateRange.start && dateRange.end) {
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        if (orderDate < startDate || orderDate > endDate) {
          return;
        }
      }
      
      const client = order.client;
      if (!byClient[client]) {
        byClient[client] = { client, total: 0, met: 0, target: order.target };
      }
      byClient[client].total++;
      if (order.slaMet) byClient[client].met++;
    });
    
    return Object.values(byClient)
      .map(c => ({
        ...c,
        rate: c.total > 0 ? ((c.met / c.total) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [processedOrders, dateRange]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading SLA data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-slate-800 font-medium">Error loading data</p>
          <p className="text-slate-600 text-sm mb-4">{error}</p>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">BoxFort SLA Dashboard</h1>
            <p className="text-slate-500 text-sm">
              Live data • Last updated: {lastRefresh?.toLocaleTimeString() || 'Never'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={fetchData}
              className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            
            {/* Client Filter */}
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {clients.map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
            
            {/* Date Range Picker */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1">
              <input
                type="date"
                value={dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value ? new Date(e.target.value) : null }))}
                className="text-sm border-none focus:outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value ? new Date(e.target.value) : null }))}
                className="text-sm border-none focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* SLA Rate */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-sm">SLA Rate</span>
              <TrendingUp className={`w-5 h-5 ${parseFloat(metrics.rate) >= metrics.target ? 'text-emerald-500' : 'text-red-500'}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${parseFloat(metrics.rate) >= metrics.target ? 'text-emerald-600' : 'text-red-600'}`}>
                {metrics.rate}%
              </span>
              <span className="text-slate-400 text-sm">/ {metrics.target}%</span>
            </div>
          </div>

          {/* Total Orders */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-sm">Total Orders</span>
              <Package className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-3xl font-bold text-slate-800">{metrics.total}</span>
          </div>

          {/* On Time */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-sm">On Time</span>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-3xl font-bold text-emerald-600">{metrics.met}</span>
          </div>

          {/* Missed */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-sm">Missed</span>
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-3xl font-bold text-red-600">{metrics.missed}</span>
          </div>
        </div>

        {/* Charts Row */}
        <div className={`grid gap-6 mb-6 ${selectedClient === 'All Clients' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Daily Trend */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4">Daily SLA Trend</h3>
            {dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyTrend}>
                  <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'SLA Rate']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400">
                No data for selected period
              </div>
            )}
          </div>

          {/* Client Breakdown - only show when All Clients selected */}
          {selectedClient === 'All Clients' && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4">By Client</h3>
            {clientBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={clientBreakdown} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="client" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${value}% (${props.payload.met}/${props.payload.total})`,
                      'SLA Rate'
                    ]}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                    {clientBreakdown.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CLIENT_COLORS[entry.client] || DEFAULT_COLOR}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400">
                No data for selected period
              </div>
            )}
          </div>
          )}
        </div>

        {/* Aging Orders - Missed SLA */}
        {agingOrders.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="p-4 border-b border-slate-200 bg-red-50">
              <h3 className="font-semibold text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Aging Orders - Missed SLA ({agingOrders.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Order ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Order Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ready At</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Days Since Ready</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agingOrders.slice(0, 20).map((order, idx) => (
                    <tr key={order.id || idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">{order.id}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{order.client}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(order.date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(order.readyAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          order.daysOld >= 7 
                            ? 'bg-red-600 text-white' 
                            : order.daysOld >= 3 
                              ? 'bg-orange-500 text-white' 
                              : order.daysOld >= 1
                                ? 'bg-yellow-400 text-yellow-900'
                                : 'bg-slate-200 text-slate-700'
                        }`}>
                          {order.daysOld}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {agingOrders.length > 20 && (
              <div className="p-4 border-t border-slate-200 text-center text-sm text-slate-500">
                Showing 20 of {agingOrders.length} aging orders
              </div>
            )}
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Recent Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ready At</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Shipped At</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length > 0 ? (
                  filteredOrders.slice(0, 20).map((order, idx) => (
                    <tr key={order.id || idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">{order.id}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{order.client}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(order.date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(order.readyAt)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(order.shippedAt)}</td>
                      <td className="px-4 py-3 text-center">
                        {order.slaMet ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            <CheckCircle className="w-3 h-3" /> Met
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            <XCircle className="w-3 h-3" /> Missed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No orders found. Data will appear after Make.com scenarios run.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredOrders.length > 20 && (
            <div className="p-4 border-t border-slate-200 text-center text-sm text-slate-500">
              Showing 20 of {filteredOrders.length} orders
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="mt-6 text-center text-sm text-slate-400">
          BoxFort Commerce • SLA Dashboard • Auto-refreshes every 5 minutes
        </div>
      </div>
    </div>
  );
}
