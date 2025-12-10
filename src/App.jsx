import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Wallet, PieChart, PlusCircle, MinusCircle, TrendingUp, TrendingDown, 
  Activity, LayoutDashboard, Table, Settings, Save, Trash2, Globe, 
  Sparkles, Camera, Loader, Landmark, CreditCard, Coins, Briefcase, 
  ArrowRightLeft, FileText
} from 'lucide-react';

/**
 * --- KONFIGURASI API ---
 * GANTI URL DI BAWAH INI dengan URL Web App dari Deploy Google Apps Script Anda.
 * Contoh: "https://script.google.com/macros/s/AKfycbx.../exec"
 */
const API_URL = "https://script.google.com/macros/s/AKfycbyu_PvRSwFiwx7uCup3xtPeQ0tEftQ6D9tAgItPNge1gOohlShNw933Slsk8pbN0EFQlQ/exec"; 


/**
 * GEMINI API HELPER
 * Digunakan untuk scan struk dan mutasi bank
 */
const callGemini = async (prompt, base64Data = null, mimeType = "image/jpeg") => {
  // Masukkan API Key Gemini Anda di sini. 
  const apiKey = ""; 
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
 * Jembatan antara React (Frontend) dan Google Sheets (Backend)
 */
const DataService = {
  // Mengambil data dari Google Sheet (doGet)
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

  // Mengirim data baru ke Google Sheet (doPost action: add)
  addTransaction: async (transaction) => {
    try {
      // mode: 'no-cors' wajib untuk Apps Script agar tidak error di browser
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

  // Menghapus data di Google Sheet (doPost action: delete)
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
    neutral: 'bg-slate-100 text-slate-700',
    placement: 'bg-indigo-50 text-indigo-700 border border-indigo-100'
  };
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${colors[type] || colors.neutral}`}>
      {children}
    </span>
  );
};

// --- APLIKASI UTAMA ---

export default function App() {
  // State Awal Kosong (Loading)
  const [data, setData] = useState({
    transactions: [],
    users: ['Ayah', 'Ibu', 'Anak'], 
    categories: ['Groceries', 'Utilities', 'Rent/Mortgage', 'Entertainment', 'Salary', 'Investment', 'Real Estate', 'Vehicles', 'Gold/Metals', 'Stocks/Bonds', 'Transfer', 'Other'],
    placements: ['Dompet (Tunai)', 'BCA/Mandiri (Bank)', 'Investasi (Bibit/Saham)'],
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

  // --- EFFECT: LOAD DATA DARI GOOGLE SHEET ---
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
        // Prioritaskan config dari Sheet jika ada
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
    category: 'Groceries',
    date: new Date().toISOString().split('T')[0],
    note: '',
    user: 'Ibu',
    placement: 'Dompet (Tunai)',
    toPlacement: 'BCA/Mandiri (Bank)'
  });

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.date) return;

    if (formData.type === 'transfer' && formData.placement === formData.toPlacement) {
      showNotification("Akun asal dan tujuan tidak boleh sama!");
      return;
    }

    const newTransaction = {
      id: Date.now().toString(), // ID String untuk keamanan
      ...formData,
      amount: Number(formData.amount)
    };

    // Optimistic UI Update (Update layar dulu biar terasa cepat)
    const prevData = { ...data };
    setData(prev => ({
      ...prev,
      transactions: [newTransaction, ...prev.transactions]
    }));
    showNotification("Menyimpan ke Cloud...");

    // Kirim ke Google Sheet
    await DataService.addTransaction(newTransaction);
    showNotification("Transaksi berhasil disimpan!");
    
    // Reset Form
    setFormData(prev => ({ ...prev, amount: '', note: '' }));
    setView('dashboard');
  };

  const handleDelete = async (id) => {
    if (confirm("Yakin ingin menghapus data ini?")) {
      // Optimistic Delete
      setData(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== id)
      }));
      
      showNotification("Menghapus dari Cloud...");
      await DataService.deleteTransaction(id);
      showNotification("Data terhapus.");
    }
  };

  // --- Currency Formatter (IDR ONLY) ---
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', currency: 'IDR', maximumFractionDigits: 0
    }).format(amount);
  };

  // --- Statistik Hitungan ---
  const stats = useMemo(() => {
    const totalIncome = data.transactions
      .filter(t => t.type === 'income')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    const totalExpense = data.transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const balance = totalIncome - totalExpense;

    const placementBalances = {};
    data.placements.forEach(p => placementBalances[p] = 0);
    
    data.transactions.forEach(t => {
      const amt = Number(t.amount);
      if (t.type === 'income') {
        placementBalances[t.placement] = (placementBalances[t.placement] || 0) + amt;
      } else if (t.type === 'expense') {
        placementBalances[t.placement] = (placementBalances[t.placement] || 0) - amt;
      } else if (t.type === 'transfer') {
        placementBalances[t.placement] = (placementBalances[t.placement] || 0) - amt;
        if (t.toPlacement) {
           placementBalances[t.toPlacement] = (placementBalances[t.toPlacement] || 0) + amt;
        }
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

    return { totalIncome, totalExpense, balance, sortedCategories, placementBalances };
  }, [data.transactions, data.placements]);

  // --- AI Handlers ---
  const handleAnalyzeFinances = async () => {
    setIsAnalyzing(true);
    setAiAdvice(null);
    try {
      const recentTx = data.transactions.slice(0, 20); 
      const prompt = `Act as a financial advisor. Recent transactions (IDR): ${JSON.stringify(recentTx)}. Total balance: ${stats.balance}. Provide 1 summary sentence and 3 bullet point saving tips in Indonesian.`;
      const response = await callGemini(prompt);
      setAiAdvice(response);
    } catch (err) {
      showNotification("Gagal menganalisa. Coba lagi.");
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

        if (isStatement) {
          if (resData.transactions) {
            setScannedTransactions(resData.transactions.map((t, i) => ({...t, tempId: i, selected: true})));
            showNotification(`Ditemukan ${resData.transactions.length} transaksi.`);
          }
        } else {
          // Single Receipt
          setFormData(prev => ({
            ...prev,
            amount: resData.amount || '',
            date: resData.date || new Date().toISOString().split('T')[0],
            category: resData.category || data.categories[0],
            note: resData.note || '',
            placement: resData.placement && data.placements.includes(resData.placement) ? resData.placement : 'Dompet (Tunai)',
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
      placement: 'BCA/Mandiri (Bank)' 
    }));

    showNotification(`Menyimpan ${toAdd.length} data ke Cloud...`);
    
    // Update UI Lokal
    setData(prev => ({ ...prev, transactions: [...toAdd, ...prev.transactions] }));
    
    // Loop kirim ke API (Google Apps Script)
    for (const tx of toAdd) {
      await DataService.addTransaction(tx);
    }

    setScannedTransactions([]);
    showNotification("Selesai import!");
  };

  const updateScannedTransaction = (index, field, value) => {
    const updated = [...scannedTransactions];
    updated[index][field] = value;
    setScannedTransactions(updated);
  };

  // --- TAMPILAN (VIEWS) ---
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
      <Loader className="animate-spin text-indigo-600" size={40} />
      <p className="text-slate-500 font-medium">Menghubungkan ke Google Sheets...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <div className="bg-indigo-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="font-bold text-xl flex items-center gap-2">
              <Wallet className="text-indigo-200" />
              <span>Family<span className="text-indigo-200">Cash</span></span>
            </div>
            <div className="hidden md:flex space-x-1">
              {['dashboard', 'add', 'history', 'settings'].map(id => (
                <button
                  key={id} onClick={() => setView(id)}
                  className={`px-4 py-2 rounded-lg capitalize ${view === id ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-500'}`}
                >
                  {id}
                </button>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6 border-l-4 border-l-blue-500">
                <p className="text-slate-500 text-sm font-medium uppercase">Net Worth</p>
                <h2 className="text-3xl font-bold text-slate-800 mt-2">{formatCurrency(stats.balance)}</h2>
              </Card>
              <Card className="p-6 border-l-4 border-l-emerald-500">
                <p className="text-slate-500 text-sm font-medium uppercase">Pemasukan</p>
                <h2 className="text-3xl font-bold text-emerald-600 mt-2">{formatCurrency(stats.totalIncome)}</h2>
              </Card>
              <Card className="p-6 border-l-4 border-l-rose-500">
                <p className="text-slate-500 text-sm font-medium uppercase">Pengeluaran</p>
                <h2 className="text-3xl font-bold text-rose-600 mt-2">{formatCurrency(stats.totalExpense)}</h2>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {data.placements.map(p => (
                <Card key={p} className="p-5 border-b-4 border-b-indigo-400">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">{p}</p>
                  <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.placementBalances[p] || 0)}</p>
                </Card>
              ))}
            </div>

            <Card className="p-6 bg-gradient-to-r from-white to-indigo-50/30 border border-indigo-100">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2"><Sparkles size={18}/> AI Advisor</h3>
                  <button onClick={handleAnalyzeFinances} disabled={isAnalyzing} className="text-sm bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
                    {isAnalyzing ? 'Menganalisa...' : 'Analisa Keuangan'}
                  </button>
               </div>
               {aiAdvice && <div className="prose prose-sm text-slate-700 whitespace-pre-wrap">{aiAdvice}</div>}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <Card className="lg:col-span-2 p-6">
                  <h3 className="font-bold text-lg mb-6"><PieChart className="inline mr-2" size={20}/> Pengeluaran per Kategori</h3>
                  {stats.sortedCategories.map((cat, idx) => (
                    <div key={idx} className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{cat.name}</span>
                        <span>{formatCurrency(cat.value)} ({Math.round(cat.percent)}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{width: `${cat.percent}%`}}></div></div>
                    </div>
                  ))}
               </Card>
               <Card className="p-6">
                  <h3 className="font-bold text-lg mb-4">Terbaru</h3>
                  {data.transactions.slice(0, 5).map(t => (
                    <div key={t.id} className="flex justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{t.category}</p>
                        <p className="text-xs text-slate-500">{t.date} • {t.placement}</p>
                      </div>
                      <span className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
               </Card>
            </div>
          </div>
        )}

        {view === 'add' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {scannedTransactions.length > 0 ? (
               <Card className="p-6 border-2 border-indigo-500">
                 <h3 className="font-bold text-lg mb-4">Konfirmasi Data Scan</h3>
                 <p className="text-sm text-slate-500 mb-2">Anda bisa mengubah tipe transaksi dan kategori sebelum menyimpan.</p>
                 <div className="overflow-auto max-h-96">
                   <table className="w-full text-sm">
                     <thead className="bg-slate-100 text-left sticky top-0">
                       <tr>
                         <th className="p-2">#</th>
                         <th className="p-2">Tgl</th>
                         <th className="p-2">Ket</th>
                         <th className="p-2">Tipe</th>
                         <th className="p-2">Kategori</th>
                         <th className="p-2">Jml</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {scannedTransactions.map((t, idx) => (
                         <tr key={idx} className={t.selected ? '' : 'opacity-50'}>
                           <td className="p-2"><input type="checkbox" checked={t.selected} onChange={e => {
                             const n = [...scannedTransactions]; n[idx].selected = e.target.checked; setScannedTransactions(n);
                           }}/></td>
                           <td className="p-2 whitespace-nowrap">{t.date}</td>
                           <td className="p-2">{t.note}</td>
                           <td className="p-2">
                             <select value={t.type} onChange={e => updateScannedTransaction(idx, 'type', e.target.value)} className="border rounded px-1 py-1 text-xs">
                               <option value="expense">Exp</option><option value="income">Inc</option><option value="transfer">Trf</option>
                             </select>
                           </td>
                           <td className="p-2">
                             <select value={t.category || 'Other'} onChange={e => updateScannedTransaction(idx, 'category', e.target.value)} className="border rounded px-1 py-1 text-xs w-24">
                               {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                           </td>
                           <td className="p-2">{formatCurrency(t.amount)}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
                 <div className="flex gap-2 mt-4">
                   <button onClick={commitScannedTransactions} className="flex-1 bg-indigo-600 text-white py-2 rounded font-bold">Simpan</button>
                   <button onClick={() => setScannedTransactions([])} className="px-4 border rounded">Batal</button>
                 </div>
               </Card>
            ) : (
              <Card className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Tambah Transaksi</h2>
                  <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={e => handleScan(e.target.files[0], 'receipt')} />
                    <button onClick={() => fileInputRef.current.click()} disabled={isScanning} className="text-xs border px-3 py-2 rounded flex items-center gap-1 hover:bg-slate-50">
                      {isScanning ? <Loader size={14} className="animate-spin"/> : <Camera size={14}/>} Resi
                    </button>
                    <input type="file" ref={statementInputRef} hidden accept="image/*,application/pdf" onChange={e => handleScan(e.target.files[0], 'statement')} />
                    <button onClick={() => statementInputRef.current.click()} disabled={isScanningStatement} className="text-xs border px-3 py-2 rounded flex items-center gap-1 hover:bg-slate-50">
                      {isScanningStatement ? <Loader size={14} className="animate-spin"/> : <FileText size={14}/>} Mutasi
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-4">
                   <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded">
                     {['expense', 'income', 'transfer'].map(type => (
                       <button key={type} type="button" onClick={() => setFormData({...formData, type})}
                         className={`py-2 text-sm font-bold rounded capitalize ${formData.type === type ? 'bg-white shadow' : 'text-slate-500'}`}>
                         {type}
                       </button>
                     ))}
                   </div>
                   
                   <div>
                     <label className="text-sm font-medium">Jumlah</label>
                     <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} 
                       className="w-full border p-2 rounded" placeholder="0" />
                   </div>

                   {formData.type === 'transfer' ? (
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="text-sm font-medium">Dari</label>
                         <select value={formData.placement} onChange={e => setFormData({...formData, placement: e.target.value})} className="w-full border p-2 rounded">
                           {data.placements.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                       </div>
                       <div>
                         <label className="text-sm font-medium">Ke</label>
                         <select value={formData.toPlacement} onChange={e => setFormData({...formData, toPlacement: e.target.value})} className="w-full border p-2 rounded">
                           {data.placements.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                       </div>
                     </div>
                   ) : (
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="text-sm font-medium">Akun</label>
                         <select value={formData.placement} onChange={e => setFormData({...formData, placement: e.target.value})} className="w-full border p-2 rounded">
                           {data.placements.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                       </div>
                       <div>
                         <label className="text-sm font-medium">Kategori</label>
                         <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border p-2 rounded">
                           {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                       </div>
                     </div>
                   )}

                   <div>
                     <label className="text-sm font-medium">Tanggal</label>
                     <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border p-2 rounded" />
                   </div>

                   <div>
                     <label className="text-sm font-medium">Catatan</label>
                     <input type="text" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full border p-2 rounded" />
                   </div>

                   <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700">Simpan</button>
                </form>
              </Card>
            )}
          </div>
        )}

        {view === 'history' && (
          <Card className="overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-100">
                   <tr><th className="p-3">Tgl</th><th className="p-3">User</th><th className="p-3">Info</th><th className="p-3 text-right">Jumlah</th><th className="p-3 text-center">Aksi</th></tr>
                 </thead>
                 <tbody className="divide-y">
                   {data.transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => (
                     <tr key={t.id}>
                       <td className="p-3 whitespace-nowrap">{t.date}</td>
                       <td className="p-3">{t.user}</td>
                       <td className="p-3">
                         <div className="font-bold text-slate-700">{t.category}</div>
                         <div className="text-xs text-slate-500">{t.note}</div>
                         <div className="text-xs mt-1 bg-slate-100 inline-block px-1 rounded">{t.type === 'transfer' ? `${t.placement} -> ${t.toPlacement}` : t.placement}</div>
                       </td>
                       <td className={`p-3 text-right font-bold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-700'}`}>
                         {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                       </td>
                       <td className="p-3 text-center">
                         <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
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
             <h2 className="text-xl font-bold mb-4">Pengaturan</h2>
             
             {/* Status Koneksi */}
             <div className="p-4 bg-indigo-50 border border-indigo-200 rounded text-indigo-800 text-sm mb-8">
               <p className="font-bold">Status: Live Mode (Google Sheets)</p>
               <p className="mt-2 text-xs font-mono break-all">{API_URL}</p>
             </div>

             <div className="space-y-6">
                {/* Manage Categories */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Kelola Kategori</label>
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

                {/* Manage Placements */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pos Keuangan (Akun)</label>
                  <div className="flex flex-wrap gap-2">
                    {data.placements.map(p => (
                      <span key={p} className="bg-indigo-50 px-3 py-1 rounded-full text-sm text-indigo-700 border border-indigo-200 flex items-center gap-2">
                        {p}
                        <button onClick={() => setData(prev => ({...prev, placements: prev.placements.filter(item => item !== p)}))} className="hover:text-rose-500">×</button>
                      </span>
                    ))}
                    <button 
                      onClick={() => {
                        const newPlace = prompt("Nama Pos Keuangan Baru:");
                        if (newPlace) setData(prev => ({...prev, placements: [...prev.placements, newPlace]}));
                      }}
                      className="px-3 py-1 rounded-full text-sm border border-dashed border-slate-300 text-slate-500 hover:border-indigo-500 hover:text-indigo-500"
                    >
                      + Tambah
                    </button>
                  </div>
                </div>

                {/* Manage Users */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Anggota Keluarga</label>
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

      <div className="md:hidden fixed bottom-0 w-full bg-white border-t flex justify-around p-2 z-50">
        {['dashboard', 'add', 'history'].map(id => (
           <button key={id} onClick={() => setView(id)} className={`p-2 rounded ${view === id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
             {id === 'dashboard' ? <LayoutDashboard/> : id === 'add' ? <PlusCircle/> : <Table/>}
           </button>
        ))}
      </div>
    </div>
  );
}