import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Wallet, PieChart, PlusCircle, MinusCircle, TrendingUp, TrendingDown, 
  Activity, LayoutDashboard, Table, Settings, Save, Trash2, Globe, 
  Sparkles, Camera, Loader, Landmark, CreditCard, Coins, Briefcase, 
  ArrowRightLeft, FileText, BarChart3, Building2, Bitcoin, Users, Tags,
  ChevronRight, Calendar, User
} from 'lucide-react';

/**
 * --- KONFIGURASI API GOOGLE SHEET ---
 * GANTI URL DI BAWAH INI dengan URL Web App dari Deploy Google Apps Script Anda.
 */
const API_URL = "https://script.google.com/macros/s/AKfycbwbVuPWQQyJrkHW5tcJifV5vBYEaJtZ2VPRyBXysawCASYMW8upXtIPMdYOWdHRs07zZw/exec"; 


/**
 * GEMINI API HELPER (UNTUK SCAN & AI)
 */
const callGemini = async (prompt, base64Data = null, mimeType = "image/jpeg") => {
  // ⚠️ PENTING UNTUK APP LIVE (VERCEL/WEB) ⚠️
  // Agar fitur Scan/AI berjalan di website Anda, Anda WAJIB mengisi API Key di bawah ini.
  // 1. Buka: https://aistudio.google.com/app/apikey
  // 2. Login & Klik "Create API Key"
  // 3. Copy key tersebut dan tempel di dalam tanda kutip di bawah:
  
  const apiKey = "AIzaSyAA3yjQTvQ6zhs13ESwZkrSXFFCECSvL-8"; // <--- PASTE API KEY ANDA DI SINI (Contoh: "AIzaSy...")

  // Catatan: Jika apiKey kosong, scan akan gagal di mode Live.
  if (!apiKey && window.location.hostname !== 'localhost') {
      console.warn("API Key Gemini kosong! Fitur scan tidak akan berjalan.");
  }

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
    
    if (!response.ok) {
       // Menangani error umum seperti API Key salah/kosong
       if (response.status === 400 || response.status === 403) {
         throw new Error("API Key Invalid atau Kosong. Cek Settings.");
       }
       throw new Error(`Gemini API Error: ${response.statusText}`);
    }
    
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
    income: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    expense: 'bg-rose-100 text-rose-700 border-rose-200',
    transfer: 'bg-blue-100 text-blue-700 border-blue-200',
    adjustment_plus: 'bg-amber-100 text-amber-700 border-amber-200',
    adjustment_minus: 'bg-amber-100 text-amber-700 border-amber-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    placement: 'bg-indigo-50 text-indigo-700 border-indigo-100'
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold whitespace-nowrap border ${colors[type] || colors.neutral}`}>
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
      // FIX: Paksa konversi ke String untuk perbandingan ID agar aman (menghindari bug Number vs String)
      setData(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => String(t.id) !== String(id))
      }));
      
      showNotification("Menghapus dari Cloud...");
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
    
    data.placements.forEach(p => placementBalances[p] = 0);

    data.transactions.forEach(t => {
      const amt = Number(t.amount);
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
      const prompt = `Act as a financial advisor. My Asset Portfolio (IDR): ${assetContext}. Recent transactions (IDR): ${JSON.stringify(recentTx)}. Total Net Worth: ${stats.balance}. Provide: 1. Analysis of my Asset Allocation. 2. 3 actionable financial tips in Indonesian.`;
      const response = await callGemini(prompt);
      setAiAdvice(response);
    } catch (err) {
      showNotification("Gagal menganalisa. Cek API Key.");
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
        showNotification("Gagal memproses. Cek API Key Gemini.");
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
            {/* Desktop Nav - Disembunyikan di Mobile */}
            <div className="hidden md:flex space-x-1">
              {['dashboard', 'add', 'history', 'settings'].map(id => (
                <button key={id} onClick={() => setView(id)} className={`px-4 py-2 rounded-lg capitalize ${view === id ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>{id}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        {notification && (
          <div className="fixed top-20 right-4 left-4 md:left-auto bg-slate-800 text-white px-6 py-3 rounded-lg shadow-xl animate-bounce z-50 text-center md:text-left">
            {notification}
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-6">
            {/* Net Worth Card - Full Width on Mobile */}
            <Card className="p-6 bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-none shadow-xl">
                <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Total Kekayaan Bersih</p>
                <h2 className="text-3xl md:text-4xl font-bold">{formatCurrency(stats.balance)}</h2>
                <div className="mt-6 flex justify-between items-end border-t border-white/20 pt-4">
                    <div>
                        <span className="text-indigo-200 block text-xs mb-1">Likuid (Kas/Bank)</span>
                        <span className="font-semibold text-lg">{formatCurrency(stats.assetAllocation.BANK)}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-indigo-200 block text-xs mb-1">Investasi & Aset</span>
                        <span className="font-semibold text-lg">{formatCurrency(stats.assetAllocation.INVESTMENT + stats.assetAllocation.CRYPTO + stats.assetAllocation.COMMODITY + stats.assetAllocation.PROPERTY)}</span>
                    </div>
                </div>
            </Card>

            {/* Asset Breakdown - Grid responsive */}
            <div>
                <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                    <PieChart size={18} className="text-indigo-600"/> Portfolio
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {parsedPlacements.map(p => {
                        const balance = stats.placementBalances[p.original] || 0;
                        const typeConfig = ASSET_TYPES[p.type] || ASSET_TYPES.OTHER;
                        return (
                            <div key={p.original} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-full ${typeConfig.bg} ${typeConfig.color}`}>
                                        <typeConfig.icon size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">{p.name}</p>
                                        <p className="text-[10px] text-slate-400 font-medium uppercase">{typeConfig.label}</p>
                                    </div>
                                </div>
                                <span className={`font-bold ${balance < 0 ? 'text-red-500' : 'text-slate-800'}`}>
                                    {formatCurrency(balance)}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <Card className="p-6 bg-gradient-to-r from-white to-indigo-50/30 border border-indigo-100">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2"><Sparkles size={18}/> AI Advisor</h3>
                  <button onClick={handleAnalyzeFinances} disabled={isAnalyzing} className="w-full sm:w-auto text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {isAnalyzing ? 'Menganalisa...' : 'Analisa Portfolio'}
                  </button>
               </div>
               {aiAdvice ? (
                   <div className="prose prose-sm text-slate-700 whitespace-pre-wrap">{aiAdvice}</div>
               ) : (
                   <p className="text-sm text-slate-500 italic">Dapatkan analisa aset cerdas dengan sekali klik.</p>
               )}
            </Card>
          </div>
        )}

        {view === 'add' && (
          <div className="max-w-2xl mx-auto space-y-6">
              <Card className="p-6 md:p-8">
                <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Catat Transaksi</h2>
                    <p className="text-slate-400 text-xs">Input manual atau scan otomatis</p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={e => handleScan(e.target.files[0], 'receipt')} />
                    <button onClick={() => fileInputRef.current.click()} disabled={isScanning} className="flex-1 md:flex-none justify-center py-2 px-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-100">
                      {isScanning ? <Loader size={14} className="animate-spin"/> : <Camera size={14}/>} Resi
                    </button>
                    
                    <input type="file" ref={statementInputRef} hidden accept="image/*,application/pdf" onChange={e => handleScan(e.target.files[0], 'statement')} />
                    <button onClick={() => statementInputRef.current.click()} disabled={isScanningStatement} className="flex-1 md:flex-none justify-center py-2 px-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-100">
                      {isScanningStatement ? <Loader size={14} className="animate-spin"/> : <FileText size={14}/>} PDF
                    </button>
                  </div>
                </div>

                {scannedTransactions.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                        <div className="bg-indigo-50 p-3 border-b border-indigo-100 flex justify-between items-center">
                            <h3 className="font-bold text-indigo-900 text-sm">Hasil Scan ({scannedTransactions.length})</h3>
                            <button onClick={() => setScannedTransactions([])} className="text-xs text-red-500 font-bold">Batal</button>
                        </div>
                        <div className="max-h-80 overflow-y-auto bg-slate-50 p-2 space-y-2">
                            {scannedTransactions.map((t, idx) => (
                                <div key={idx} className={`bg-white p-3 rounded-lg border shadow-sm ${t.selected ? 'border-indigo-300' : 'border-slate-200 opacity-60'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={t.selected} onChange={e=>{const n=[...scannedTransactions];n[idx].selected=e.target.checked;setScannedTransactions(n)}} className="w-4 h-4 rounded text-indigo-600"/>
                                            <span className="text-xs font-bold text-slate-500">{t.date}</span>
                                        </div>
                                        <span className="font-mono font-bold text-sm">{formatCurrency(t.amount)}</span>
                                    </div>
                                    <p className="text-sm text-slate-800 mb-2 line-clamp-1">{t.note}</p>
                                    <div className="flex gap-2">
                                        <select value={t.type} onChange={e => updateScannedTransaction(idx, 'type', e.target.value)} className="text-xs border rounded p-1 bg-slate-50">
                                            <option value="expense">Exp</option><option value="income">Inc</option>
                                        </select>
                                        <select value={t.category || 'Other'} onChange={e => updateScannedTransaction(idx, 'category', e.target.value)} className="text-xs border rounded p-1 bg-slate-50 flex-1">
                                            {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 bg-white border-t">
                            <button onClick={commitScannedTransactions} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold shadow hover:bg-indigo-700">Simpan Semua</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleAddTransaction} className="space-y-5">
                    {/* Tipe Transaksi - Mobile Friendly Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            {id: 'expense', label: 'Keluar', icon: MinusCircle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200'},
                            {id: 'income', label: 'Masuk', icon: PlusCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200'},
                            {id: 'transfer', label: 'Pindah', icon: ArrowRightLeft, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200'},
                            {id: 'adjustment_plus', label: 'Revaluasi', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200'}
                        ].map(opt => (
                        <button key={opt.id} type="button" onClick={() => setFormData({...formData, type: opt.id})}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${formData.type === opt.id ? `${opt.bg} ${opt.color} border-2 shadow-sm` : 'border-slate-100 text-slate-400 bg-slate-50'}`}>
                            <opt.icon size={20} /> 
                            <span className="text-xs font-bold">{opt.label}</span>
                        </button>
                        ))}
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nominal (Rp)</label>
                        <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold text-slate-800" placeholder="0" />
                    </div>

                    {/* Logic Input Berdasarkan Tipe */}
                    {formData.type === 'transfer' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dari</label>
                                    <select value={formData.placement} onChange={e => setFormData({...formData, placement: e.target.value})} className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm">
                                    {parsedPlacements.map(p => <option key={p.original} value={p.original}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ke</label>
                                    <select value={formData.toPlacement} onChange={e => setFormData({...formData, toPlacement: e.target.value})} className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm">
                                    {parsedPlacements.map(p => <option key={p.original} value={p.original}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                                {formData.type.includes('adjustment') ? 'Aset' : 'Akun Sumber'}
                            </label>
                            <select value={formData.placement} onChange={e => setFormData({...formData, placement: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm">
                            {parsedPlacements.map(p => <option key={p.original} value={p.original}>{p.name} ({p.type})</option>)}
                            </select>
                        </div>
                    )}

                    {(formData.type === 'expense' || formData.type === 'income') && (
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Kategori</label>
                                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm">
                                {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-1">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tanggal</label>
                                <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-2 py-3 bg-white border border-slate-200 rounded-xl text-sm text-center" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Catatan</label>
                                <input type="text" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm" placeholder="Opsional..." />
                            </div>
                    </div>

                    <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex justify-center items-center gap-2 mt-4">
                        <Save size={20} /> Simpan
                    </button>
                    </form>
                )}
              </Card>
          </div>
        )}

        {view === 'history' && (
          <div className="max-w-2xl mx-auto space-y-4">
             {/* Desktop Table View (Hidden on Mobile) */}
             <div className="hidden md:block">
                <Card className="overflow-hidden">
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
                                    <span className="font-bold text-slate-700">{getCleanName(t.placement)}</span>
                                    {t.toPlacement && <ArrowRightLeft size={14} className="text-slate-400"/>}
                                    {t.toPlacement && <span className="font-bold text-slate-700">{getCleanName(t.toPlacement)}</span>}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{t.note || t.category}</div>
                            </td>
                            <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${(t.type === 'income' || t.type === 'adjustment_plus') ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-slate-700'}`}>
                                {formatCurrency(t.amount)}
                            </td>
                            <td className="p-3 text-center">
                                <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={18}/></button>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </Card>
             </div>

             {/* Mobile Card List View (Visible on Mobile) */}
             <div className="md:hidden space-y-3">
                {data.transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                <div className="bg-slate-100 p-2 rounded-lg text-slate-500 font-bold text-xs flex flex-col items-center">
                                    <span>{t.date.split('-')[2]}</span>
                                    <span className="text-[10px] uppercase">{new Date(t.date).toLocaleString('default', { month: 'short' })}</span>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{t.category}</p>
                                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                        <User size={10}/> {t.user}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`font-mono font-bold text-sm ${(t.type === 'income' || t.type === 'adjustment_plus') ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-blue-600'}`}>
                                    {(t.type === 'income' || t.type === 'adjustment_plus') ? '+' : t.type === 'expense' ? '-' : ''}
                                    {formatCurrency(t.amount)}
                                </p>
                                <Badge type={t.type}>{t.type === 'adjustment_plus' ? 'Reval' : t.type}</Badge>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                                <span className="font-semibold">{getCleanName(t.placement)}</span>
                                {t.toPlacement && <ArrowRightLeft size={10} className="text-slate-400"/>}
                                {t.toPlacement && <span className="font-semibold">{getCleanName(t.toPlacement)}</span>}
                            </div>
                            {t.note && <span className="italic text-slate-400 truncate max-w-[120px]">{t.note}</span>}
                        </div>

                        <div className="flex justify-end pt-1">
                            <button onClick={() => handleDelete(t.id)} className="text-xs text-rose-500 flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-50">
                                <Trash2 size={12}/> Hapus
                            </button>
                        </div>
                    </div>
                ))}
             </div>
          </div>
        )}

        {view === 'settings' && (
           <Card className="p-6 md:p-8">
             <h2 className="text-xl font-bold mb-6">Manajemen Pengaturan</h2>
             
             <div className="space-y-8">
                {/* Manage Assets */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Landmark size={16}/> Daftar Akun & Aset</label>
                  <div className="grid grid-cols-1 gap-2">
                    {parsedPlacements.map(p => (
                      <div key={p.original} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded ${ASSET_TYPES[p.type]?.bg || 'bg-slate-100'}`}>
                                {ASSET_TYPES[p.type] ? React.createElement(ASSET_TYPES[p.type].icon, {size: 16, className: ASSET_TYPES[p.type].color}) : <Wallet size={16}/>}
                            </div>
                            <div>
                                <p className="font-bold text-sm text-slate-800">{p.name}</p>
                                <p className="text-[10px] uppercase text-slate-500 tracking-wider">{ASSET_TYPES[p.type]?.label}</p>
                            </div>
                        </div>
                        <button onClick={() => setData(prev => ({...prev, placements: prev.placements.filter(item => item !== p.original)}))} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const name = prompt("Nama Akun/Aset (cth: Emas Batangan):");
                        if (!name) return;
                        const type = prompt("Tipe Aset (Ketik salah satu): BANK, INVESTMENT, CRYPTO, COMMODITY, PROPERTY");
                        if (name) setData(prev => ({...prev, placements: [...prev.placements, `${name}:${type ? type.toUpperCase() : 'OTHER'}`]}));
                      }}
                      className="w-full py-3 border-2 border-dashed border-indigo-200 rounded-lg text-indigo-500 text-sm font-bold hover:bg-indigo-50"
                    >
                      + Tambah Aset
                    </button>
                  </div>
                </div>

                {/* Manage Categories */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Tags size={16}/> Kategori</label>
                  <div className="flex flex-wrap gap-2">
                    {data.categories.map(c => (
                      <span key={c} className="bg-slate-100 px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 border border-slate-200 flex items-center gap-1">
                        {c}
                        <button onClick={() => setData(prev => ({...prev, categories: prev.categories.filter(item => item !== c)}))} className="hover:text-rose-500 ml-1">×</button>
                      </span>
                    ))}
                    <button 
                      onClick={() => {
                        const newCat = prompt("Nama Kategori Baru:");
                        if (newCat) setData(prev => ({...prev, categories: [...prev.categories, newCat]}));
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-slate-300 text-indigo-500"
                    >
                      + Tambah
                    </button>
                  </div>
                </div>

                {/* Manage Users */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Users size={16}/> Keluarga</label>
                  <div className="flex flex-wrap gap-2">
                    {data.users.map(u => (
                      <span key={u} className="bg-slate-100 px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 border border-slate-200 flex items-center gap-1">
                        {u}
                        <button onClick={() => setData(prev => ({...prev, users: prev.users.filter(item => item !== u)}))} className="hover:text-rose-500 ml-1">×</button>
                      </span>
                    ))}
                    <button 
                      onClick={() => {
                        const newUser = prompt("Nama Anggota Baru:");
                        if (newUser) setData(prev => ({...prev, users: [...prev.users, newUser]}));
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-slate-300 text-indigo-500"
                    >
                      + Tambah
                    </button>
                  </div>
                </div>
             </div>
           </Card>
        )}
      </main>

      {/* Mobile Nav - Fixed Bottom */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around p-2 pb-safe z-50">
        {[
            {id: 'dashboard', label: 'Home', icon: LayoutDashboard}, 
            {id: 'add', label: 'Input', icon: PlusCircle}, 
            {id: 'history', label: 'Riwayat', icon: Table}, 
            {id: 'settings', label: 'Akun', icon: Settings}
        ].map(item => (
           <button key={item.id} onClick={() => setView(item.id)} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-all ${view === item.id ? 'text-indigo-600' : 'text-slate-400'}`}>
             <item.icon size={22} className={view === item.id ? "fill-indigo-100" : ""} />
             <span className="text-[9px] font-bold">{item.label}</span>
           </button>
        ))}
      </div>
    </div>
  );
}