import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Wallet, PieChart, PlusCircle, MinusCircle, TrendingUp, TrendingDown, 
  Activity, LayoutDashboard, Table, Settings, Save, Trash2, Globe, 
  Sparkles, Camera, Loader, Landmark, CreditCard, Coins, Briefcase, 
  ArrowRightLeft, FileText, BarChart3, Building2, Bitcoin, Users, Tags
} from 'lucide-react';

/**
 * --- KONFIGURASI API ---
 * GANTI URL DI BAWAH INI dengan URL Web App dari Deploy Google Apps Script Anda.
 */
const API_URL = "https://script.google.com/macros/s/AKfycbyu_PvRSwFiwx7uCup3xtPeQ0tEftQ6D9tAgItPNge1gOohlShNw933Slsk8pbN0EFQlQ/exec"; 


/**
 * GEMINI API HELPER
 */
const callGemini = async (prompt, base64Data = null, mimeType = "image/jpeg") => {
  const apiKey = ""; // Biarkan kosong jika menggunakan environment runtime
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

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
    if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

/**
 * DATA SERVICE LAYER
 */
const DataService = {
  fetchData: async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch data:", error);
      return null;
    }
  },

  addTransaction: async (transaction) => {
    try {
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', ...transaction })
      });
      return true;
    } catch (error) {
      console.error("Failed to add transaction:", error);
      return false;
    }
  },

  deleteTransaction: async (id) => {
    try {
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: id })
      });
      return true;
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      return false;
    }
  }
};

