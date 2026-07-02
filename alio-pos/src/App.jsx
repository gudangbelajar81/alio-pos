import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, ShoppingCart, Package, Users, Settings, 
  Search, Minus, Plus, Trash2, CreditCard, Loader2,
  TrendingUp, Activity, ShieldCheck, Printer, Send,
  PlusCircle, Save, LogOut, Lock, Mail, Store
} from 'lucide-react';
import './App.css';

// Konfigurasi API
const API_URL = 'http://localhost:5000/api';

function App() {
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('alio_token') || null);
  const [storeName, setStoreName] = useState(localStorage.getItem('alio_store') || '');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  // Auth Form State
  const [authForm, setAuthForm] = useState({ store_name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);

  // App State
  const [currentView, setCurrentView] = useState('kasir'); // 'kasir', 'dashboard', 'produk', 'pelanggan', 'pengaturan'
  
  // Kasir State
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['Semua']);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderDetails, setLastOrderDetails] = useState(null);
  const [waNumber, setWaNumber] = useState('');
  const [waLoading, setWaLoading] = useState(false);

  // Dashboard & Admin State
  const [stats, setStats] = useState({ total_orders: 0, total_revenue: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [apiStatus, setApiStatus] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Form States
  const [newProduct, setNewProduct] = useState({ name: '', price: '', image_url: '' });
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [newKey, setNewKey] = useState({ provider: '', name: '', api_key: '', base_url: '' });

  // Setup Axios Interceptor to always attach JWT Token
  useEffect(() => {
    axios.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          handleLogout(); // Token expired or invalid
        }
        return Promise.reject(error);
      }
    );
  }, [token]);

  // Fetch initial data when logged in
  useEffect(() => {
    if (token) {
      fetchProducts();
      if (currentView === 'dashboard') fetchDashboardData();
      if (currentView === 'pelanggan') fetchCustomers();
      if (currentView === 'pengaturan') fetchKeys();
    }
  }, [token, currentView]);

  // --- AUTHENTICATION LOGIC ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const res = await axios.post(`${API_URL}/auth/register`, authForm);
        alert(res.data.message);
        setAuthMode('login');
      } else {
        const res = await axios.post(`${API_URL}/auth/login`, { email: authForm.email, password: authForm.password });
        if (res.data.success) {
          localStorage.setItem('alio_token', res.data.token);
          localStorage.setItem('alio_store', res.data.store_name);
          setToken(res.data.token);
          setStoreName(res.data.store_name);
        }
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Terjadi kesalahan pada server');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('alio_token');
    localStorage.removeItem('alio_store');
    setToken(null);
    setStoreName('');
  };

  // --- DATA FETCHING ---
  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/products`);
      setProducts(response.data);
      const uniqueCategories = [...new Set(response.data.map(p => p.category).filter(c => c))];
      setCategories(['Semua', ...uniqueCategories]);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching products:", error);
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [statsRes, recentRes, keysRes] = await Promise.all([
        axios.get(`${API_URL}/stats`),
        axios.get(`${API_URL}/orders/recent`),
        axios.get(`${API_URL}/keys`)
      ]);
      setStats(statsRes.data);
      setRecentOrders(recentRes.data);
      setApiStatus(keysRes.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API_URL}/customers`);
      setCustomers(response.data);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchKeys = async () => {
    try {
      const response = await axios.get(`${API_URL}/keys`);
      setApiStatus(response.data);
    } catch (error) {
      console.error("Error fetching keys:", error);
    }
  };

  const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  // --- KASIR LOGIC ---
  const filteredProducts = products.filter(p => {
    const matchCategory = activeCategory === 'Semua' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const clearCart = () => setCart([]);
  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.qty), 0);
  const tax = subtotal * 0.11;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const response = await axios.post(`${API_URL}/orders`, { cart, subtotal, tax, total });
      if (response.data.success) {
        setLastOrderDetails({
          orderId: response.data.orderId, cart: [...cart], subtotal, tax, total, date: new Date().toLocaleString()
        });
        setShowSuccessModal(true);
        clearCart();
      }
    } catch (error) {
      alert('Gagal memproses pembayaran. Cek koneksi server.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handleSendWA = async () => {
    if (!waNumber) return alert('Masukkan nomor WA terlebih dahulu!');
    setWaLoading(true);
    try {
      const res = await axios.post(`${API_URL}/receipts/whatsapp`, {
        phone: waNumber, orderId: lastOrderDetails.orderId, total: lastOrderDetails.total
      });
      alert(res.data.message);
      setShowSuccessModal(false);
      setWaNumber('');
    } catch (error) {
      alert('Gagal mengirim WhatsApp.');
    } finally {
      setWaLoading(false);
    }
  };

  // --- ADMIN ACTIONS ---
  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/products`, newProduct);
      setNewProduct({ name: '', price: '', image_url: '' });
      fetchProducts();
      alert('Produk berhasil ditambahkan!');
    } catch (error) {
      alert('Gagal tambah produk.');
    }
  };

  const handleDeleteProduct = async (id) => {
    if(!window.confirm('Yakin hapus produk ini?')) return;
    try {
      await axios.delete(`${API_URL}/products/${id}`);
      fetchProducts();
    } catch (error) {
      alert('Gagal hapus produk.');
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/customers`, newCustomer);
      setNewCustomer({ name: '', phone: '' });
      fetchCustomers();
      alert('Pelanggan berhasil ditambahkan!');
    } catch (error) {
      alert('Gagal tambah pelanggan.');
    }
  };

  const handleDeleteCustomer = async (id) => {
    if(!window.confirm('Yakin hapus pelanggan ini?')) return;
    try {
      await axios.delete(`${API_URL}/customers/${id}`);
      fetchCustomers();
    } catch (error) {
      alert('Gagal hapus pelanggan.');
    }
  };

  const handleAddKey = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/keys`, newKey);
      setNewKey({ provider: '', name: '', api_key: '', base_url: '' });
      fetchKeys();
      alert('API Key berhasil ditambahkan!');
    } catch (error) {
      alert('Gagal tambah kunci.');
    }
  };

  const handleToggleKeyStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Alive' ? 'Dead' : 'Alive';
    try {
      await axios.put(`${API_URL}/keys/${id}/status`, { status: newStatus });
      fetchKeys();
    } catch (error) {
      alert('Gagal ubah status.');
    }
  };

  // =====================================
  // RENDER: LOGIN & REGISTER (PUBLIC)
  // =====================================
  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
        <div className="glass-panel" style={{ width: '400px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: 'var(--primary)', color: 'white', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Package size={32} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Alio SaaS POS</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
              {authMode === 'login' ? 'Masuk ke sistem kasir toko Anda' : 'Daftarkan bisnis Anda gratis'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {authMode === 'register' && (
              <div style={{ position: 'relative' }}>
                <Store size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6b7280' }} />
                <input required type="text" placeholder="Nama Toko" className="admin-input" style={{ paddingLeft: '44px' }} value={authForm.store_name} onChange={e => setAuthForm({...authForm, store_name: e.target.value})} />
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6b7280' }} />
              <input required type="email" placeholder="Email Toko" className="admin-input" style={{ paddingLeft: '44px' }} value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6b7280' }} />
              <input required type="password" placeholder="Password" className="admin-input" style={{ paddingLeft: '44px' }} value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            </div>
            <button type="submit" className="btn-primary" disabled={authLoading}>
              {authLoading ? <Loader2 className="animate-spin" size={20} /> : (authMode === 'login' ? 'Masuk Sekarang' : 'Daftar Sekarang')}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>
            {authMode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <span style={{ color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? 'Daftar di sini' : 'Masuk di sini'}
            </span>
          </div>
        </div>
      </div>
    );
  }


  // =====================================
  // RENDER: PRIVATE VIEWS (LOGGED IN)
  // =====================================
  const renderDashboard = () => (
    <div className="dashboard-container" style={{ padding: '32px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Dashboard Keuangan</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}><TrendingUp size={20} color="#10B981" /> <span>Total Omzet Hari Ini</span></div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#1f2937' }}>{formatRupiah(stats.total_revenue || 0)}</div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}><ShoppingCart size={20} color="#4F46E5" /> <span>Total Transaksi</span></div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#1f2937' }}>{stats.total_orders || 0}</div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}><ShieldCheck size={20} color="#EC4899" /> <span>Status Omni-API</span></div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>
            {apiStatus.some(k => k.status === 'Alive') ? '✅ Aman (Rotator Aktif)' : '⚠️ Warning (Semua Limit)'}
          </div>
        </div>
      </div>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>5 Transaksi Terakhir</h2>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)' }}><th style={{ padding: '12px 0' }}>Order ID</th><th style={{ padding: '12px 0' }}>Waktu</th><th style={{ padding: '12px 0' }}>Total</th><th style={{ padding: '12px 0' }}>Status</th></tr></thead>
          <tbody>
            {recentOrders.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <td style={{ padding: '12px 0', fontWeight: 600 }}>#{o.id}</td><td style={{ padding: '12px 0', color: '#6b7280' }}>{o.time}</td>
                <td style={{ padding: '12px 0', fontWeight: 700, color: '#4F46E5' }}>{formatRupiah(o.total)}</td>
                <td style={{ padding: '12px 0' }}><span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProduk = () => (
    <div className="dashboard-container" style={{ padding: '32px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Manajemen Produk</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <form onSubmit={handleAddProduct} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>+ Tambah Produk Baru</h2>
          <input required type="text" placeholder="Nama Produk" className="admin-input" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
          <input required type="number" placeholder="Harga (Rp)" className="admin-input" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
          <input required type="url" placeholder="URL Link Gambar" className="admin-input" value={newProduct.image_url} onChange={e => setNewProduct({...newProduct, image_url: e.target.value})} />
          <button type="submit" className="btn-primary"><PlusCircle size={18}/> Tambah</button>
        </form>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Daftar Produk</h2>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Foto</th><th>Nama</th><th>Harga</th><th>Aksi</th></tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td><img src={p.image_url || p.image} alt={p.name} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}/></td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ color: '#4F46E5', fontWeight: 700 }}>{formatRupiah(p.price)}</td>
                    <td><button onClick={() => handleDeleteProduct(p.id)} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPelanggan = () => (
    <div className="dashboard-container" style={{ padding: '32px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Database Pelanggan</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <form onSubmit={handleAddCustomer} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>+ Tambah Pelanggan Baru</h2>
          <input required type="text" placeholder="Nama Pelanggan" className="admin-input" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
          <input required type="text" placeholder="Nomor WA (contoh: 0812...)" className="admin-input" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
          <button type="submit" className="btn-primary"><PlusCircle size={18}/> Tambah</button>
        </form>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Daftar Kontak</h2>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Nama</th><th>Nomor WA</th><th>Poin loyalitas</th><th>Aksi</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ color: '#6b7280' }}>{c.phone}</td>
                    <td style={{ color: '#10B981', fontWeight: 700 }}>{c.points} Poin</td>
                    <td><button onClick={() => handleDeleteCustomer(c.id)} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPengaturan = () => (
    <div className="dashboard-container" style={{ padding: '32px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Pusat Pengaturan API Key</h1>
      <p style={{ color: '#6b7280' }}>Sistem Omni-API Gateway otomatis merotasi kunci yang limit ke kunci lain yang "Alive".</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <form onSubmit={handleAddKey} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>+ Tambah API Key Baru</h2>
          <select required className="admin-input" value={newKey.provider} onChange={e => setNewKey({...newKey, provider: e.target.value})}>
            <option value="">Pilih Provider...</option>
            <option value="whatsapp">WhatsApp (Fonnte/Wablas)</option>
            <option value="ai_assistant">AI Assistant (OpenAI/Groq)</option>
          </select>
          <input required type="text" placeholder="Nama Kunci (misal: Fonnte - CS 1)" className="admin-input" value={newKey.name} onChange={e => setNewKey({...newKey, name: e.target.value})} />
          <input required type="text" placeholder="API Key Rahasia" className="admin-input" value={newKey.api_key} onChange={e => setNewKey({...newKey, api_key: e.target.value})} />
          <input required type="url" placeholder="Endpoint URL (Base URL)" className="admin-input" value={newKey.base_url} onChange={e => setNewKey({...newKey, base_url: e.target.value})} />
          <button type="submit" className="btn-primary"><Save size={18}/> Simpan Kunci</button>
        </form>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Daftar Kunci Rotator</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {apiStatus.map(key => (
              <div key={key.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px' }}>{key.name} <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>({key.provider})</span></div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Dipakai: {key.used_count}x | Endpoint: {key.base_url}</div>
                </div>
                <button 
                  onClick={() => handleToggleKeyStatus(key.id, key.status)}
                  style={{ 
                  background: key.status === 'Alive' ? '#dcfce7' : '#fee2e2', 
                  color: key.status === 'Alive' ? '#166534' : '#991b1b', 
                  padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: 'none'
                }}>
                  {key.status} (Klik ubah)
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderKasir = () => (
    <>
      <main className="glass-panel main-area">
        <header className="header">
          <h1>Pesan Menu</h1>
          <div className="search-bar"><Search size={18} color="#6b7280" /><input type="text" placeholder="Cari produk..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
        </header>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#4F46E5' }}><Loader2 className="animate-spin" size={48} /></div> : (
          <>
            <div className="categories">
              {categories.map(cat => <div key={cat} className={`category-chip ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</div>)}
            </div>
            <div className="product-grid">
              {filteredProducts.map(product => (
                <div key={product.id} className="product-card" onClick={() => addToCart(product)}>
                  <div className="product-image-container"><img src={product.image_url || product.image} alt={product.name} className="product-image" loading="lazy" /></div>
                  <div className="product-title">{product.name}</div>
                  <div className="product-price">{formatRupiah(product.price)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      <aside className="glass-panel cart-area">
        <div className="cart-header"><h2>Pesanan</h2>{cart.length > 0 && <button className="clear-cart" onClick={clearCart}>Kosongkan</button>}</div>
        {cart.length === 0 ? <div className="empty-cart"><div className="empty-cart-icon"><ShoppingCart size={32} /></div><p>Belum ada pesanan</p></div> : (
          <>
            <div className="cart-items">
              {cart.map(item => (
                <div key={item.id} className="cart-item">
                  <img src={item.image_url || item.image} alt={item.name} className="cart-item-img" />
                  <div className="cart-item-details"><div className="cart-item-title">{item.name}</div><div className="cart-item-price">{formatRupiah(item.price)}</div></div>
                  <div className="cart-item-actions">
                    <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>{item.qty === 1 ? <Trash2 size={14} color="#ef4444" /> : <Minus size={14} />}</button>
                    <span className="qty-value">{item.qty}</span>
                    <button className="qty-btn" onClick={() => updateQty(item.id, 1)}><Plus size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              <div className="summary-row"><span>Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
              <div className="summary-row"><span>Pajak (11%)</span><span>{formatRupiah(tax)}</span></div>
              <div className="summary-total"><span>Total</span><span>{formatRupiah(total)}</span></div>
              <button className="btn-primary" onClick={handleCheckout} disabled={checkoutLoading} style={{ opacity: checkoutLoading ? 0.7 : 1 }}>
                {checkoutLoading ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />} {checkoutLoading ? 'Memproses...' : 'Bayar Sekarang'}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );

  return (
    <>
      <div className="app-container" style={currentView !== 'kasir' ? { gridTemplateColumns: '240px 1fr' } : {}}>
        <aside className="glass-panel sidebar">
          <div className="logo-container">
            <div className="logo-icon"><Package size={28} /></div>
            <div>
              <div className="logo-text">Alio POS</div>
              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>Toko: {storeName}</div>
            </div>
          </div>
          <nav className="nav-menu" style={{ flex: 1 }}>
            <div className={`nav-item ${currentView === 'kasir' ? 'active' : ''}`} onClick={() => setCurrentView('kasir')}><ShoppingCart size={20} /> Kasir</div>
            <div className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}><LayoutDashboard size={20} /> Dashboard</div>
            <div className={`nav-item ${currentView === 'produk' ? 'active' : ''}`} onClick={() => setCurrentView('produk')}><Package size={20} /> Produk</div>
            <div className={`nav-item ${currentView === 'pelanggan' ? 'active' : ''}`} onClick={() => setCurrentView('pelanggan')}><Users size={20} /> Pelanggan</div>
            <div className={`nav-item ${currentView === 'pengaturan' ? 'active' : ''}`} onClick={() => setCurrentView('pengaturan')}><Settings size={20} /> Pengaturan</div>
          </nav>
          
          <button 
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', color: '#ef4444', fontWeight: 700, cursor: 'pointer', marginTop: 'auto' }}>
            <LogOut size={18} /> Keluar (Logout)
          </button>
        </aside>

        {currentView === 'kasir' && renderKasir()}
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'produk' && renderProduk()}
        {currentView === 'pelanggan' && renderPelanggan()}
        {currentView === 'pengaturan' && renderPengaturan()}
      </div>

      {showSuccessModal && lastOrderDetails && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: '#dcfce7', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#166534' }}><CreditCard size={32} /></div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Transaksi Sukses!</h2>
              <p style={{ color: '#6b7280', marginBottom: '24px' }}>Order #{lastOrderDetails.orderId} • {formatRupiah(lastOrderDetails.total)}</p>
            </div>
            <div className="modal-btn-group">
              <button className="btn-outline" onClick={handlePrint}><Printer size={20} /> Cetak Struk (Kertas)</button>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <input type="text" placeholder="Nomor WA..." value={waNumber} onChange={e => setWaNumber(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', outline: 'none' }} />
                <button className="btn-primary" style={{ margin: 0, padding: '0 20px' }} onClick={handleSendWA} disabled={waLoading}>{waLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}</button>
              </div>
            </div>
            <button style={{ marginTop: '16px', background: 'transparent', border: 'none', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowSuccessModal(false)}>Tutup & Transaksi Baru</button>
          </div>
        </div>
      )}

      {lastOrderDetails && (
        <div className="print-only">
          <div className="struk-header"><h2>{storeName}</h2><div>Order: #{lastOrderDetails.orderId}</div><div>Waktu: {lastOrderDetails.date}</div></div>
          <div className="struk-body">
            {lastOrderDetails.cart.map((item, idx) => (
              <div key={idx} className="struk-item"><div style={{ flex: 1 }}>{item.name} <br/> {item.qty}x @ {formatRupiah(item.price)}</div><div>{formatRupiah(item.price * item.qty)}</div></div>
            ))}
          </div>
          <div className="struk-summary">
            <div className="struk-item"><div>Subtotal</div><div>{formatRupiah(lastOrderDetails.subtotal)}</div></div>
            <div className="struk-item"><div>PPN (11%)</div><div>{formatRupiah(lastOrderDetails.tax)}</div></div>
            <div className="struk-total"><div>TOTAL</div><div>{formatRupiah(lastOrderDetails.total)}</div></div>
          </div>
          <div className="struk-footer">Terima kasih atas kunjungan Anda!<br/>Powered by Alio SaaS POS</div>
        </div>
      )}
    </>
  );
}

export default App;
