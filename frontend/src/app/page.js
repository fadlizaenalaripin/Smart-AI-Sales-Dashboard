"use client";
import { useEffect, useState, useCallback } from "react";
import { DollarSign, ShoppingBag, TrendingUp, BarChart3, BrainCircuit, Check, Globe, PlusCircle, Upload, Settings2, Trash2, ZapOff, AlertTriangle, Info, X, Edit3, Database, AlertCircle } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// --- Konfigurasi ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [timeRange, setTimeRange] = useState(30);
  const [error, setError] = useState(null);

  // --- STATE UNTUK FITUR EDIT & SELECTION ---
  const [editingId, setEditingId] = useState(null);
  const [editRowData, setEditRowData] = useState({});
  const [isSelectionMode, setIsSelectionMode] = useState(false); // Mode mencentang aktif/tidak
  const [selectedRows, setSelectedRows] = useState([]); // Daftar index yang dicentang data sementara saat input diketik
  const [isSyncing, setIsSyncing] = useState(false);

  // --- STATE MODAL CUSTOM (NOTIFIKASI) ---
  const [modalConfig, setModalConfig] = useState({
    show: false,
    title: "",
    message: "",
    type: "warning",
    onConfirm: null
  });

  // --- STATE MAPPING MODAL ---
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedFilename, setSelectedFilename] = useState(null);
  const [mapping, setMapping] = useState({
    date: "Date",
    sales: "Total_Sales",
    product: "Product",
    profit: "Profit"
  });

  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({ Product: "", Total_Sales: "", Cost: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mappingSuccess, setMappingSuccess] = useState(false);

  // --- NEW STATES FOR UPGRADE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("All Products");
  const [availableFiles, setAvailableFiles] = useState([]);
  const [insights, setInsights] = useState("");
  const [growth, setGrowth] = useState(0);
  const [profitGrowth, setProfitGrowth] = useState(0);
  const [orderGrowth, setOrderGrowth] = useState(0);
  const [showFilesMenu, setShowFilesMenu] = useState(false);

  const showModal = (title, message, type, onConfirm = null) => {
    setModalConfig({ show: true, title, message, type, onConfirm });
  };

  const closeModal = () => {
    setModalConfig({ ...modalConfig, show: false });
  };

  const rates = { USD: 1, IDR: 16000, EUR: 0.92, SGD: 1.34 };

  const formatValue = (val) => {
    if (!val) val = 0;
    const converted = val * rates[currency];
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0,
    }).format(converted);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null); // Reset error state on new upload
    setIsUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formDataUpload,
      });
      const data = await res.json();

      if (data.status === "error") {
        showModal("ERROR", data.message || "Gagal memproses file.", "error");
        return;
      }

      setSelectedFilename(data.filename);
      setAvailableColumns(data.columns);

      // AI Mapping Guesser - Super Smart Priority
      const cols = data.columns;

      // 1. Tanggal/Date (Hindari ID)
      const dateGuess = cols.find(c => /^(date|tanggal|waktu)$/i.test(c)) ||
        cols.find(c => /date|tanggal|waktu/i.test(c)) ||
        cols.find(c => /invoice/i.test(c) && !/id/i.test(c)) ||
        cols[0];

      // 2. Sales/Revenue
      const salesGuess = cols.find(c => /^(sales|revenue|total|pendapatan)$/i.test(c)) ||
        cols.find(c => /sales|total|revenue|income/i.test(c)) ||
        cols.find(c => /price|unit/i.test(c)) ||
        (cols[1] || "");

      // 3. Product
      const productGuess = cols.find(c => /^(product|produk|item|nama_barang)$/i.test(c)) ||
        cols.find(c => /product|produk|item|description/i.test(c)) ||
        (cols[2] || "");

      // 4. Profit
      const profitGuess = cols.find(c => /^(profit|untung|margin|laba)$/i.test(c)) ||
        cols.find(c => /profit|untung|margin|cogs/i.test(c)) ||
        (cols[3] || "");

      setMapping({
        date: dateGuess,
        sales: salesGuess,
        product: productGuess,
        profit: profitGuess
      });

      setShowMappingModal(true);
    } catch (err) {
      showModal("ERROR", "Upload gagal!", "error");
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================
  // 1. FUNGSI AMBIL DATA (Satu saja cukup!)
  // ==========================================
  const fetchData = useCallback(async (force = false) => {
    // Jangan fetch kalau modal mapping lagi buka (mencegah salah tebak pas awal upload)
    if (showMappingModal && !force) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

    try {
      console.log("DEBUG: Starting fetchData...");
      const url = `${API_BASE_URL}/api/stats?days=${timeRange}&filename=${selectedFilename || ""}&date_col=${mapping.date}&sales_col=${mapping.sales}&product_col=${mapping.product}&profit_col=${mapping.profit}`;

      const res = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server Error (${res.status}): ${errorText.substring(0, 100)}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.message || data.error);
      }

      setStats(data);
      setInsights(data.analysis_result || "");
      setGrowth(data.growth || 0);
      setProfitGrowth(data.profit_growth || 0);
      setOrderGrowth(data.order_growth || 0);
      setError(null);

      // Handle truncation alert
      if (data.is_truncated) {
        console.warn("Data truncated to 1,000 rows for performance.");
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Fetch Error Detail:", err);

      // DIAGNOSTIC PING
      try {
        const ping = await fetch(`${API_BASE_URL}/api/ping`).then(r => r.json());
        if (ping.status === "online") {
          setError("Server is online but something went wrong with the data processing. Try refreshing (F5).");
          return;
        }
      } catch (pErr) {
        console.warn("Ping failed too, server is likely offline.");
      }

      if (err.name === 'AbortError') {
        setError("Request timed out. The server is taking too long to respond. Check if the terminal is stuck.");
      } else {
        setError(`Connect failed: ${err.message || "Unknown Error"}`);
      }
    }
  }, [timeRange, selectedFilename, mapping, API_BASE_URL]);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/files`);
      const data = await res.json();
      if (data.files) setAvailableFiles(data.files);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    }
  }, [API_BASE_URL]);

  // ==========================================
  // 2. FUNGSI MANAJEMEN DATA (HAPUS & PILIH)
  // ==========================================

  const toggleRowSelection = (index) => {
    setSelectedRows((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleClearAll = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch(`${API_BASE_URL}/api/clear-data`, { method: "DELETE" });
      if (res.ok) {
        showModal("SUCCESS", "All data has been deleted.", "success");
        fetchData();
      }
    } catch (err) {
      showModal("ERROR", "Failed to delete data.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBatchDelete = async () => {
    showModal(
      "CONFIRM DELETE",
      `Delete ${selectedRows.length} selected rows?`,
      "warning",
      async () => {
        try {
          setIsSyncing(true);
          const res = await fetch(`${API_BASE_URL}/api/delete-multiple`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              indexes: selectedRows,
              filename: selectedFilename // Pass active file
            }),
          });
          if (res.ok) {
            setSelectedRows([]);
            setIsSelectionMode(false);
            await fetchData();
            showModal("SUCCESS", "Selected data successfully deleted", "success");
          }
        } catch (err) {
          showModal("ERROR", "Failed to delete data", "error");
        } finally {
          setIsSyncing(false);
        }
      }
    );
  };

  const handleDeleteRow = (index) => {
    showModal(
      "DELETE DATA",
      "Permanently delete this row?",
      "warning",
      async () => {
        try {
          setIsSyncing(true);
          const url = `${API_BASE_URL}/api/delete-row/${index}${selectedFilename ? `?filename=${selectedFilename}` : ''}`;
          const res = await fetch(url, { method: "DELETE" });
          if (res.ok) {
            await fetchData();
            showModal("SUCCESS", "Data successfully deleted", "success");
          }
        } catch (err) {
          showModal("ERROR", "Failed to delete row", "error");
        } finally {
          setIsSyncing(false);
        }
      }
    );
  };

  const openDeleteManager = () => {
    setModalConfig({
      show: true,
      title: "SELECT DELETE METHOD",
      message: "Delete specific rows via table, or delete all data at once.",
      type: "warning",
      onConfirm: handleClearAll // Option Delete All
    });
  };

  // ==========================================
  // 3. FUNGSI ADD & MAPPING
  // ==========================================

  const applyMappingAndFetch = async () => {
    setIsSyncing(true);
    try {
      await fetchData(true); // Force fetch even if modal is technically still hiding
      setMappingSuccess(true);
      setTimeout(() => {
        setIsSyncing(false);
        setMappingSuccess(false);
        setShowMappingModal(false);
      }, 1500);
    } catch (err) {
      setIsSyncing(false);
      showModal("ERROR", "Failed to synchronize data", "error");
    }
  };

  const handleAddData = async (e) => {
    e.preventDefault();
    if (!formData.Product || !formData.Total_Sales || !formData.Cost) {
      return showModal("INCOMPLETE DATA", "Please fill in all input fields!", "error");
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/add-sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Product: formData.Product,
          Total_Sales: parseFloat(formData.Total_Sales),
          Cost: parseFloat(formData.Cost),
          filename: selectedFilename // Target specific file
        }),
      });

      if (res.ok) {
        setFormData({ Product: "", Total_Sales: "", Cost: "" });
        fetchData();
        showModal("SUCCESS", "New data successfully added!", "success");
      } else {
        const errorData = await res.json();
        showModal("FAILED", errorData.message || "An error occurred", "error");
      }
    } catch (err) {
      showModal("CONNECTION LOST", "Failed to connect to server.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- TARUH DI SINI ---
  const handleSaveEdit = async (index) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/update-row`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          index: index,
          new_data: editRowData,
          mapping: mapping,
          filename: selectedFilename // Update specific file
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchData();
        showModal("SUCCESS", "Data has been updated", "info");
      }
    } catch (err) {
      showModal("ERROR", "Failed to update data", "error");
    }
  };

  const filteredRows = (stats?.raw_data || [])
    .filter(row => {
      const matchesSearch = Object.values(row).some(val =>
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      );
      const matchesProduct = productFilter === "All Products" || row[mapping.product] === productFilter;
      return matchesSearch && matchesProduct;
    });

  const uniqueProducts = ["All Products", ...new Set((stats?.raw_data || []).map(r => r[mapping.product]))];

  const handleExportCSV = () => {
    if (!stats?.raw_data || stats.raw_data.length === 0) return;
    const headers = Object.keys(stats.raw_data[0]).join(",");
    const rows = stats.raw_data.map(r => Object.values(r).join(",")).join("\n");
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `report_${selectedFilename || "current"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  useEffect(() => {
    setMounted(true);
    fetchData();
    fetchFiles();
  }, [fetchData, fetchFiles]);

  // --- LOADING DIAGNOSTIC TIMER ---
  const [loadingTime, setLoadingTime] = useState(0);
  useEffect(() => {
    if (!mounted || stats || error) return;
    const interval = setInterval(() => setLoadingTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [mounted, stats, error]);

  if (!mounted || (!stats && !error)) {
    return (
      <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center text-blue-500 font-bold p-10 text-center">
        <div className="animate-pulse tracking-[0.3em] mb-4 text-white">LOADING SYSTEM...</div>
        <div className="w-48 h-1 bg-blue-900/30 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-blue-500 animate-progress"></div>
        </div>

        {loadingTime > 5 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-sm">
            <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest leading-relaxed mb-4">
              {loadingTime < 15
                ? "Connecting to local data repository..."
                : "Having trouble connecting? Ensure your Python terminal is running 'main.py' on port 8000."}
            </p>
            {loadingTime > 20 && (
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white hover:bg-white/10 transition-all font-bold uppercase"
              >
                Hard Reset
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#05070a] flex items-center justify-center p-6">
        <div className="text-center border border-red-500/20 bg-red-500/5 p-8 rounded-3xl max-w-md">
          <p className="text-red-400 font-mono mb-6 text-sm">{error}</p>
          <button onClick={fetchData} className="bg-white/10 hover:bg-white/20 px-8 py-3 rounded-xl text-[10px] font-bold transition-all text-white border border-white/10 uppercase">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 p-6 lg:p-10 font-sans tracking-tight">
      <div className="max-w-7xl mx-auto">

        {/* Header Section */}
        <div className="relative z-50 flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">PULSECORE</h1>
            <p className="text-slate-500 text-[10px] tracking-[0.2em] uppercase font-bold">Enterprise Data Intelligence</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 animate-slide-up">
            <div className="relative">
              <button onClick={() => setShowFilesMenu(!showFilesMenu)} className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 text-white hover:border-slate-600 transition-all hover:bg-slate-800 active:scale-95">
                <Database size={16} className="text-blue-500" /> {selectedFilename || "Main Data"}
              </button>
              {showFilesMenu && (
                <div className="absolute left-0 mt-2 w-64 bg-slate-900/90 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[150] p-2 max-h-80 overflow-y-auto backdrop-blur-xl animate-in zoom-in-95 duration-200">
                  <p className="text-[10px] font-black uppercase text-slate-500 p-3 border-b border-white/5 mb-2 flex items-center gap-2">
                    <Database size={10} /> Recent Analytics Files
                  </p>
                  <button onClick={() => { setSelectedFilename(null); setShowFilesMenu(false); fetchData(); }} className="w-full text-left px-4 py-2.5 hover:bg-blue-600 rounded-xl text-[11px] font-bold text-white transition-all flex justify-between items-center group">
                    Main Data Repository {!selectedFilename && <Check size={12} className="text-blue-400" />}
                  </button>
                  {availableFiles.map((file, idx) => (
                    <button key={`${file}-${idx}`} onClick={() => { setSelectedFilename(file); setShowFilesMenu(false); fetchData(); }} className="w-full text-left px-4 py-2.5 hover:bg-blue-600 rounded-xl text-[11px] font-bold text-white transition-all flex justify-between items-center group">
                      <span className="truncate">{file}</span>
                      {selectedFilename === file && <Check size={12} className="text-blue-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/20">
              <Upload size={16} /> {isUploading ? "Uploading..." : "Import CSV"}
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>

            <button onClick={handleExportCSV} className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 text-white hover:border-slate-600 transition-all hover:bg-slate-800 active:scale-95">
              Export CSV
            </button>

            <div className="flex gap-1 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
              {[7, 30, 90, 365].map(d => (
                <button key={d} onClick={() => setTimeRange(d)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${timeRange === d ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                  {d === 365 ? '1Y' : `${d}D`}
                </button>
              ))}
            </div>

            <div className="relative">
              <button onClick={() => setShowCurrencyMenu(!showCurrencyMenu)} className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 text-white hover:border-slate-600 transition-all hover:bg-slate-800 active:scale-95">
                <Globe size={16} className="text-blue-500" /> {currency}
              </button>
              {showCurrencyMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900/90 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[150] p-2 backdrop-blur-xl animate-in zoom-in-95 duration-200">
                  <p className="text-[10px] font-black uppercase text-slate-500 p-3 border-b border-white/5 mb-2">Select Currency</p>
                  {Object.keys(rates).map((cur, idx) => (
                    <button key={cur || idx} onClick={() => { setCurrency(cur); setShowCurrencyMenu(false); }} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-600 rounded-xl text-[11px] font-bold text-white transition-all group">
                      <span className="flex items-center gap-2">{cur} {rates[cur].symbol}</span>
                      {currency === cur && <Check size={12} className="text-blue-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- MODAL MAPPING --- */}
        {showMappingModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-lg">
            <div className="bg-[#0f172a] border border-blue-500/30 w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
              {mappingSuccess ? (
                <div className="flex flex-col items-center justify-center py-10 animate-slide-up">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 text-emerald-500">
                    <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" className="animate-checkmark" />
                    </svg>
                  </div>
                  <h3 className="text-white text-2xl font-black uppercase tracking-tight mb-2">Success!</h3>
                  <p className="text-slate-400 text-xs uppercase tracking-widest">Data has been re-synchronized</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-500">
                        <Settings2 size={24} />
                      </div>
                      <div>
                        <h3 className="text-white text-xl font-black uppercase tracking-tight">Configure Data Columns</h3>
                        <p className="text-slate-400 text-[10px] uppercase tracking-widest leading-relaxed">
                          Adjust file structure with system. <br />
                          <span className="text-blue-400/80 font-bold">* Any columns not mapped will be visible in the "Others" table section.</span>
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setShowMappingModal(false)} className="text-slate-500 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Date Column</label>
                      <select value={mapping.date} onChange={(e) => setMapping({ ...mapping, date: e.target.value })} className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-white text-xs outline-none focus:border-blue-500 transition-all">
                        {availableColumns.map((col, idx) => <option key={`${col}-${idx}`} value={col}>{col}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Sales Column (Revenue)</label>
                      <select value={mapping.sales} onChange={(e) => setMapping({ ...mapping, sales: e.target.value })} className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-white text-xs outline-none focus:border-blue-500 transition-all">
                        {availableColumns.map((col, idx) => <option key={`${col}-${idx}`} value={col}>{col}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Product Name Column</label>
                      <select value={mapping.product} onChange={(e) => setMapping({ ...mapping, product: e.target.value })} className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-white text-xs outline-none focus:border-blue-500 transition-all">
                        {availableColumns.map((col, idx) => <option key={`${col}-${idx}`} value={col}>{col}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Profit Column</label>
                      <select value={mapping.profit} onChange={(e) => setMapping({ ...mapping, profit: e.target.value })} className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-white text-xs outline-none focus:border-blue-500 transition-all">
                        {availableColumns.map((col, idx) => <option key={`${col}-${idx}`} value={col}>{col}</option>)}
                      </select>
                    </div>
                  </div>

                  <button onClick={applyMappingAndFetch} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl text-[10px] uppercase transition-all shadow-xl shadow-blue-600/20 active:scale-95">
                    Apply & Load Data
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* AI Projection & Insights */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-slate-900 to-black p-10 backdrop-blur-xl animate-float shadow-2xl">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase mb-6 animate-pulse">
                <BrainCircuit size={14} /> AI Projection Engine
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-3 tracking-tighter uppercase">Market Projection</h2>
              <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 mt-6">
                <p className="text-slate-500 text-[10px] font-black uppercase mb-1">Estimated Revenue (30D)</p>
                <div className="text-4xl font-black text-white tracking-tighter">{formatValue(stats?.prediction_next_month)}</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-white/10 p-10 rounded-[2.5rem] relative overflow-hidden group backdrop-blur-3xl shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity pointer-events-none">
              <BrainCircuit size={180} />
            </div>

            <div className="flex justify-between items-start mb-8">
              <h3 className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <BrainCircuit size={14} className="animate-pulse" /> Pulse AI Analyst
              </h3>
              {stats?.is_truncated && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase rounded-lg border border-amber-500/20">
                  <AlertCircle size={10} /> Fast Analysis (Top 500)
                </span>
              )}
            </div>

            <div className="space-y-4">
              {Array.isArray(stats?.analysis_result) ? (
                stats.analysis_result.map((insight, idx) => (
                  <div key={idx} className="flex gap-4 items-start group/line animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 150}ms`, animationFillMode: 'backwards' }}>
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 group-hover/line:scale-150 group-hover/line:shadow-[0_0_8px_#3b82f6] transition-all" />
                    <p className="text-slate-200 text-sm font-semibold leading-relaxed group-hover/line:text-white transition-colors">
                      {insight}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm font-medium animate-pulse">
                  AI is processing the latest data repository...
                </p>
              )}
            </div>

            <div className="mt-10 flex flex-wrap gap-2">
              <div className="px-4 py-2 bg-emerald-500/5 text-emerald-400 text-[9px] font-black uppercase rounded-xl border border-emerald-500/10 hover:bg-emerald-500/10 transition-all cursor-default">Growth Trends Identified</div>
              <div className="px-4 py-2 bg-blue-500/5 text-blue-400 text-[9px] font-black uppercase rounded-xl border border-blue-500/10 hover:bg-blue-500/10 transition-all cursor-default">Optimization Ready</div>
            </div>
          </div>
        </div>

        {/* FORM INPUT MANUAL */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl mb-10 flex flex-wrap gap-4 items-end shadow-2xl">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-blue-400 uppercase mb-2 block">{mapping.product}</label>
            <input value={formData.Product} onChange={(e) => setFormData({ ...formData, Product: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:border-blue-500 outline-none transition-all" placeholder={`Example: ${mapping.product}`} />
          </div>
          <div className="w-full md:w-32">
            <label className="text-[10px] font-bold text-blue-400 uppercase mb-2 block">{mapping.sales} ($)</label>
            <input type="number" value={formData.Total_Sales} onChange={(e) => setFormData({ ...formData, Total_Sales: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:border-blue-500" placeholder="0" />
          </div>
          <div className="w-full md:w-32">
            <label className="text-[10px] font-bold text-blue-400 uppercase mb-2 block">Profit/Cost ($)</label>
            <input type="number" value={formData.Cost} onChange={(e) => setFormData({ ...formData, Cost: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:border-blue-500" placeholder="0" />
          </div>
          <button onClick={handleAddData} disabled={isSubmitting} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl text-[10px] font-black uppercase text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-105 active:scale-95 shadow-xl shadow-blue-600/20">
            <PlusCircle size={16} /> {isSubmitting ? "Syncing..." : "Add Data"}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Revenue"
            value={formatValue(stats?.total_sales)}
            icon={<DollarSign size={20} />}
            trend={`${growth >= 0 ? '+' : ''}${growth}%`}
            color="blue"
            isNeg={growth < 0}
            badge={stats?.days_normalized ? "Normalized" : null}
          />
          <StatCard
            title="Net Profit"
            value={formatValue(stats?.total_profit)}
            icon={<TrendingUp size={20} />}
            trend={`${profitGrowth >= 0 ? '+' : ''}${profitGrowth}%`}
            color="emerald"
            isNeg={profitGrowth < 0}
            badge={stats?.profit_status === 'estimated' ? 'Estimated' : 'Mapped'}
            badgeColor={stats?.profit_status === 'estimated' ? 'blue' : 'emerald'}
          />
          <StatCard
            title="Total Orders"
            value={stats?.total_orders?.toLocaleString()}
            icon={<ShoppingBag size={20} />}
            trend={`${orderGrowth >= 0 ? '+' : ''}${orderGrowth}%`}
            color="purple"
            isNeg={orderGrowth < 0}
          />
        </div>

        {/* Charts & Products */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800 p-8 rounded-[2rem]">
            <h3 className="text-sm font-bold text-white mb-10 uppercase flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-500" /> Revenue Stream
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.chart_data}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="Date" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }}
                    formatter={(v) => formatValue(v)}
                  />
                  <Area type="monotone" dataKey="Total_Sales" stroke="#3b82f6" strokeWidth={3} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-800 p-8 rounded-[2rem]">
            <h3 className="text-sm font-bold text-white mb-10 uppercase">Top Products</h3>
            <div className="space-y-6">
              {stats?.top_products && Object.entries(stats.top_products).map(([name, value]) => (
                <div key={name} className="group/item">
                  <div className="flex justify-between mb-2 items-center">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <button
                        onClick={() => handleDeleteProduct(name)}
                        className="opacity-0 group-hover/item:opacity-100 text-red-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                      <span className="text-[10px] font-bold text-slate-500 uppercase truncate pr-4">{name}</span>
                    </div>
                    <span className="text-xs font-bold text-white">{formatValue(value)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-1000"
                      style={{ width: `${Math.min((value / Math.max(...Object.values(stats.top_products || { a: 1 }), 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- DATA MANAGEMENT TABLE --- */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-[2.5rem] overflow-hidden mb-20 animate-slide-up">
          {/* SEARCH & FILTER CONTROLS */}
          <div className="p-8 border-b border-white/5 bg-black/10 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-1 gap-4 min-w-[300px]">
              <div className="relative flex-1">
                <X size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer hover:text-white transition-opacity ${searchQuery ? 'opacity-100' : 'opacity-0'}`} onClick={() => setSearchQuery("")} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs text-white focus:border-blue-500 outline-none transition-all pl-5"
                />
              </div>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs text-white outline-none focus:border-blue-500 transition-all cursor-pointer"
              >
                {uniqueProducts.map((p, idx) => <option key={p || idx} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              Showing {filteredRows.length} Results
            </div>
          </div>

          {/* HEADER TABEL DENGAN ICON SAMPAH */}
          <div className="p-8 border-b border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Database className="text-blue-500" size={20} />
              <div>
                <h3 className="text-sm font-bold text-white uppercase">Raw Transaction Data</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Mapping: {mapping.product} | {mapping.sales}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Tombol Eksekusi Hapus Massal (Muncul jika ada yang diceklis) */}
              {isSelectionMode && selectedRows.length > 0 && (
                <button
                  onClick={handleBatchDelete}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-red-600/20 flex items-center gap-2"
                >
                  <Trash2 size={14} /> Delete {selectedRows.length} Rows
                </button>
              )}

              {/* Tombol Batal Mode Pilih */}
              {isSelectionMode && (
                <button
                  onClick={() => { setIsSelectionMode(false); setSelectedRows([]); }}
                  className="bg-slate-800 text-slate-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
              )}

              {/* ICON MAPPING/SETTINGS */}
              <button
                onClick={() => setShowMappingModal(true)}
                className="p-3 bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white rounded-2xl transition-all shadow-lg border border-blue-500/10 hover:scale-110 active:scale-95"
              >
                <Settings2 size={20} />
              </button>

              {/* ICON SAMPAH UTAMA */}
              <button
                onClick={openDeleteManager}
                className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all shadow-lg border border-red-500/10 hover:scale-110 active:scale-95"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>

          {stats?.is_truncated && (
            <div className="mx-8 mb-4 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-[10px] text-amber-500 font-bold uppercase tracking-wider">
              <AlertCircle size={14} /> Showing latest 1,000 records for performance. Full data used for analysis.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="hide-on-mobile">
                <tr className="bg-black/20 text-slate-500 text-[10px] uppercase font-black tracking-widest">
                  {/* KOLOM CHECKBOX (Header) */}
                  {isSelectionMode && (
                    <th className="px-8 py-5 w-10">
                      <input
                        type="checkbox"
                        className="accent-blue-500 w-4 h-4 cursor-pointer"
                        onChange={(e) => {
                          if (e.target.checked) setSelectedRows(stats?.raw_data?.map((_, i) => i));
                          else setSelectedRows([]);
                        }}
                      />
                    </th>
                  )}
                  <th className="px-8 py-5">{mapping.date}</th>
                  <th className="px-8 py-5">{mapping.product}</th>
                  <th className="px-8 py-5">{mapping.sales}</th>
                  <th className="px-8 py-5">Others</th>
                  <th className="px-8 py-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRows.map((row, index) => (
                  <tr
                    key={index}
                    className={`transition-colors group/row mobile-card-row ${selectedRows.includes(index) ? 'bg-red-500/5' : 'hover:bg-blue-500/5'}`}
                  >
                    {/* KOLOM CHECKBOX (Baris) */}
                    {isSelectionMode && (
                      <td className="px-8 py-4" data-label="Select">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(index)}
                          onChange={() => toggleRowSelection(index)}
                          className="accent-red-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                    )}

                    {editingId === index ? (
                      <>
                        {/* MODE EDIT */}
                        <td className="px-8 py-4"><input className="bg-black border border-blue-500 rounded px-2 py-1 text-xs text-white" value={editRowData.date} onChange={e => setEditRowData({ ...editRowData, date: e.target.value })} /></td>
                        <td className="px-8 py-4"><input className="bg-black border border-blue-500 rounded px-2 py-1 text-xs text-white" value={editRowData.product} onChange={e => setEditRowData({ ...editRowData, product: e.target.value })} /></td>
                        <td className="px-8 py-4"><input className="bg-black border border-blue-500 rounded px-2 py-1 text-xs text-white" type="number" value={editRowData.sales} onChange={e => setEditRowData({ ...editRowData, sales: e.target.value })} /></td>
                        <td className="px-8 py-4 flex justify-center gap-2">
                          <button onClick={() => handleSaveEdit(index)} className="text-emerald-500 hover:text-emerald-400 font-bold text-[10px] uppercase">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-white font-bold text-[10px] uppercase">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        {/* MODE VIEW */}
                        <td className="px-8 py-4 text-xs font-mono text-slate-400" data-label={mapping.date}>{row[mapping.date]}</td>
                        <td className="px-8 py-4 text-xs font-bold text-white uppercase" data-label={mapping.product}>{row[mapping.product]}</td>
                        <td className="px-8 py-4 text-xs font-mono text-blue-400" data-label={mapping.sales}>{formatValue(row[mapping.sales])}</td>
                        <td className="px-8 py-4 text-[9px] text-slate-500 max-w-[150px] truncate" data-label="Others">
                          {Object.keys(row)
                            .filter(key => ![mapping.date, mapping.product, mapping.sales, mapping.profit, 'Date_Parsed', 'Val_Sales', 'Val_Profit'].includes(key))
                            .map(key => `${key}: ${row[key]}`).join(", ") || "-"}
                        </td>
                        <td className="px-8 py-4" data-label="Action">
                          <div className="flex justify-center gap-4">
                            <button
                              onClick={() => {
                                setEditingId(index);
                                setEditRowData({ date: row[mapping.date], product: row[mapping.product], sales: row[mapping.sales] });
                              }}
                              className="text-slate-500 hover:text-blue-500 flex items-center gap-1 text-[10px] font-bold uppercase transition-all"
                            >
                              <Edit3 size={12} /> Edit
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- TEMPATKAN DI SINI --- */}
        {isSyncing && (
          <div className="fixed inset-0 z-[200] bg-[#05070a]/80 backdrop-blur-md flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500" size={24} />
            </div>
            <h2 className="mt-6 text-white font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
              Synchronizing Database...
            </h2>
          </div>
        )}
      </div>

      {/* --- CUSTOM NOTIFICATION MODAL --- */}
      {
        modalConfig.show && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-md bg-black/60">
            <div className="bg-[#0f172a] border border-white/10 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl">
              <div className="flex flex-col items-center text-center">
                <div className={`p-4 rounded-2xl mb-6 ${modalConfig.type === 'warning' ? 'bg-red-500/10 text-red-500' :
                  modalConfig.type === 'error' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                  }`}>
                  {modalConfig.type === 'warning' ? <Trash2 size={32} /> :
                    modalConfig.type === 'error' ? <ZapOff size={32} /> : <Info size={32} />}
                </div>

                <h3 className="text-white text-xl font-black uppercase mb-2">{modalConfig.title}</h3>
                <p className="text-slate-400 text-xs uppercase mb-8">{modalConfig.message}</p>

                <div className="flex flex-col w-full gap-3">
                  {modalConfig.onConfirm && (
                    <button
                      onClick={() => { modalConfig.onConfirm(); closeModal(); }}
                      className="w-full bg-red-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase transition-all hover:bg-red-500 flex items-center justify-center gap-2"
                    >
                      <ZapOff size={14} /> Delete All Data
                    </button>
                  )}

                  {modalConfig.type === 'warning' && (
                    <button
                      onClick={() => { setIsSelectionMode(true); closeModal(); }}
                      className="w-full bg-slate-800 text-white py-4 rounded-2xl text-[10px] font-black uppercase transition-all hover:bg-slate-700 flex items-center justify-center gap-2"
                    >
                      <Edit3 size={14} /> Select Rows To Delete
                    </button>
                  )}

                  {(modalConfig.type === 'info' || modalConfig.type === 'success') && (
                    <button
                      onClick={closeModal}
                      className="w-full bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase transition-all hover:bg-blue-500"
                    >
                      Continue
                    </button>
                  )}

                  <button
                    onClick={closeModal}
                    className="w-full border border-white/10 text-slate-500 py-3 rounded-2xl text-[9px] font-bold uppercase transition-all hover:text-white"
                  >
                    {modalConfig.type === 'warning' ? 'Cancel' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* --- MODAL SYNCING (LOADING OVERLAY) --- */}
      {
        isSyncing && (
          <div className="fixed inset-0 z-[200] bg-[#05070a]/80 backdrop-blur-md flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500" size={24} />
            </div>
            <h2 className="mt-6 text-white font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
              Synchronizing Database...
            </h2>
          </div>
        )
      }

      {/* --- GLOBAL STYLES --- */}
      <style jsx>{`
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes checkmark {
          0% { stroke-dashoffset: 21; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-progress { animation: progress 2s infinite ease-in-out; }
        .animate-slide-up { animation: slideUp 0.5s ease-out forwards; }
        .animate-checkmark { stroke-dasharray: 21; stroke-dashoffset: 21; animation: checkmark 0.5s ease-out 0.3s forwards; }
        .animate-float { animation: float 6s ease-in-out infinite; }

        @media (max-width: 768px) {
          .mobile-card-row {
            display: flex;
            flex-direction: column;
            padding: 1.5rem !important;
            border-bottom: 2px solid rgba(255,255,255,0.05);
            gap: 0.5rem;
          }
          .mobile-card-row td {
            display: flex;
            justify-content: space-between;
            border: none !important;
            padding: 0.25rem 0 !important;
            width: 100% !important;
          }
          .mobile-card-row td::before {
            content: attr(data-label);
            font-weight: 800;
            text-transform: uppercase;
            font-size: 10px;
            color: #64748b;
          }
          .hide-on-mobile { display: none !important; }
        }
      `}</style>
    </div >
  );
}

// --- SUB-KOMPONEN STATCARD (DI LUAR DASHBOARD) ---
function StatCard({ title, value, icon, trend, color, isNeg, badge, badgeColor }) {
  const themes = {
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    purple: "text-purple-500 bg-purple-500/10 border-purple-500/20"
  };
  const badgeColors = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20"
  };
  return (
    <div className="bg-slate-900/20 border border-slate-800 p-8 rounded-3xl hover:bg-slate-900/40 transition-all group hover:-translate-y-2 hover:border-slate-700 hover:shadow-2xl shadow-blue-500/10">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-2xl border transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 ${themes[color]}`}>{icon}</div>
        <div className="flex flex-col items-end gap-2">
          <div className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${isNeg ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white'}`}>{trend}</div>
          {badge && (
            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border tracking-tighter ${badgeColors[badgeColor || 'amber']}`}>
              {badge}
            </span>
          )}
        </div>
      </div>
      <p className="text-slate-500 text-[10px] font-black uppercase mb-1 transition-colors group-hover:text-slate-300">{title}</p>
      <h3 className="text-3xl font-extrabold text-white tracking-tighter transition-all group-hover:scale-105 origin-left">{value || "$0"}</h3>
    </div>
  );
}