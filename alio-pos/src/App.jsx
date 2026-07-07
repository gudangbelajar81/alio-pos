import { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  ShoppingCart, Package, LayoutDashboard, Plus, Minus, Trash2, 
  CreditCard, Loader2, Users, Printer, Send, LogOut, Settings, 
  TrendingUp, ShieldCheck, PlusCircle, Store, Mail, Lock, Download, KeyRound
} from 'lucide-react';
import './App.css';

let API_URL = import.meta.env.VITE_API_URL || 'https://alio-pos-production-738a.up.railway.app/api'; if (API_URL && !API_URL.endsWith('/api')) API_URL += '/api';
const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY || '';

function App() {
  const [token, setToken] = useState(localStorage.getItem('alio_token') || '');
  const [storeName, setStoreName] = useState(localStorage.getItem('alio_store') || '');
  
  // Auth State
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ store_name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);

  // App State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [cart, setCart] = useState([]);
  const [currentView, setCurrentView] = useState('kasir'); // kasir, dashboard, produk, pelanggan, pengaturan
  const [loading, setLoading] = useState(true);

  // Phase 9 States
  const [storeSettings, setStoreSettings] = useState({ admin_pin: '1234', store_logo: '', theme_color: '#4F46E5', tax_rate: 11 });
  const [isLocked, setIsLocked] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [discountValue, setDiscountValue] = useState(0);

  // Checkout State
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderDetails, setLastOrderDetails] = useState(null);
  const [waNumber, setWaNumber] = useState('');
  const [waLoading, setWaLoading] = useState(false);

  // Dashboard & Admin State
  const [stats, setStats] = useState({ total_orders: 0, total_revenue: 0, chartData: [] });
  const [recentOrders, setRecentOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]); // for export
  const [apiStatus, setApiStatus] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Form States
  const [newProduct, setNewProduct] = useState({ name: '', price: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [newKey, setNewKey] = useState({ provider: '', name: '', api_key: '', base_url: '' });

  useEffect(() => {
    axios.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) handleLogout();
        return Promise.reject(error);
      }
    );
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchProducts();
      fetchSettings();
    }
  }, [token]);

  useEffect(() => {
    if (token && currentView !== 'kasir' && !isLocked) {
      if (currentView === 'dashboard') fetchDashboardData();
      if (currentView === 'pelanggan') fetchCustomers();
      if (currentView === 'pengaturan') fetchKeys();
    }
  }, [token, currentView, isLocked]);

  useEffect(() => {
    if (storeSettings.theme_color) {
      document.documentElement.style.setProperty('--primary', storeSettings.theme_color);
    }
  }, [storeSettings.theme_color]);

  // --- FETCHERS ---
  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/settings`);
      setStoreSettings(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/products`);
      setProducts(res.data);
      const uniqueCats = ['Semua', ...new Set(res.data.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCats);
    } catch (error) {
      console.error("Gagal load produk", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [statsRes, recentRes, apiRes, allRes] = await Promise.all([
        axios.get(`${API_URL}/stats`),
        axios.get(`${API_URL}/orders/recent`),
        axios.get(`${API_URL}/keys`),
        axios.get(`${API_URL}/orders/all`)
      ]);
      setStats(statsRes.data);
      setRecentOrders(recentRes.data);
      setApiStatus(apiRes.data);
      setAllOrders(allRes.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_URL}/customers`);
      setCustomers(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchKeys = async () => {
    try {
      const res = await axios.get(`${API_URL}/keys`);
      setApiStatus(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  // --- AUTH ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const res = await axios.post(`${API_URL}${endpoint}`, authForm);
      if (authMode === 'login') {
        localStorage.setItem('alio_token', res.data.token);
        localStorage.setItem('alio_store', res.data.store_name);
        setToken(res.data.token);
        setStoreName(res.data.store_name);
      } else {
        alert('Registrasi sukses! Silakan login.');
        setAuthMode('login');
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Terjadi kesalahan jaringan.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('alio_token');
    localStorage.removeItem('alio_store');
    setToken('');
    setStoreName('');
    setIsLocked(true);
    setCart([]);
  };

  // --- CART LOGIC ---
  const filteredProducts = activeCategory === 'Semua' ? products : products.filter(p => p.category === activeCategory);
  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    else setCart([...cart, { ...product, qty: 1 }]);
  };
  const updateQty = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) return { ...item, qty: Math.max(0, item.qty + delta) };
      return item;
    }).filter(item => item.qty > 0));
  };
  const clearCart = () => { setCart([]); setDiscountValue(0); };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountAmount = Number(discountValue) || 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tax = taxableAmount * (storeSettings.tax_rate / 100);
  const total = taxableAmount + tax;

  const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);

  // --- CHECKOUT ---
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const res = await axios.post(`${API_URL}/orders`, { cart, subtotal, tax, discount: discountAmount, total });
      setLastOrderDetails({ orderId: res.data.orderId, cart, subtotal, tax, discount: discountAmount, total, date: new Date().toLocaleString('id-ID') });
      setShowSuccessModal(true);
      clearCart();
      if(currentView === 'dashboard') fetchDashboardData();
    } catch (error) {
      alert('Gagal memproses transaksi.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePrint = () => window.print();
  
  const handleSendWA = async () => {
    if (!waNumber) return alert('Masukkan nomor WA pelanggan!');
    setWaLoading(true);
    try {
      await axios.post(`${API_URL}/receipts/whatsapp`, { phone: waNumber, orderId: lastOrderDetails.orderId, total: lastOrderDetails.total });
      alert('Struk berhasil dikirim ke WhatsApp!');
      setShowSuccessModal(false);
      setWaNumber('');
    } catch (error) {
      alert('Gagal mengirim WA.');
    } finally {
      setWaLoading(false);
    }
  };

  // --- EXPORT CSV ---
  const exportToCSV = () => {
    const headers = ['Order ID', 'Tanggal', 'Subtotal', 'Diskon', 'Pajak', 'Total', 'Status'];
    const csvContent = [
      headers.join(','),
      ...allOrders.map(o => `${o.id},${o.datetime},${o.subtotal},${o.discount},${o.tax_amount},${o.total},${o.status}`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Laporan_AlioBos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- ADMIN ACTIONS ---
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!imageFile && !newProduct.image_url) return alert('Silakan pilih gambar produk (Jepret/Galeri)!');
    setUploadingImage(true);
    try {
      let finalImageUrl = newProduct.image_url || '';
      if (imageFile) {
        if (!IMGBB_API_KEY) return alert('API Key ImgBB belum dipasang di Vercel/Env.');
        const formData = new FormData(); formData.append('image', imageFile);
        const imgbbRes = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, formData);
        finalImageUrl = imgbbRes.data.data.url;
      }
      await axios.post(`${API_URL}/products`, { ...newProduct, image_url: finalImageUrl });
      setNewProduct({ name: '', price: '' }); setImageFile(null); setImagePreview('');
      fetchProducts(); alert('Produk berhasil ditambahkan!');
    } catch (error) {
      console.error(error); alert('Gagal tambah produk: ' + (error.response?.data?.error?.message || error.response?.data?.error || error.message));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if(!window.confirm('Yakin hapus produk ini?')) return;
    try { await axios.delete(`${API_URL}/products/${id}`); fetchProducts(); } catch (error) { alert('Gagal hapus produk.'); }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      let finalLogo = storeSettings.store_logo;
      if (imageFile) {
        if (!IMGBB_API_KEY) return alert('API Key ImgBB belum dipasang!');
        const formData = new FormData(); formData.append('image', imageFile);
        const imgbbRes = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, formData);
        finalLogo = imgbbRes.data.data.url;
      }
      await axios.put(`${API_URL}/settings`, { ...storeSettings, store_logo: finalLogo });
      setImageFile(null); setImagePreview('');
      setStoreName(storeSettings.store_name);
      alert('Pengaturan Toko Berhasil Disimpan!');
    } catch (error) {
      alert('Gagal menyimpan pengaturan: ' + (error.response?.data?.error?.message || error.response?.data?.error || error.message));
    }
  };

  // =====================================
  // RENDER BLOCKS
  // =====================================
  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
        <div className="glass-panel" style={{ width: '400px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: 'var(--primary)', color: 'white', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Package size={32} /></div>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Alio Bos SaaS</h1>
            <p style={{ color: 'var(--text-muted)' }}>{authMode === 'login' ? 'Masuk ke sistem kasir' : 'Daftar bisnis gratis'}</p>
          </div>
          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {authMode === 'register' && (
              <div style={{ position: 'relative' }}><Store size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6b7280' }} /><input required type="text" placeholder="Nama Toko" className="admin-input" style={{ paddingLeft: '44px' }} value={authForm.store_name} onChange={e => setAuthForm({...authForm, store_name: e.target.value})} /></div>
            )}
            <div style={{ position: 'relative' }}><Mail size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6b7280' }} /><input required type="email" placeholder="Email Toko" className="admin-input" style={{ paddingLeft: '44px' }} value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} /></div>
            <div style={{ position: 'relative' }}><Lock size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6b7280' }} /><input required type="password" placeholder="Password" className="admin-input" style={{ paddingLeft: '44px' }} value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} /></div>
            <button type="submit" className="btn-primary" disabled={authLoading}>{authLoading ? <Loader2 className="animate-spin" size={20} /> : (authMode === 'login' ? 'Masuk' : 'Daftar')}</button>
          </form>
          <div style={{ textAlign: 'center', fontSize: '14px' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Daftar Baru' : 'Login'}</span>
          </div>
        </div>
      </div>
    );
  }

  const checkPin = (e) => {
    e.preventDefault();
    if (pinInput === storeSettings.admin_pin) { setIsLocked(false); setPinInput(''); }
    else alert('PIN Salah!');
  };

  const renderPinLock = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
      <form onSubmit={checkPin} className="glass-panel" style={{ padding: '40px', textAlign: 'center', width: '350px' }}>
        <div style={{ background: '#fee2e2', color: '#ef4444', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><KeyRound size={32} /></div>
        <h2 style={{ marginBottom: '8px' }}>Area Terkunci</h2>
        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>Masukkan PIN Admin untuk mengakses menu ini.</p>
        <input type="password" placeholder="PIN" required className="admin-input" style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }} value={pinInput} onChange={e => setPinInput(e.target.value)} maxLength={6} />
        <button type="submit" className="btn-primary" style={{ marginTop: '16px' }}>Buka Kunci</button>
      </form>
    </div>
  );

  const renderKasir = () => (
    <>
      <main className="main-content">
        <header className="header" style={{ paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Mulai Transaksi</h1>
          <p style={{ color: 'var(--text-muted)' }}>Pilih produk untuk ditambahkan ke pesanan</p>
        </header>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', height: '100%' }}><Loader2 className="animate-spin" size={48} /></div> : (
          <>
            <div className="categories">{categories.map(cat => <div key={cat} className={`category-chip ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</div>)}</div>
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
        {cart.length === 0 ? <div className="empty-cart"><ShoppingCart size={32} /><p>Belum ada pesanan</p></div> : (
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
              <div className="summary-row" style={{ alignItems: 'center' }}>
                <span>Diskon (Rp)</span>
                <input type="number" className="admin-input" style={{ width: '100px', padding: '4px 8px', textAlign: 'right', margin: 0 }} value={discountValue} onChange={e => setDiscountValue(e.target.value)} />
              </div>
              <div className="summary-row"><span>Pajak ({storeSettings.tax_rate}%)</span><span>{formatRupiah(tax)}</span></div>
              <div className="summary-total"><span>Total</span><span>{formatRupiah(total)}</span></div>
              <button className="btn-primary" onClick={handleCheckout} disabled={checkoutLoading}>
                {checkoutLoading ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />} {checkoutLoading ? 'Memproses...' : 'Bayar Sekarang'}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );

  const renderDashboard = () => (
    <div className="dashboard-container" style={{ padding: '32px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Dashboard Keuangan</h1>
        <button onClick={exportToCSV} className="btn-primary" style={{ display: 'flex', gap: '8px' }}><Download size={18}/> Export CSV</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}><TrendingUp size={20} color="#10B981" /> <span>Total Omzet Hari Ini</span></div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#1f2937' }}>{formatRupiah(stats.total_revenue || 0)}</div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}><ShoppingCart size={20} color="#4F46E5" /> <span>Total Transaksi</span></div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#1f2937' }}>{stats.total_orders || 0}</div>
        </div>
      </div>
      <div className="glass-panel" style={{ padding: '24px', height: '300px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Grafik Omzet (7 Hari Terakhir)</h2>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.chartData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(val) => formatRupiah(val)} />
            <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
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
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: '#4b5563', marginBottom: '8px', display: 'block' }}>Foto Produk</label>
            <input type="file" accept="image/*" capture="environment" onChange={e => { const file = e.target.files[0]; if(file){ setImageFile(file); setImagePreview(URL.createObjectURL(file)); } }} style={{ width: '100%', padding: '10px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }} />
          </div>
          {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '12px' }} />}
          <button type="submit" className="btn-primary" disabled={uploadingImage}>{uploadingImage ? 'Menyimpan...' : 'Tambah Produk'}</button>
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
                    <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{formatRupiah(p.price)}</td>
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

  const renderPengaturan = () => (
    <div className="dashboard-container" style={{ padding: '32px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Pengaturan Toko</h1>
      
      <form onSubmit={handleUpdateSettings} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Profil & Keamanan</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Nama Toko</label>
            <input required type="text" className="admin-input" value={storeSettings.store_name} onChange={e => setStoreSettings({...storeSettings, store_name: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>PIN Admin (Keamanan)</label>
            <input required type="text" maxLength={6} className="admin-input" value={storeSettings.admin_pin} onChange={e => setStoreSettings({...storeSettings, admin_pin: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Pajak Transaksi (%)</label>
            <input required type="number" step="0.01" className="admin-input" value={storeSettings.tax_rate} onChange={e => setStoreSettings({...storeSettings, tax_rate: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Tema Warna Aplikasi</label>
            <input type="color" style={{ width: '100%', height: '48px', padding: '4px', cursor: 'pointer' }} value={storeSettings.theme_color} onChange={e => setStoreSettings({...storeSettings, theme_color: e.target.value})} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Logo Toko Baru (Biarkan kosong jika tidak diganti)</label>
            <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if(f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); } }} className="admin-input" />
            {(imagePreview || storeSettings.store_logo) && (
              <img src={imagePreview || storeSettings.store_logo} alt="Logo" style={{ marginTop: '12px', height: '100px', borderRadius: '12px', objectFit: 'cover' }} />
            )}
          </div>
        </div>
        <button type="submit" className="btn-primary" style={{ width: '200px' }}>Simpan Pengaturan</button>
      </form>
    </div>
  );

  return (
    <>
      <div className="app-container" style={currentView !== 'kasir' && (!isLocked || currentView==='kasir') ? { gridTemplateColumns: '240px 1fr' } : { gridTemplateColumns: '240px 1fr' }}>
        <aside className="glass-panel sidebar">
          <div className="logo-container">
            {storeSettings.store_logo ? <img src={storeSettings.store_logo} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '8px' }} /> : <div className="logo-icon"><Package size={28} /></div>}
            <div>
              <div className="logo-text">{storeName}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>SaaS POS</div>
            </div>
          </div>
          <nav className="nav-menu" style={{ flex: 1 }}>
            <div className={`nav-item ${currentView === 'kasir' ? 'active' : ''}`} onClick={() => setCurrentView('kasir')}><ShoppingCart size={20} /> Kasir</div>
            <div className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}><LayoutDashboard size={20} /> Dashboard</div>
            <div className={`nav-item ${currentView === 'produk' ? 'active' : ''}`} onClick={() => setCurrentView('produk')}><Package size={20} /> Produk</div>
            <div className={`nav-item ${currentView === 'pengaturan' ? 'active' : ''}`} onClick={() => setCurrentView('pengaturan')}><Settings size={20} /> Pengaturan</div>
          </nav>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', color: '#ef4444', fontWeight: 700, cursor: 'pointer', marginTop: 'auto' }}><LogOut size={18} /> Logout</button>
        </aside>

        {currentView === 'kasir' ? renderKasir() : (isLocked ? renderPinLock() : 
          currentView === 'dashboard' ? renderDashboard() :
          currentView === 'produk' ? renderProduk() :
          currentView === 'pengaturan' ? renderPengaturan() : null
        )}
      </div>

      {showSuccessModal && lastOrderDetails && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: '#dcfce7', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#166534' }}><CreditCard size={32} /></div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Transaksi Sukses!</h2>
              <p style={{ color: '#6b7280', marginBottom: '24px' }}>Order #{lastOrderDetails.orderId} - {formatRupiah(lastOrderDetails.total)}</p>
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
            <div className="struk-item"><div>Diskon</div><div>-{formatRupiah(lastOrderDetails.discount)}</div></div>
            <div className="struk-item"><div>PPN ({storeSettings.tax_rate}%)</div><div>{formatRupiah(lastOrderDetails.tax)}</div></div>
            <div className="struk-total"><div>TOTAL</div><div>{formatRupiah(lastOrderDetails.total)}</div></div>
          </div>
          <div className="struk-footer">Terima kasih atas kunjungan Anda!<br/>Powered by Alio Bos SaaS</div>
        </div>
      )}
    </>
  );
}
export default App;
