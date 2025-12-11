import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Wallet, PieChart, PlusCircle, MinusCircle, TrendingUp, TrendingDown, 
  Activity, LayoutDashboard, Table, Settings, Save, Trash2, Globe, 
  Sparkles, Camera, Loader, Landmark, CreditCard, Coins, Briefcase, 
  ArrowRightLeft, FileText, BarChart3, Building2, Bitcoin, Users, Tags,
  ChevronRight, Calendar, User, X, Edit3, Filter, Eye, EyeOff 
} from 'lucide-react';

// --- CONFIG ---
// GANTI DENGAN URL DEPLOYMENT GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbyOm_at2rcnra8KqMOKiKGwQ_SI3r2SoQCfSl5W2S10UGQbI5U0gr3TEk6TUfctGKlpwg/exec"; 

const callGemini = async (prompt, base64Data = null, mimeType = "image/jpeg") => {
  // ⚠️ WAJIB DIISI: Dapatkan kunci di https://aistudio.google.com/app/apikey
  const apiKey = "AIzaSyAA3yjQTvQ6zhs13ESwZkrSXFFCECSvL-8"; // <--- TEMPEL API KEY ANDA DI DALAM TANDA KUTIP INI
  
  if (!apiKey) {
      alert("Gagal: API Key Gemini belum diisi di kode App.jsx!");
      throw new Error("API Key Kosong");
  }

  // Menggunakan model gemini-1.5-flash yang stabil
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const parts = [{ text: prompt }];
  if (base64Data) {
    parts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    });
    
    if (!response.ok) {
       const errData = await response.json();
       console.error("Gemini API Error Detail:", errData);
       throw new Error(errData.error?.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error("AI tidak memberikan respon.");
    }
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Gemini Fetch Error:", error);
    throw error; 
  }
};

const DataService = {
  fetchData: async () => {
    try {
      const res = await fetch(API_URL);
      return await res.json();
    } catch (e) { return null; }
  },

  addTransaction: async (tx) => {
    await fetch(API_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', ...tx })
    });
  },

  updateTransaction: async (tx) => {
    await fetch(API_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', ...tx })
    });
  },

  deleteTransaction: async (id) => {
    await fetch(API_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: id })
    });
  },

  manageSetting: async (action, type, value) => {
    await fetch(API_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, settingType: type, value: value })
    });
  }
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>{children}</div>
);