// --- KOMPONEN UI ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ type, children }) => {
  const colors = {
    income: 'bg-emerald-100 text-emerald-700',
    expense: 'bg-rose-100 text-rose-700',
    transfer: 'bg-blue-100 text-blue-700',
    adjustment_plus: 'bg-amber-100 text-amber-700',
    adjustment_minus: 'bg-amber-100 text-amber-700',
    neutral: 'bg-slate-100 text-slate-700',
    placement: 'bg-indigo-50 text-indigo-700 border border-indigo-100'
  };
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${colors[type] || colors.neutral}`}>
      {children}
    </span>
  );
};

// --- KONFIGURASI TIPE ASET ---
const ASSET_TYPES = {
  'BANK': { label: 'Kas & Bank', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
  'INVESTMENT': { label: 'Investasi', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'COMMODITY': { label: 'Emas/Logam', icon: Coins, color: 'text-amber-600', bg: 'bg-amber-50' },
  'CRYPTO': { label: 'Kripto', icon: Bitcoin, color: 'text-purple-600', bg: 'bg-purple-50' },
  'PROPERTY': { label: 'Properti', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  'OTHER': { label: 'Lainnya', icon: Briefcase, color: 'text-slate-600', bg: 'bg-slate-50' }
};

export default function App() {
  const [data, setData] = useState({
    transactions: [],
    users: ['Ayah', 'Ibu', 'Anak'], 
    categories: ['Belanja', 'Tagihan', 'Hiburan', 'Gaji', 'Investasi', 'Lainnya'],
    placements: ['Dompet:BANK', 'BCA:BANK'], 
    settings: { currency: 'IDR' }
  });
  
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [notification, setNotification] = useState(null);
  
  // AI States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningStatement, setIsScanningStatement] = useState(false);
  const [scannedTransactions, setScannedTransactions] = useState([]);
  
  const fileInputRef = useRef(null);
  const statementInputRef = useRef(null);

  // Helper: Pecah format "Nama:TIPE" menjadi object agar mudah dibaca UI
  const parsedPlacements = useMemo(() => {
    return data.placements.map(p => {
      if (p.includes(':')) {
        const [name, type] = p.split(':');
        return { name, type: type || 'OTHER', original: p };
      }
      return { name: p, type: 'OTHER', original: p };
    });
  }, [data.placements]);

  useEffect(() => {
    loadLiveData();
  }, []);

  const loadLiveData = async () => {
    setLoading(true);
    const cloudData = await DataService.fetchData();
    if (cloudData) {
      setData(prev => ({
        ...prev,
        transactions: cloudData.transactions || [],
        users: cloudData.users || prev.users,
        categories: cloudData.categories || prev.categories,
        placements: cloudData.placements || prev.placements
      }));
    }
    setLoading(false);
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: 'Belanja',
    date: new Date().toISOString().split('T')[0],
    note: '',
    user: 'Ibu',
    placement: '',
    toPlacement: ''
  });

  // Set default placement saat load
  useEffect(() => {
    if (parsedPlacements.length > 0 && !formData.placement) {
      setFormData(prev => ({ 
        ...prev, 
        placement: parsedPlacements[0].original,
        toPlacement: parsedPlacements[1]?.original || parsedPlacements[0].original
      }));
    }
  }, [parsedPlacements]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.date) return;

    if (formData.type === 'transfer' && formData.placement === formData.toPlacement) {
      showNotification("Akun asal dan tujuan tidak boleh sama!");
      return;
    }

    const newTransaction = {
      id: Date.now().toString(),
      ...formData,
      amount: Number(formData.amount)
    };

    const prevData = { ...data };
    setData(prev => ({
      ...prev,
      transactions: [newTransaction, ...prev.transactions]
    }));
    showNotification("Menyimpan ke Cloud...");

    await DataService.addTransaction(newTransaction);
    showNotification("Transaksi berhasil disimpan!");
    
    setFormData(prev => ({ ...prev, amount: '', note: '' }));
    setView('dashboard');
  };

  const handleDelete = async (id) => {
    if (confirm("Yakin ingin menghapus data ini?")) {
      setData(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== id)
      }));
      await DataService.deleteTransaction(id);
      showNotification("Data terhapus.");
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', currency: 'IDR', maximumFractionDigits: 0
    }).format(amount);
  };

  // --- STATISTIK & LOGIKA ASET ---
  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const placementBalances = {};
    
    // Inisialisasi saldo 0
    data.placements.forEach(p => placementBalances[p] = 0);

    data.transactions.forEach(t => {
      const amt = Number(t.amount);
      
      // Logika Perhitungan Saldo per Jenis Transaksi
      if (t.type === 'income') {
        placementBalances[t.placement] = (placementBalances[t.placement] || 0) + amt;
        totalIncome += amt;
      } else if (t.type === 'expense') {
        placementBalances[t.placement] = (placementBalances[t.placement] || 0) - amt;
        totalExpense += amt;
      } else if (t.type === 'transfer') {
        placementBalances[t.placement] = (placementBalances[t.placement] || 0) - amt;
        if (t.toPlacement) placementBalances[t.toPlacement] = (placementBalances[t.toPlacement] || 0) + amt;
      } else if (t.type === 'adjustment_plus') {
        placementBalances[t.placement] = (placementBalances[t.placement] || 0) + amt;
      } else if (t.type === 'adjustment_minus') {
        placementBalances[t.placement] = (placementBalances[t.placement] || 0) - amt;
      }
    });

    const balance = Object.values(placementBalances).reduce((a, b) => a + b, 0);

    // Grouping Aset per TIPE untuk Grafik
    const assetAllocation = {};
    Object.keys(ASSET_TYPES).forEach(k => assetAllocation[k] = 0);

    parsedPlacements.forEach(p => {
        const bal = placementBalances[p.original] || 0;
        if (bal > 0) { 
            assetAllocation[p.type] = (assetAllocation[p.type] || 0) + bal;
        }
    });

    const categoryBreakdown = {};
    data.transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + Number(t.amount);
      });

    const sortedCategories = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value, percent: (value / (totalExpense || 1)) * 100 }));

    return { totalIncome, totalExpense, balance, sortedCategories, placementBalances, assetAllocation };
  }, [data.transactions, data.placements, parsedPlacements]);

  // --- AI & SCAN ---
  const handleAnalyzeFinances = async () => {
    setIsAnalyzing(true);
    setAiAdvice(null);
    try {
      const recentTx = data.transactions.slice(0, 20); 
      const assetContext = JSON.stringify(stats.assetAllocation);
      const prompt = `Act as a financial advisor. 
      My Asset Portfolio (IDR): ${assetContext}.
      Recent transactions (IDR): ${JSON.stringify(recentTx)}. 
      Total Net Worth: ${stats.balance}. 
      Provide:
      1. Analysis of my Asset Allocation (Risk/Diversification) in Indonesian.
      2. 3 actionable financial tips in Indonesian.`;
      
      const response = await callGemini(prompt);
      setAiAdvice(response);
    } catch (err) {
      showNotification("Gagal menganalisa.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleScan = async (file, type) => {
    const isStatement = type === 'statement';
    if(isStatement) setIsScanningStatement(true); else setIsScanning(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result.replace("data:", "").replace(/^.+,/, "");
        const mime = file.type || "image/jpeg";
        let prompt;
        
        if (isStatement) {
           prompt = `Analyze bank statement. Extract transactions to JSON array "transactions" with fields: date (YYYY-MM-DD), note, amount (number), type (income/expense), category (from list: ${data.categories.join(',')}).`;
        } else {
           prompt = `Analyze receipt. Return JSON object with fields: amount (number), date (YYYY-MM-DD), category, note, placement (guess from ${data.placements.join(',')}).`;
        }

        const resText = await callGemini(prompt, base64, mime);
        const jsonStr = resText.replace(/```json/g, '').replace(/```/g, '').trim();
        const resData = JSON.parse(jsonStr);

        if (isStatement && resData.transactions) {
            setScannedTransactions(resData.transactions.map((t, i) => ({...t, tempId: i, selected: true})));
            showNotification(`Ditemukan ${resData.transactions.length} transaksi.`);
        } else {
          setFormData(prev => ({
            ...prev,
            amount: resData.amount || '',
            date: resData.date || new Date().toISOString().split('T')[0],
            category: resData.category || data.categories[0],
            note: resData.note || '',
            placement: resData.placement && data.placements.includes(resData.placement) ? resData.placement : parsedPlacements[0]?.original,
            type: 'expense'
          }));
          showNotification("Resi terbaca!");
        }
      } catch (err) {
        console.error(err);
        showNotification("Gagal memproses gambar/PDF.");
      } finally {
        if(isStatement) setIsScanningStatement(false); else setIsScanning(false);
      }
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
      placement: parsedPlacements[0]?.original // Default fallback
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

  const getCleanName = (raw) => raw ? raw.split(':')[0] : 'Unknown';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
      <Loader className="animate-spin text-indigo-600" size={40} />
      <p className="text-slate-500 font-medium">Memuat Aset & Data...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24">
      {/* Header */}
      <div className="bg-indigo-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="font-bold text-xl flex items-center gap-2">
              <Wallet className="text-indigo-200" />
              <span>Family<span className="text-indigo-200">Asset</span></span>
            </div>
            <div className="hidden md:flex space-x-1">
              {['dashboard', 'add', 'history', 'settings'].map(id => (
                <button key={id} onClick={() => setView(id)} className={`px-4 py-2 rounded-lg capitalize ${view === id ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>{id}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {notification && (
          <div className="fixed top-20 right-4 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-xl animate-bounce z-50">
            {notification}
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-6">
            
            {/* 1. Ringkasan Aset Utama */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Card className="p-6 bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-none">
                 <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">Total Kekayaan Bersih (Net Worth)</p>
                 <h2 className="text-4xl font-bold">{formatCurrency(stats.balance)}</h2>
                 <div className="mt-4 flex gap-4 text-sm">
                    <div>
                        <span className="text-indigo-200 block text-xs">Aset Likuid</span>
                        <span className="font-semibold">{formatCurrency(stats.assetAllocation.BANK)}</span>
                    </div>
                    <div>
                        <span className="text-indigo-200 block text-xs">Investasi & Aset</span>
                        <span className="font-semibold">{formatCurrency(stats.assetAllocation.INVESTMENT + stats.assetAllocation.CRYPTO + stats.assetAllocation.COMMODITY + stats.assetAllocation.PROPERTY)}</span>
                    </div>
                 </div>
               </Card>

               <Card className="p-6">
                 <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><PieChart size={18}/> Komposisi Aset</h3>
                 <div className="space-y-3">
                    {Object.entries(stats.assetAllocation).map(([key, value]) => {
                        if (value <= 0) return null;
                        const typeConfig = ASSET_TYPES[key];
                        const percent = (value / stats.balance) * 100;
                        return (
                            <div key={key}>
                                <div className="flex justify-between text-xs mb-1 font-medium">
                                    <span className="flex items-center gap-1 text-slate-600">
                                        <typeConfig.icon size={12}/> {typeConfig.label}
                                    </span>
                                    <span>{Math.round(percent)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div className={`h-2 rounded-full ${typeConfig.color.replace('text', 'bg')}`} style={{width: `${percent}%`}}></div>
                                </div>
                                <p className="text-xs text-right text-slate-400 mt-0.5">{formatCurrency(value)}</p>
                            </div>
                        )
                    })}
                 </div>
               </Card>
            </div>

            {/* 2. Rincian Akun per Kategori */}
            <div>
                <h3 className="font-bold text-lg text-slate-800 mb-4">Rincian Portfolio</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {parsedPlacements.map(p => {
                        const balance = stats.placementBalances[p.original] || 0;
                        const typeConfig = ASSET_TYPES[p.type] || ASSET_TYPES.OTHER;
                        return (
                            <Card key={p.original} className="p-4 border border-slate-200 hover:border-indigo-300 transition-all">
                                <div className="flex justify-between items-start">
                                    <div className={`p-2 rounded-lg ${typeConfig.bg} ${typeConfig.color}`}>
                                        <typeConfig.icon size={20} />
                                    </div>
                                    <Badge type="neutral">{typeConfig.label.split(' ')[0]}</Badge>
                                </div>
                                <div className="mt-3">
                                    <p className="text-sm font-medium text-slate-600">{p.name}</p>
                                    <p className={`text-xl font-bold ${balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatCurrency(balance)}</p>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* AI Advisor */}
            <Card className="p-6 bg-gradient-to-r from-white to-indigo-50/30 border border-indigo-100">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2"><Sparkles size={18}/> Konsultan Aset AI</h3>
                  <button onClick={handleAnalyzeFinances} disabled={isAnalyzing} className="text-sm bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
                    {isAnalyzing ? 'Menganalisa Portfolio...' : 'Analisa Portfolio'}
                  </button>
               </div>
               {aiAdvice && <div className="prose prose-sm text-slate-700 whitespace-pre-wrap">{aiAdvice}</div>}
            </Card>
          </div>
        )}

        {view === 'add' && (
          <div className="max-w-2xl mx-auto space-y-6">
              {scannedTransactions.length > 0 ? (
                 <Card className="p-6 border-2 border-indigo-500">
                   <h3 className="font-bold text-lg mb-4">Konfirmasi Data Scan</h3>
                   <div className="overflow-auto max-h-96">
                     <table className="w-full text-sm">
                       <thead className="bg-slate-100 sticky top-0">
                         <tr><th className="p-2">#</th><th className="p-2">Tgl</th><th className="p-2">Ket</th><th className="p-2">Tipe</th><th className="p-2">Kat</th><th className="p-2">Jml</th></tr>
                       </thead>
                       <tbody>
                         {scannedTransactions.map((t, idx) => (
                           <tr key={idx}><td className="p-2"><input type="checkbox" checked={t.selected} onChange={e=>{const n=[...scannedTransactions];n[idx].selected=e.target.checked;setScannedTransactions(n)}}/></td><td className="p-2">{t.date}</td><td className="p-2">{t.note}</td><td className="p-2">{t.type}</td><td className="p-2">{t.category}</td><td className="p-2">{formatCurrency(t.amount)}</td></tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                   <button onClick={commitScannedTransactions} className="mt-4 w-full bg-indigo-600 text-white py-2 rounded">Simpan</button>
                 </Card>
              ) : (
              <Card className="p-8">
                <div className="mb-6 flex justify-between items-center">
                  <h2 className="text-xl font-bold">Catat Transaksi</h2>
                  <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current.click()} className="p-2 bg-slate-100 rounded hover:bg-slate-200"><Camera size={18}/></button>
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={e => handleScan(e.target.files[0], 'receipt')} />
                    <button onClick={() => statementInputRef.current.click()} className="p-2 bg-slate-100 rounded hover:bg-slate-200"><FileText size={18}/></button>
                    <input type="file" ref={statementInputRef} hidden accept="image/*,application/pdf" onChange={e => handleScan(e.target.files[0], 'statement')} />
                  </div>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-6">
                   {/* Tipe Transaksi Extended */}
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 p-2 rounded-xl">
                     {[
                        {id: 'expense', label: 'Pengeluaran', icon: MinusCircle, color: 'text-rose-600'},
                        {id: 'income', label: 'Pemasukan', icon: PlusCircle, color: 'text-emerald-600'},
                        {id: 'transfer', label: 'Transfer/Beli', icon: ArrowRightLeft, color: 'text-blue-600'},
                        {id: 'adjustment_plus', label: 'Nilai Aset (+)', icon: TrendingUp, color: 'text-amber-600'}
                     ].map(opt => (
                       <button key={opt.id} type="button" onClick={() => setFormData({...formData, type: opt.id})}
                         className={`py-3 flex flex-col items-center justify-center gap-1 rounded-lg text-xs font-bold transition-all ${formData.type === opt.id ? 'bg-white shadow-md ' + opt.color : 'text-slate-400 hover:bg-white/50'}`}>
                         <opt.icon size={18} /> {opt.label}
                       </button>
                     ))}
                   </div>
                   
                   <div>
                     <label className="text-sm font-medium text-slate-700">Jumlah Rupiah</label>
                     <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-400 font-bold">Rp</span>
                        <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} 
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" />
                     </div>
                     {formData.type === 'adjustment_plus' && <p className="text-xs text-amber-600 mt-1">*Masukkan selisih kenaikan harga (misal: Emas naik 500rb)</p>}
                   </div>

                   {/* Logic Input Berdasarkan Tipe */}
                   {formData.type === 'transfer' ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="text-sm font-medium text-slate-700">Dari (Sumber Dana)</label>
                         <select value={formData.placement} onChange={e => setFormData({...formData, placement: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg">
                           {parsedPlacements.map(p => <option key={p.original} value={p.original}>{p.name} ({p.type})</option>)}
                         </select>
                       </div>
                       <div>
                         <label className="text-sm font-medium text-slate-700">Ke (Aset Tujuan)</label>
                         <select value={formData.toPlacement} onChange={e => setFormData({...formData, toPlacement: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg">
                           {parsedPlacements.map(p => <option key={p.original} value={p.original}>{p.name} ({p.type})</option>)}
                         </select>
                       </div>
                     </div>
                   ) : (
                     <div>
                         <label className="text-sm font-medium text-slate-700">
                            {formData.type.includes('adjustment') ? 'Aset yang Disesuaikan' : 'Akun / Pos Keuangan'}
                         </label>
                         <select value={formData.placement} onChange={e => setFormData({...formData, placement: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg">
                           {parsedPlacements.map(p => <option key={p.original} value={p.original}>{p.name} ({p.type})</option>)}
                         </select>
                     </div>
                   )}

                   {(formData.type === 'expense' || formData.type === 'income') && (
                        <div>
                            <label className="text-sm font-medium text-slate-700">Kategori</label>
                            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg">
                            {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Tanggal</label>
                            <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Catatan</label>
                            <input type="text" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg" placeholder="Ket. tambahan..." />
                        </div>
                   </div>

                   <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex justify-center items-center gap-2">
                     <Save size={20} /> Simpan Data
                   </button>
                </form>
              </Card>
              )}
          </div>
        )}

        {view === 'history' && (
          <Card className="overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-100 text-slate-600">
                   <tr><th className="p-3">Tgl</th><th className="p-3">User</th><th className="p-3">Detail</th><th className="p-3 text-right">Nilai</th><th className="p-3 text-center">Aksi</th></tr>
                 </thead>
                 <tbody className="divide-y">
                   {data.transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => (
                     <tr key={t.id} className="hover:bg-slate-50">
                       <td className="p-3 whitespace-nowrap text-slate-500">{t.date}</td>
                       <td className="p-3 font-medium">{t.user}</td>
                       <td className="p-3">
                         <div className="flex items-center gap-2">
                            {t.type === 'adjustment_plus' && <Badge type="adjustment_plus">Revaluasi (+)</Badge>}
                            <span className="font-bold text-slate-700">{getCleanName(t.placement)}</span>
                            {t.toPlacement && <ArrowRightLeft size={14} className="text-slate-400"/>}
                            {t.toPlacement && <span className="font-bold text-slate-700">{getCleanName(t.toPlacement)}</span>}
                         </div>
                         <div className="text-xs text-slate-500 mt-1">{t.note || t.category}</div>
                       </td>
                       <td className={`p-3 text-right font-mono font-bold whitespace-nowrap 
                         ${(t.type === 'income' || t.type === 'adjustment_plus') ? 'text-emerald-600' : 'text-slate-700'}
                         ${t.type === 'expense' ? 'text-rose-600' : ''}
                        `}>
                         {(t.type === 'income' || t.type === 'adjustment_plus') ? '+' : ''}
                         {(t.type === 'expense') ? '-' : ''}
                         {formatCurrency(t.amount)}
                       </td>
                       <td className="p-3 text-center">
                         <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={18}/></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </Card>
        )}

        {view === 'settings' && (
           <Card className="p-8">
             <h2 className="text-xl font-bold mb-6">Manajemen Pengaturan</h2>
             
             <div className="bg-blue-50 p-4 rounded-lg mb-8 text-blue-800 text-sm">
                <strong>Tips Aset:</strong> Gunakan format <code>Nama Akun:TIPE</code> saat menambah akun baru agar terdeteksi di grafik aset.
                <br/>Tipe tersedia: BANK, INVESTMENT, CRYPTO, COMMODITY, PROPERTY.
             </div>

             <div className="space-y-8">
                {/* Manage Assets / Placements */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2"><Landmark size={16}/> Daftar Akun & Aset</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {parsedPlacements.map(p => (
                      <div key={p.original} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded ${ASSET_TYPES[p.type]?.bg || 'bg-slate-100'}`}>
                                {ASSET_TYPES[p.type] ? React.createElement(ASSET_TYPES[p.type].icon, {size: 18, className: ASSET_TYPES[p.type].color}) : <Wallet size={18}/>}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{p.name}</p>
                                <p className="text-[10px] uppercase text-slate-500 tracking-wider">{ASSET_TYPES[p.type]?.label}</p>
                            </div>
                        </div>
                        <button onClick={() => setData(prev => ({...prev, placements: prev.placements.filter(item => item !== p.original)}))} className="text-slate-300 hover:text-rose-500"><Trash2 size={18}/></button>
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => {
                        const name = prompt("Nama Akun/Aset (cth: Emas Batangan):");
                        if (!name) return;
                        const type = prompt("Tipe Aset (Ketik salah satu): BANK, INVESTMENT, CRYPTO, COMMODITY, PROPERTY");
                        if (name) setData(prev => ({...prev, placements: [...prev.placements, `${name}:${type ? type.toUpperCase() : 'OTHER'}`]}));
                      }}
                      className="flex items-center justify-center p-3 border-2 border-dashed border-indigo-200 rounded-lg text-indigo-500 font-bold hover:bg-indigo-50 transition-all"
                    >
                      + Tambah Aset Baru
                    </button>
                  </div>
                </div>

                {/* Manage Categories */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2"><Tags size={16}/> Kategori Transaksi</label>
                  <div className="flex flex-wrap gap-2">
                    {data.categories.map(c => (
                      <span key={c} className="bg-slate-100 px-3 py-1 rounded-full text-sm text-slate-600 border border-slate-200 flex items-center gap-2">
                        {c}
                        <button onClick={() => setData(prev => ({...prev, categories: prev.categories.filter(item => item !== c)}))} className="hover:text-rose-500">×</button>
                      </span>
                    ))}
                    <button 
                      onClick={() => {
                        const newCat = prompt("Nama Kategori Baru:");
                        if (newCat) setData(prev => ({...prev, categories: [...prev.categories, newCat]}));
                      }}
                      className="px-3 py-1 rounded-full text-sm border border-dashed border-slate-300 text-slate-500 hover:border-indigo-500 hover:text-indigo-500"
                    >
                      + Tambah
                    </button>
                  </div>
                </div>

                {/* Manage Users */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2"><Users size={16}/> Anggota Keluarga</label>
                  <div className="flex flex-wrap gap-2">
                    {data.users.map(u => (
                      <span key={u} className="bg-slate-100 px-3 py-1 rounded-full text-sm text-slate-600 border border-slate-200 flex items-center gap-2">
                        {u}
                        <button onClick={() => setData(prev => ({...prev, users: prev.users.filter(item => item !== u)}))} className="hover:text-rose-500">×</button>
                      </span>
                    ))}
                    <button 
                      onClick={() => {
                        const newUser = prompt("Nama Anggota Baru:");
                        if (newUser) setData(prev => ({...prev, users: [...prev.users, newUser]}));
                      }}
                      className="px-3 py-1 rounded-full text-sm border border-dashed border-slate-300 text-slate-500 hover:border-indigo-500 hover:text-indigo-500"
                    >
                      + Tambah
                    </button>
                  </div>
                </div>
             </div>
           </Card>
        )}
      </main>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t flex justify-around p-3 pb-5 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {[
            {id: 'dashboard', icon: LayoutDashboard}, 
            {id: 'add', icon: PlusCircle}, 
            {id: 'history', icon: Table}, 
            {id: 'settings', icon: Settings}
        ].map(item => (
           <button key={item.id} onClick={() => setView(item.id)} className={`p-2 rounded-xl transition-all ${view === item.id ? 'text-indigo-600 bg-indigo-50 scale-110' : 'text-slate-400'}`}>
             <item.icon size={24} />
           </button>
        ))}
      </div>
    </div>
  );
}