const Badge = ({ type, children }) => {
  const colors = {
    income: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    expense: 'bg-rose-100 text-rose-700 border-rose-200',
    transfer: 'bg-blue-100 text-blue-700 border-blue-200',
    adjustment_plus: 'bg-amber-100 text-amber-700 border-amber-200',
    adjustment_minus: 'bg-amber-100 text-amber-700 border-amber-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200'
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${colors[type] || colors.neutral}`}>{children}</span>;
};

const ASSET_TYPES = {
  'BANK': { label: 'Kas & Bank', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
  'INVESTMENT': { label: 'Investasi', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'COMMODITY': { label: 'Komoditas (Emas/Perak)', icon: Coins, color: 'text-amber-600', bg: 'bg-amber-50' },
  'CRYPTO': { label: 'Kripto', icon: Bitcoin, color: 'text-purple-600', bg: 'bg-purple-50' },
  'PROPERTY': { label: 'Properti', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  'OTHER': { label: 'Lainnya', icon: Briefcase, color: 'text-slate-600', bg: 'bg-slate-50' }
};

export default function App() {
  const [data, setData] = useState({ 
    transactions: [], 
    users: ['Ayah', 'Bunda', 'Kakak', 'Adik'], 
    categories: [
        'Gaji Bulanan', 'Tunjangan Tetap', 'THR', 'Bonus Tahunan', 'Side Hustle', 'Dividen/Bunga', 'Uang Sewa',
        'KPR/Sewa Rumah', 'Listrik/Air/Internet', 'SPP/Pendidikan', 'Cicilan Utang', 'Asuransi', 'Gaji ART',
        'Belanja Dapur', 'Belanja Harian', 'Transportasi/BBM', 'Uang Saku Anak', 'Pulsa/Data',
        'Kondangan/Sumbangan', 'Arisan', 'Zakat/Sedekah', 'Hiburan Keluarga', 'Skincare/Personal',
        'Dana Darurat', 'Investasi', 'Dana Pensiun', 'Sinking Fund'
    ], 
    placements: [
        'Mandiri Ayah:BANK', 'Mandiri Bunda:BANK', 'BRI Ayah:BANK', 'BSI Bunda:BANK', 'Rekening A:BANK', 'Rekening B:BANK', 'Dompet Tunai:BANK',
        'Saham:INVESTMENT', 'Obligasi:INVESTMENT', 'Pembiayaan:INVESTMENT',
        'Kripto:CRYPTO',
        'Emas Batangan:COMMODITY', 'Emas Perhiasan:COMMODITY', 'Silver:COMMODITY'
    ], 
    settings: { currency: 'IDR' }
  });
  
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [notification, setNotification] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [showAssets, setShowAssets] = useState(true); 
  
  const [editingId, setEditingId] = useState(null);

  const [filter, setFilter] = useState({ 
    month: new Date().getMonth(), 
    year: new Date().getFullYear(),
    type: 'month' 
  });

  const [scannedTransactions, setScannedTransactions] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningStatement, setIsScanningStatement] = useState(false);
  const fileInputRef = useRef(null);
  const statementInputRef = useRef(null);

  const parsedPlacements = useMemo(() => data.placements.map(p => {
    const [name, type] = p.includes(':') ? p.split(':') : [p, 'OTHER'];
    return { name, type: type || 'OTHER', original: p };
  }), [data.placements]);

  useEffect(() => { loadLiveData(); }, []);

  const loadLiveData = async () => {
    setLoading(true);
    const cloud = await DataService.fetchData();
    if (cloud) setData(prev => ({ ...prev, ...cloud }));
    setLoading(false);
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddSetting = async (type, value) => {
    if (!value) return;
    const keyMap = { 'CATEGORY': 'categories', 'USER': 'users', 'PLACEMENT': 'placements' };
    setData(prev => ({ ...prev, [keyMap[type]]: [...prev[keyMap[type]], value] }));
    showNotification("Menyimpan...");
    await DataService.manageSetting('add_setting', type, value);
    showNotification("Berhasil disimpan!");
  };

  const handleDeleteSetting = async (type, value) => {
    if (!confirm(`Hapus ${value}?`)) return;
    const keyMap = { 'CATEGORY': 'categories', 'USER': 'users', 'PLACEMENT': 'placements' };
    setData(prev => ({ ...prev, [keyMap[type]]: prev[keyMap[type]].filter(i => i !== value) }));
    await DataService.manageSetting('delete_setting', type, value);
    showNotification("Terhapus.");
  };

  const [formData, setFormData] = useState({ type: 'expense', amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '', user: '', placement: '', toPlacement: '' });

  useEffect(() => {
    if (data.categories.length && !formData.category) setFormData(p => ({...p, category: data.categories[0], user: data.users[0]}));
    if (parsedPlacements.length && !formData.placement) setFormData(p => ({...p, placement: parsedPlacements[0].original}));
  }, [data.categories, data.users, parsedPlacements]);

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (editingId) {
        const updatedTx = { id: editingId, ...formData, amount: Number(formData.amount) };
        setData(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === editingId ? updatedTx : t) }));
        showNotification("Mengupdate data...");
        await DataService.updateTransaction(updatedTx);
        showNotification("Data berhasil diubah!");
        setEditingId(null);
    } else {
        const newTx = { id: Date.now().toString(), ...formData, amount: Number(formData.amount) };
        setData(prev => ({ ...prev, transactions: [newTx, ...prev.transactions] }));
        showNotification("Menyimpan...");
        await DataService.addTransaction(newTx);
        showNotification("Tersimpan!");
    }
    setFormData(prev => ({ ...prev, amount: '', note: '' }));
    setView('dashboard');
  };

  const handleEditClick = (tx) => {
    setFormData({
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        date: tx.date,
        note: tx.note,
        user: tx.user,
        placement: tx.placement,
        toPlacement: tx.toPlacement || ''
    });
    setEditingId(tx.id);
    setView('add');
    showNotification("Masuk mode edit.");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(prev => ({ ...prev, amount: '', note: '' }));
    showNotification("Edit dibatalkan.");
  };

  const handleDelete = async (id) => {
    if(confirm("Hapus data ini?")) {
      setData(prev => ({ ...prev, transactions: prev.transactions.filter(t => String(t.id) !== String(id)) }));
      await DataService.deleteTransaction(String(id));
    }
  };

  const formatCurrency = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  const stats = useMemo(() => {
    const balances = {}; 
    data.placements.forEach(p => balances[p] = 0);
    
    data.transactions.forEach(t => {
      const v = Number(t.amount);
      if (t.type === 'income' || t.type === 'adjustment_plus') balances[t.placement] += v;
      if (t.type === 'expense' || t.type === 'adjustment_minus') balances[t.placement] -= v;
      if (t.type === 'transfer') {
        balances[t.placement] -= v;
        if(t.toPlacement) balances[t.toPlacement] += v;
      }
    });
    
    const net = Object.values(balances).reduce((a,b)=>a+b, 0);
    const assetAlloc = {};
    parsedPlacements.forEach(p => {
      const val = balances[p.original] || 0;
      if(val > 0) assetAlloc[p.type] = (assetAlloc[p.type] || 0) + val;
    });

    let periodIncome = 0;
    let periodExpense = 0;
    const categoryBreakdown = {};

    const filteredTx = data.transactions.filter(t => {
        const d = new Date(t.date);
        const matchYear = d.getFullYear() === filter.year;
        const matchMonth = filter.type === 'month' ? d.getMonth() === filter.month : true;
        return matchYear && matchMonth;
    });

    filteredTx.forEach(t => {
        const v = Number(t.amount);
        if (t.type === 'income') periodIncome += v;
        if (t.type === 'expense') {
            periodExpense += v;
            categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + v;
        }
    });

    const sortedCats = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value, percent: (value / (periodExpense || 1)) * 100 }));

    return { balances, net, assetAlloc, periodIncome, periodExpense, sortedCats };
  }, [data, parsedPlacements, filter]);

  // --- LOGIKA SCAN (UPDATED WITH ERROR HANDLING) ---
  const handleScan = async (file, type) => {
    if (!file) return; 
    const isStatement = type === 'statement';
    if(isStatement) setIsScanningStatement(true); else setIsScanning(true);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const b64 = reader.result.split(',')[1];
        const mimeType = file.type || "image/jpeg"; 

        let prompt;
        if (isStatement) {
           prompt = `Analyze bank statement. Extract transactions to JSON array "transactions" with fields: date (YYYY-MM-DD), note, amount (number), type (income/expense), category (from list: ${data.categories.join(',')}). Return ONLY raw JSON.`;
        } else {
           prompt = `Analyze receipt. Return JSON object with fields: amount (number), date (YYYY-MM-DD), category, note, placement (guess from ${data.placements.join(',')}). Return ONLY raw JSON.`;
        }

        const txt = await callGemini(prompt, b64, mimeType);
        
        // Bersihkan JSON
        let cleanJson = txt.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonStart = cleanJson.indexOf('{'); 
        const jsonEnd = cleanJson.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
            cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
        }

        const json = JSON.parse(cleanJson);

        if (isStatement && json.transactions) {
            setScannedTransactions(json.transactions.map((t, i) => ({...t, tempId: i, selected: true})));
            showNotification(`Ditemukan ${json.transactions.length} transaksi.`);
        } else {
          setFormData(p => ({
            ...p, 
            ...json, 
            type: 'expense',
            placement: json.placement && data.placements.includes(json.placement) ? json.placement : parsedPlacements[0]?.original
          }));
          showNotification("Scan Berhasil!");
        }
      } catch(e) { 
          console.error("Scan Error Full:", e);
          alert(`Gagal Scan: ${e.message}`); // Tampilkan pesan error ke user
      }
      if(isStatement) setIsScanningStatement(false); else setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const commitScannedTransactions = async () => {
    const toAdd = scannedTransactions.filter(t => t.selected).map(t => ({
      id: Date.now().toString() + Math.random().toString().substr(2, 5),
      type: t.type || 'expense',
      amount: Number(t.amount),
      category: t.category || 'Other',
      date: t.date,
      note: t.note,
      user: data.users[0], 
      placement: parsedPlacements[0]?.original 
    }));

    showNotification(`Menyimpan ${toAdd.length} data...`);
    setData(prev => ({ ...prev, transactions: [...toAdd, ...prev.transactions] }));
    for (const tx of toAdd) { await DataService.addTransaction(tx); }
    setScannedTransactions([]);
    showNotification("Selesai import!");
  };

  const updateScannedTransaction = (index, field, value) => {
    const updated = [...scannedTransactions];
    updated[index][field] = value;
    setScannedTransactions(updated);
  };

  const handleAnalyzeFinances = async () => {
    setIsAnalyzing(true);
    setAiAdvice(null);
    try {
      const recentTx = data.transactions.slice(0, 20); 
      const assetContext = JSON.stringify(stats.assetAlloc);
      const prompt = `Act as a financial advisor. My Asset Portfolio (IDR): ${assetContext}. Recent transactions (IDR): ${JSON.stringify(recentTx)}. Net Worth: ${stats.net}. Provide: 1. Analysis of my Asset Allocation. 2. 3 actionable financial tips in Indonesian.`;
      const response = await callGemini(prompt);
      setAiAdvice(response);
    } catch (err) {
      showNotification("Gagal menganalisa.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getCleanName = (raw) => raw ? raw.split(':')[0] : 'Unknown';

  if (loading) return <div className="h-screen flex items-center justify-center flex-col gap-2"><Loader className="animate-spin text-indigo-600"/><span className="text-sm text-gray-500">Memuat Data...</span></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24">
      <div className="bg-indigo-600 text-white p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div className="font-bold text-xl flex gap-2"><Wallet/> FamilyAsset</div>
        <div className="hidden md:flex gap-2">
          {['dashboard', 'add', 'history', 'settings'].map(id => (
            <button key={id} onClick={() => setView(id)} className={`px-4 py-1 rounded capitalize ${view === id ? 'bg-white text-indigo-600' : ''}`}>{id}</button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {notification && <div className="bg-slate-800 text-white p-3 rounded-lg shadow-xl fixed top-20 right-4 z-50 animate-bounce">{notification}</div>}

        {view === 'dashboard' && (
          <div className="space-y-4">
            {/* Filter Controls */}
            <div className="flex gap-2 bg-white p-2 rounded-lg shadow-sm overflow-x-auto">
                <select 
                    value={filter.type} 
                    onChange={e => setFilter({...filter, type: e.target.value})}
                    className="p-2 text-sm border rounded bg-slate-50 font-bold"
                >
                    <option value="month">Bulanan</option>
                    <option value="year">Tahunan</option>
                </select>
                
                {filter.type === 'month' && (
                    <select 
                        value={filter.month} 
                        onChange={e => setFilter({...filter, month: parseInt(e.target.value)})}
                        className="p-2 text-sm border rounded bg-slate-50"
                    >
                        {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].map((m,i) => (
                            <option key={i} value={i}>{m}</option>
                        ))}
                    </select>
                )}

                <select 
                    value={filter.year} 
                    onChange={e => setFilter({...filter, year: parseInt(e.target.value)})}
                    className="p-2 text-sm border rounded bg-slate-50"
                >
                    {[2023, 2024, 2025, 2026].map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            <Card className="p-6 bg-gradient-to-br from-indigo-600 to-blue-500 text-white">
              <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs uppercase opacity-80">Total Aset (Net Worth)</p>
                    <h2 className="text-3xl md:text-4xl font-bold">{formatCurrency(stats.net)}</h2>
                  </div>
                  <div className="text-right">
                      <p className="text-xs uppercase opacity-80">Cashflow ({filter.type === 'month' ? 'Bulanan' : 'Tahunan'})</p>
                      <p className="text-sm font-semibold text-emerald-200">In: {formatCurrency(stats.periodIncome)}</p>
                      <p className="text-sm font-semibold text-rose-200">Out: {formatCurrency(stats.periodExpense)}</p>
                  </div>
              </div>
            </Card>
            
            {/* 2. Rincian Akun per Kategori dengan Tombol Hide */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800">Rincian Portfolio</h3>
                    <button 
                        onClick={() => setShowAssets(!showAssets)} 
                        className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-all"
                    >
                        {showAssets ? <><EyeOff size={14}/> Sembunyikan</> : <><Eye size={14}/> Tampilkan</>}
                    </button>
                </div>
                
                {showAssets && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {parsedPlacements.map(p => (
                        <div key={p.original} className="bg-white p-3 rounded-xl border flex justify-between items-center shadow-sm">
                        <div className="flex gap-3 items-center">
                            <div className={`p-2 rounded-lg ${ASSET_TYPES[p.type]?.bg || 'bg-gray-100'}`}>{ASSET_TYPES[p.type] ? React.createElement(ASSET_TYPES[p.type].icon, {size:18, className: ASSET_TYPES[p.type].color}) : <Wallet/>}</div>
                            <div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-gray-400">{ASSET_TYPES[p.type]?.label}</p></div>
                        </div>
                        <span className="font-bold text-slate-700">{formatCurrency(stats.balances[p.original] || 0)}</span>
                        </div>
                    ))}
                    </div>
                )}
            </div>

            {/* Expense Breakdown */}
            <Card className="p-4">
                <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase">Pengeluaran {filter.type === 'month' ? 'Bulan Ini' : 'Tahun Ini'}</h3>
                <div className="space-y-2">
                    {stats.sortedCats.length > 0 ? stats.sortedCats.map((cat, idx) => (
                        <div key={idx}>
                            <div className="flex justify-between text-xs mb-1">
                                <span>{cat.name}</span>
                                <span>{formatCurrency(cat.value)} ({Math.round(cat.percent)}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-rose-500 h-1.5 rounded-full" style={{width: `${cat.percent}%`}}></div></div>
                        </div>
                    )) : <p className="text-xs text-slate-400 italic">Belum ada pengeluaran di periode ini.</p>}
                </div>
            </Card>

            <Card className="p-6 bg-gradient-to-r from-white to-indigo-50/30 border border-indigo-100">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2"><Sparkles size={18}/> AI Advisor</h3>
                  <button onClick={handleAnalyzeFinances} disabled={isAnalyzing} className="w-full sm:w-auto text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{isAnalyzing ? 'Menganalisa...' : 'Analisa Portfolio'}</button>
               </div>
               {aiAdvice ? <div className="prose prose-sm text-slate-700 whitespace-pre-wrap">{aiAdvice}</div> : <p className="text-sm text-slate-500 italic">Dapatkan analisa aset cerdas dengan sekali klik.</p>}
            </Card>
          </div>
        )}

        {view === 'add' && (
          <Card className="p-6">
            <div className="flex justify-between mb-4 items-center">
              <h2 className="font-bold text-lg">{editingId ? "Edit Transaksi" : "Input Transaksi"}</h2>
              {editingId ? (
                  <button onClick={handleCancelEdit} className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-bold">Batal Edit</button>
              ) : (
                  <div className="flex gap-2">
                    <button onClick={()=>fileInputRef.current.click()} disabled={isScanning} className="bg-slate-100 p-2 rounded flex gap-2 text-xs font-bold items-center">{isScanning ? <Loader size={14} className="animate-spin"/> : <Camera size={14}/>} Resi</button>
                    <input type="file" ref={fileInputRef} hidden onChange={e=>handleScan(e.target.files[0], 'receipt')}/>
                    
                    <button onClick={()=>statementInputRef.current.click()} disabled={isScanningStatement} className="bg-slate-100 p-2 rounded flex gap-2 text-xs font-bold items-center">{isScanningStatement ? <Loader size={14} className="animate-spin"/> : <FileText size={14}/>} PDF</button>
                    <input type="file" ref={statementInputRef} hidden accept="image/*,application/pdf" onChange={e=>handleScan(e.target.files[0], 'statement')}/>
                  </div>
              )}
            </div>

            {scannedTransactions.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                    <div className="bg-indigo-50 p-3 border-b border-indigo-100 flex justify-between items-center"><h3 className="font-bold text-indigo-900 text-sm">Hasil Scan ({scannedTransactions.length})</h3><button onClick={() => setScannedTransactions([])} className="text-xs text-red-500 font-bold">Batal</button></div>
                    <div className="max-h-80 overflow-y-auto bg-slate-50 p-2 space-y-2">
                        {scannedTransactions.map((t, idx) => (
                            <div key={idx} className={`bg-white p-3 rounded-lg border shadow-sm ${t.selected ? 'border-indigo-300' : 'border-slate-200 opacity-60'}`}>
                                <div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><input type="checkbox" checked={t.selected} onChange={e=>{const n=[...scannedTransactions];n[idx].selected=e.target.checked;setScannedTransactions(n)}} className="w-4 h-4 rounded text-indigo-600"/><span className="text-xs font-bold text-slate-500">{t.date}</span></div><span className="font-mono font-bold text-sm">{formatCurrency(t.amount)}</span></div>
                                <p className="text-sm text-slate-800 mb-2 line-clamp-1">{t.note}</p>
                                <div className="flex gap-2"><select value={t.type} onChange={e => updateScannedTransaction(idx, 'type', e.target.value)} className="text-xs border rounded p-1 bg-slate-50"><option value="expense">Exp</option><option value="income">Inc</option></select><select value={t.category || 'Other'} onChange={e => updateScannedTransaction(idx, 'category', e.target.value)} className="text-xs border rounded p-1 bg-slate-50 flex-1">{data.categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 bg-white border-t"><button onClick={commitScannedTransactions} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold shadow hover:bg-indigo-700">Simpan Semua</button></div>
                </div>
            ) : (
                <form onSubmit={handleSaveTransaction} className="space-y-4">
                <div className="grid grid-cols-4 gap-2">{['expense','income','transfer','adjustment_plus'].map(t => (<button key={t} type="button" onClick={()=>setFormData({...formData, type:t})} className={`p-2 rounded text-[10px] font-bold uppercase border ${formData.type===t?'bg-indigo-50 border-indigo-500 text-indigo-700':'bg-white text-gray-400'}`}>{t.replace('_plus','+')}</button>))}</div>
                <div><label className="text-xs font-bold text-gray-500">Nominal</label><input type="number" value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} className="w-full p-3 border rounded-lg text-lg font-bold" placeholder="0" required/></div>
                <div className="grid grid-cols-2 gap-4">
                    {formData.type === 'transfer' ? (
                    <><div><label className="text-xs font-bold text-gray-500">Dari</label><select className="w-full p-2 border rounded" value={formData.placement} onChange={e=>setFormData({...formData, placement:e.target.value})}>{parsedPlacements.map(p=><option key={p.original} value={p.original}>{p.name}</option>)}</select></div><div><label className="text-xs font-bold text-gray-500">Ke</label><select className="w-full p-2 border rounded" value={formData.toPlacement} onChange={e=>setFormData({...formData, toPlacement:e.target.value})}>{parsedPlacements.map(p=><option key={p.original} value={p.original}>{p.name}</option>)}</select></div></>
                    ) : (<div className="col-span-2"><label className="text-xs font-bold text-gray-500">Akun / Aset</label><select className="w-full p-2 border rounded" value={formData.placement} onChange={e=>setFormData({...formData, placement:e.target.value})}>{parsedPlacements.map(p=><option key={p.original} value={p.original}>{p.name}</option>)}</select></div>)}
                </div>
                {(formData.type === 'income' || formData.type === 'expense') && (<div><label className="text-xs font-bold text-gray-500">Kategori</label><select className="w-full p-2 border rounded" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>{data.categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>)}
                <div className="grid grid-cols-2 gap-2"><input type="date" className="w-full p-2 border rounded" value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})}/><input type="text" className="w-full p-2 border rounded" placeholder="Catatan" value={formData.note} onChange={e=>setFormData({...formData, note:e.target.value})}/></div>
                <button type="submit" className={`w-full py-3 text-white font-bold rounded-lg ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{editingId ? 'Update Data' : 'Simpan Data'}</button>
                </form>
            )}
          </Card>
        )}

        {view === 'history' && (
          <div className="space-y-3">
            {data.transactions.slice().reverse().map(t => (
              <div key={t.id} className="bg-white p-3 rounded-lg border flex justify-between items-center shadow-sm">
                <div><div className="flex gap-2 text-xs font-bold text-gray-500 mb-1"><span>{t.date}</span> • <span>{t.user}</span></div><div className="font-bold text-sm text-slate-800">{t.note || t.category}</div><div className="text-xs text-indigo-600 mt-1">{getCleanName(t.placement)} {t.toPlacement && `→ ${getCleanName(t.toPlacement)}`}</div></div>
                <div className="text-right"><div className={`font-mono font-bold ${t.type==='income'?'text-emerald-600':t.type==='expense'?'text-rose-600':'text-slate-600'}`}>{formatCurrency(t.amount)}</div>
                  <div className="flex gap-2 justify-end mt-1"><button onClick={()=>handleEditClick(t)} className="text-xs text-amber-500 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded hover:bg-amber-100"><Edit3 size={12}/> Edit</button><button onClick={()=>handleDelete(t.id)} className="text-xs text-red-500 flex items-center gap-1 bg-red-50 px-2 py-1 rounded hover:bg-red-100"><Trash2 size={12}/> Hapus</button></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'settings' && (
          <Card className="p-6 space-y-8">
            <h2 className="font-bold text-xl">Pengaturan</h2>
            <div><label className="text-sm font-bold text-gray-500 block mb-2">Daftar Aset</label><div className="space-y-2">{parsedPlacements.map(p => (<div key={p.original} className="flex justify-between p-2 bg-slate-50 rounded border items-center"><span className="text-sm font-bold">{p.name} <span className="text-[10px] text-gray-400 font-normal uppercase">{p.type}</span></span><button onClick={()=>handleDeleteSetting('PLACEMENT', p.original)}><X size={14} className="text-red-400"/></button></div>))}<button onClick={()=>{const name=prompt("Nama Aset (Misal: Emas):"); if(!name) return; const type=prompt("Tipe (BANK, INVESTMENT, CRYPTO, COMMODITY, PROPERTY):"); handleAddSetting('PLACEMENT', `${name}:${type?type.toUpperCase():'OTHER'}`);}} className="w-full p-2 border border-dashed rounded text-sm text-indigo-500 font-bold">+ Tambah Aset</button></div></div>
            <div><label className="text-sm font-bold text-gray-500 block mb-2">Kategori</label><div className="flex flex-wrap gap-2">{data.categories.map(c => (<span key={c} className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold flex items-center gap-1 border border-slate-200">{c} <button onClick={()=>handleDeleteSetting('CATEGORY', c)} className="text-red-400 ml-1">×</button></span>))}<button onClick={()=>{const v=prompt("Kategori Baru:"); if(v) handleAddSetting('CATEGORY', v);}} className="px-3 py-1 border border-dashed rounded-full text-xs font-bold text-indigo-500 hover:bg-indigo-50">+ Tambah</button></div></div>
            <div><label className="text-sm font-bold text-gray-500 block mb-2">User / Anggota</label><div className="flex flex-wrap gap-2">{data.users.map(u => (<span key={u} className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold flex items-center gap-1 border border-slate-200">{u} <button onClick={()=>handleDeleteSetting('USER', u)} className="text-red-400 ml-1">×</button></span>))}<button onClick={()=>{const v=prompt("User Baru:"); if(v) handleAddSetting('USER', v);}} className="px-3 py-1 border border-dashed rounded-full text-xs font-bold text-indigo-500 hover:bg-indigo-50">+ Tambah</button></div></div>
          </Card>
        )}
      </main>
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t flex justify-around p-3 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {['dashboard', 'add', 'history', 'settings'].map(id => (<button key={id} onClick={() => setView(id)} className={`flex flex-col items-center w-16 ${view === id ? 'text-indigo-600' : 'text-slate-400'}`}>{id==='dashboard'?<LayoutDashboard/>:id==='add'?<PlusCircle/>:id==='history'?<Table/>:<Settings/>}<span className="text-[10px] font-bold capitalize">{id}</span></button>))}
      </div>
    </div>
  );
}