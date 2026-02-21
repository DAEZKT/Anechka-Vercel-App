import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GlassCard } from '../components/GlassCard';
import { expenseService, supplierService, expenseAccountService } from '../services/supabaseService';
import { User, Expense, ExpenseAccount, ExpensePaymentType, ExpensePayment, ExpenseAccountModel, ExpenseSubAccountModel } from '../types';
import { ExpenseAccountManager } from '../components/ExpenseAccountManager';
import { getLocalDateString, toLocalDateString, getBusinessDateString, formatCurrency } from '../utils/dateUtils';


interface ExpensesPageProps {
  user: User;
}

// Configuración de Cuentas y Subcuentas - LEGACY MAPPING (For Display Only)
const LEGACY_ACCOUNT_NAMES: Record<string, string> = {
  SERVICIOS_BASICOS: 'Servicios Básicos',
  GASTOS_OPERATIVOS: 'Gastos Operativos',
  COMPRA_MERCADERIA: 'Compra Mercadería',
  IMPUESTOS: 'Impuestos y Tasas',
  MANTENIMIENTO: 'Mantenimiento'
};

const formatAccountName = (code: string) => {
  if (LEGACY_ACCOUNT_NAMES[code]) return LEGACY_ACCOUNT_NAMES[code];
  // Convert "THIS_FORMAT" to "This Format"
  return code.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

// Function to get fresh initial state with current date
// Uses dateUtils to ensure proper local timezone handling
const getInitialFormState = () => ({
  date: getLocalDateString(),
  supplier: '',
  account: '' as ExpenseAccount | '',
  sub_account: '',
  total: '',
  payment_type: 'CONTADO' as ExpensePaymentType,
  image_url: '',
  description: ''
});

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ user }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(getInitialFormState());

  // Auto-complete suppliers state
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showSupplierResults, setShowSupplierResults] = useState(false);

  // Tab State: ALL (Registro General) vs CREDIT (Cuentas por Pagar) vs SUPPLIER_BALANCE (Saldo por Proveedor) vs PAYMENT_HISTORY (Historial de Abonos)
  const [activeTab, setActiveTab] = useState<'ALL' | 'CREDIT' | 'SUPPLIER_BALANCE' | 'PAYMENT_HISTORY'>('ALL');

  // Payment History State
  const [allPayments, setAllPayments] = useState<ExpensePayment[]>([]);

  // CXP Management State
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [selectedExpenseForDebt, setSelectedExpenseForDebt] = useState<Expense | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<ExpensePayment[]>([]);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentNote, setNewPaymentNote] = useState('');

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputEditRef = useRef<HTMLInputElement>(null);

  // Custom Dropdown State
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isSubAccountDropdownOpen, setIsSubAccountDropdownOpen] = useState(false);
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);

  // Dynamic Accounts State
  const [accountOptions, setAccountOptions] = useState<ExpenseAccountModel[]>([]);
  const [subAccountOptions, setSubAccountOptions] = useState<ExpenseSubAccountModel[]>([]);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editFormData, setEditFormData] = useState({
    date: '',
    supplier: '',
    account: '' as ExpenseAccount | '',
    sub_account: '',
    total: '',
    payment_type: 'CONTADO' as ExpensePaymentType,
    image_url: '',
    description: ''
  });

  // Filters State
  const [filterDate, setFilterDate] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  // Mobile Action Menu State
  const [activeMenuExpenseId, setActiveMenuExpenseId] = useState<string | null>(null);

  // Receipt Viewer State
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
  const [receiptZoom, setReceiptZoom] = useState(1);

  const handleViewReceipt = (url: string) => {
    setViewReceiptUrl(url);
    setReceiptZoom(1); // Reset zoom
  };

  useEffect(() => {

    if (!expenseService || !supplierService) {
      console.error("Services undefined!", { expenseService, supplierService });
      alert("Error de sistema: Servicios no cargados correctamente. Por favor recargue la página.");
      return;
    }
    loadData();
    loadSuppliers();
    loadData();
    loadSuppliers();
    loadData();
    loadSuppliers();
    loadAccountOptions();
    loadPaymentsHistory();
  }, []);

  const loadPaymentsHistory = async () => {
    try {
      const payments = await expenseService.getAllPayments();
      // Enrichment: We need to know which expense/supplier this payment belongs to.
      // The current ExpensePayment interface might only have expense_id. 
      // We might need to join client-side or assume the service returns enriched data or we find the expense in the 'expenses' list.
      setAllPayments(payments);
    } catch (e) {
      console.error("Error loading payments history", e);
    }
  };

  const loadAccountOptions = async () => {
    try {
      const [accs, subs] = await Promise.all([
        expenseAccountService.getAllAccounts(),
        expenseAccountService.getAllSubAccounts()
      ]);
      setAccountOptions(accs);
      setSubAccountOptions(subs);
    } catch (e) {
      console.error("Error loading account options", e);
    }
  };

  const activeSubAccounts = useMemo(() => {
    // Determine active account ID based on selected account name (code)
    const selectedAcc = accountOptions.find(a => a.name === formData.account);
    if (!selectedAcc) return [];
    return subAccountOptions.filter(s => s.account_id === selectedAcc.id);
  }, [formData.account, accountOptions, subAccountOptions]);

  const activeEditSubAccounts = useMemo(() => {
    const selectedAcc = accountOptions.find(a => a.name === editFormData.account);
    if (!selectedAcc) return [];
    return subAccountOptions.filter(s => s.account_id === selectedAcc.id);
  }, [editFormData.account, accountOptions, subAccountOptions]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await expenseService.getAll();
      setExpenses(data);
    } catch (e) { console.error("Error loading expenses", e); }
    setLoading(false);
  };

  const loadSuppliers = async () => {
    try {
      const data = await supplierService.getAll();
      setSuppliers(data);
    } catch (e) { console.error('Error loading suppliers', e); }
  };

  // --- FORM HANDLERS (Create Expense) ---
  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const account = e.target.value as ExpenseAccount;
    setFormData(prev => ({
      ...prev,
      account,
      sub_account: '' // Reset subaccount when parent changes
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.account || !formData.sub_account || !formData.supplier || !formData.total) {
      alert("Por favor complete todos los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      // Find supplier ID if exists
      const matchedSupplier = suppliers.find(s => s.name === formData.supplier);

      const result = await expenseService.create({
        date: formData.date,
        supplier: formData.supplier,
        supplier_id: matchedSupplier?.id,
        account: formData.account,
        sub_account: formData.sub_account,
        total: parseFloat(formData.total),
        payment_type: formData.payment_type,
        image_url: formData.image_url,
        description: formData.description,
        user_id: user.id
      });

      if (result.success) {
        setFormData(getInitialFormState());
        setShowModal(false);
        await loadData();
        alert("Gasto registrado exitosamente");
      } else {
        alert("Error al registrar gasto.");
      }
    } catch (error) {
      console.error("Crash avoided:", error);
      alert("Ocurrió un error inesperado al guardar.");
    } finally {
      setLoading(false);
    }
  };

  // --- EDIT & DELETE HANDLERS ---
  const handleOpenEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setEditFormData({
      date: getBusinessDateString(expense.date),
      supplier: expense.supplier,
      account: expense.account,
      sub_account: expense.sub_account,
      total: expense.total.toString(),
      payment_type: expense.payment_type,
      image_url: expense.image_url || '',
      description: expense.description || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    if (!editFormData.account || !editFormData.sub_account || !editFormData.supplier || !editFormData.total) {
      alert("Por favor complete todos los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      const result = await expenseService.update(editingExpense.id, {
        date: editFormData.date,
        supplier: editFormData.supplier,
        account: editFormData.account,
        sub_account: editFormData.sub_account,
        total: parseFloat(editFormData.total),
        payment_type: editFormData.payment_type,
        image_url: editFormData.image_url,
        description: editFormData.description
      });

      if (result.success) {
        setIsEditModalOpen(false);
        setEditingExpense(null);
        await loadData();
        alert("Gasto actualizado exitosamente");
      } else {
        alert("Error al actualizar gasto.");
      }
    } catch (error) {
      console.error("Error updating expense:", error);
      alert("Ocurrió un error inesperado al actualizar.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`¿Está seguro de eliminar el gasto de ${expense.supplier} por $${expense.total.toFixed(2)}?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await expenseService.delete(expense.id, { id: user.id, name: user.full_name });

      if (result.success) {
        await loadData();
        alert("Gasto eliminado exitosamente");
      } else {
        alert("Error al eliminar gasto.");
      }
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("Ocurrió un error inesperado al eliminar.");
    } finally {
      setLoading(false);
    }
  };

  // --- CXP HANDLERS ---
  const handleOpenDebtManager = async (expense: Expense) => {
    setLoading(true);
    const payments = await expenseService.getPayments(expense.id);
    setSelectedExpenseForDebt(expense);
    setPaymentHistory(payments);
    setNewPaymentAmount('');
    setNewPaymentNote('');
    setIsDebtModalOpen(true);
    setLoading(false);
  };

  // Custom Stepper Logic for Payment Amount
  const handleAdjustAmount = (delta: number) => {
    if (!selectedExpenseForDebt) return;

    const current = parseFloat(newPaymentAmount) || 0;
    let next = current + delta;

    // Validations
    if (next < 0) next = 0;
    if (next > selectedExpenseForDebt.remaining_amount) {
      next = selectedExpenseForDebt.remaining_amount;
    }

    setNewPaymentAmount(next.toFixed(2));
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpenseForDebt || !newPaymentAmount) return;

    const amount = parseFloat(newPaymentAmount);
    if (amount <= 0 || amount > selectedExpenseForDebt.remaining_amount) {
      alert("Monto inválido. No puede ser mayor al saldo pendiente.");
      return;
    }

    setLoading(true);
    const result = await expenseService.addPayment(
      selectedExpenseForDebt.id,
      amount,
      newPaymentNote,
      user.id
    );

    if (result.success) {
      await loadData(); // Refresh main list
      // Refresh local modal data manually to avoid full close
      const updatedExpense = expenses.find(e => e.id === selectedExpenseForDebt.id);
      // Note: expenses state might not be updated inside this closure yet, so we rely on loadData then re-fetch logic
      const payments = await expenseService.getPayments(selectedExpenseForDebt.id);
      setPaymentHistory(payments);

      // Update local header visualization hack
      setSelectedExpenseForDebt(prev => prev ? ({
        ...prev,
        remaining_amount: prev.remaining_amount - amount,
        status: (prev.remaining_amount - amount) <= 0.01 ? 'PAID' : 'PARTIAL'
      }) : null);

      setNewPaymentAmount('');
      setNewPaymentNote('');
      alert("Abono registrado.");
    } else {
      alert(`Error al registrar pago: ${result.error || 'Error desconocido'}`);
    }
    setLoading(false);
  };

  // --- CAMERA & IMAGE LOGIC ---
  useEffect(() => {
    if (isCameraOpen) {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera Error", err);
          alert("No se pudo acceder a la cámara.");
          setIsCameraOpen(false);
        }
      };
      startCamera();
    }
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen]);

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        if (isEditModalOpen) {
          setEditFormData(prev => ({ ...prev, image_url: dataUrl }));
        } else {
          setFormData(prev => ({ ...prev, image_url: dataUrl }));
        }
        setIsCameraOpen(false);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditFormData(prev => ({ ...prev, image_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Filter suppliers for autocomplete
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(formData.supplier.toLowerCase())
  );

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const totalExpensesHistorical = expenses.reduce((sum, e) => sum + e.total, 0);

  const totalExpensesMonth = expenses.filter(e => {
    const d = new Date(e.date);
    // Assume e.date is YYYY-MM-DD or ISO string, safe to parse
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce((sum, e) => sum + e.total, 0);

  const creditPending = expenses.filter(e => e.status !== 'PAID').reduce((sum, e) => sum + e.remaining_amount, 0);

  // Filter based on Tab
  // Filter Logic
  let filteredList = activeTab === 'ALL' ? expenses : expenses.filter(e => e.status !== 'PAID');

  if (filterDate) {
    filteredList = filteredList.filter(e => getBusinessDateString(e.date) === filterDate);
  }

  if (filterSupplier) {
    filteredList = filteredList.filter(e => e.supplier.toLowerCase().includes(filterSupplier.toLowerCase()));
  }

  const displayedExpenses = filteredList;

  // Calculate Supplier Balances for the new tab
  const supplierBalances = useMemo(() => {
    const balances: Record<string, { totalDebt: number; count: number; lastDate: string }> = {};
    expenses.forEach(exp => {
      if (!balances[exp.supplier]) {
        balances[exp.supplier] = { totalDebt: 0, count: 0, lastDate: exp.date };
      }
      // Update last interaction date
      if (exp.date > balances[exp.supplier].lastDate) {
        balances[exp.supplier].lastDate = exp.date;
      }

      // Sum debt
      if (exp.status !== 'PAID') {
        balances[exp.supplier].totalDebt += exp.remaining_amount;
        balances[exp.supplier].count += 1;
      }
    });

    return Object.entries(balances)
      .map(([name, data]) => ({ name, ...data }))
      .filter(item => item.totalDebt > 0) // Only show suppliers we owe money to
      .sort((a, b) => b.totalDebt - a.totalDebt);
  }, [expenses]);

  const handleViewSupplierDetail = (supplierName: string) => {
    setFilterSupplier(supplierName);
    setActiveTab('ALL');
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-6">
        <div className="w-full lg:w-auto">
          <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight mb-1">Control de Egresos</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <p className="text-sm text-gray-500 font-medium">Gestión de gastos, compras y CxP.</p>
            <button
              onClick={() => setIsAccountManagerOpen(true)}
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors w-fit"
            >
              <span className="text-lg leading-none">⚙</span> Configurar Cuentas
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            setFormData(getInitialFormState()); // Reset form with fresh date
            setShowModal(true);
          }}
          className="w-full sm:w-auto bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2"
        >
          <div className="bg-white/20 p-1 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </div>
          Registrar Nuevo Gasto
        </button>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Monthly Expenses */}
        <GlassCard className="flex flex-col relative overflow-hidden">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Egresos (Mes)</span>
          <span className="text-3xl font-black text-gray-800">${totalExpensesMonth.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-gray-400 mt-1 font-mono">{new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
        </GlassCard>

        {/* Historical Expenses (New) */}
        <GlassCard className="flex flex-col relative overflow-hidden">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Egreso Histórico</span>
          <span className="text-3xl font-black text-indigo-600">${totalExpensesHistorical.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-gray-400 mt-1">Acumulado Total</span>
        </GlassCard>

        {/* Customized Debt Card - Premium Look */}
        <GlassCard className="relative overflow-hidden group flex flex-col justify-between">
          {/* Ambient Light Effect (Blur Orb) */}
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-400/20 rounded-full blur-2xl group-hover:bg-orange-400/30 transition-all"></div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cuentas por Pagar</span>
              {/* Subtle Icon Box */}
              <div className="p-1.5 bg-orange-50 rounded-lg text-orange-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M10 13h4" /><path d="M10 17h4" /></svg>
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-gray-800 tracking-tight">
                ${creditPending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {creditPending > 0 ? (
              <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-orange-600">
                {/* Pulsing Dot Indicator */}
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                Saldo Pendiente
              </div>
            ) : (
              <div className="mt-2 text-[10px] font-bold text-green-500 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Al día
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-1">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2 font-bold text-sm transition-colors relative ${activeTab === 'ALL' ? 'text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Histórico Completo
          {activeTab === 'ALL' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-primary"></div>}
        </button>
        <button
          onClick={() => setActiveTab('CREDIT')}
          className={`px-4 py-2 font-bold text-sm transition-colors relative ${activeTab === 'CREDIT' ? 'text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Cuentas por Pagar
          {creditPending > 0 && <span className="ml-2 bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full text-[10px]">${creditPending.toFixed(0)}</span>}
          {activeTab === 'CREDIT' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-primary"></div>}
        </button>
        <button
          onClick={() => setActiveTab('SUPPLIER_BALANCE')}
          className={`px-4 py-2 font-bold text-sm transition-colors relative ${activeTab === 'SUPPLIER_BALANCE' ? 'text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Saldo por Proveedor
          {activeTab === 'SUPPLIER_BALANCE' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-primary"></div>}
        </button>
        <button
          onClick={() => setActiveTab('PAYMENT_HISTORY')}
          className={`px-4 py-2 font-bold text-sm transition-colors relative ${activeTab === 'PAYMENT_HISTORY' ? 'text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Historial de Abonos
          {activeTab === 'PAYMENT_HISTORY' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-primary"></div>}
        </button>
      </div>

      {/* Filters Bar */}
      <GlassCard className="p-4 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full md:w-auto">
          <label className="block text-xs font-bold text-gray-500 mb-1">Filtrar por Fecha</label>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm font-bold text-gray-700"
          />
        </div>
        <div className="flex-1 w-full md:w-auto">
          <label className="block text-xs font-bold text-gray-500 mb-1">Filtrar por Proveedor</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar proveedor..."
              value={filterSupplier}
              onChange={e => setFilterSupplier(e.target.value)}
              className="w-full pl-9 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </div>
          </div>
        </div>
        {(filterDate || filterSupplier) && (
          <button
            onClick={() => { setFilterDate(''); setFilterSupplier(''); }}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2 h-[38px]"
          >
            Limpiar
          </button>
        )}
      </GlassCard>

      {/* Expense Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'SUPPLIER_BALANCE' ? (
            /* SUPPLIER BALANCE TABLE */
            <table className="w-full text-left text-xs">
              <thead className="bg-white/50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 min-w-[180px]">Proveedor</th>
                  <th className="py-3 px-4 text-center min-w-[120px]">Facturas Pendientes</th>
                  <th className="py-3 px-4 text-right min-w-[140px]">Último Movimiento</th>
                  <th className="py-3 px-4 text-right min-w-[120px]">Saldo Total</th>
                  <th className="py-3 px-4 text-right min-w-[100px]">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supplierBalances.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No hay saldos pendientes con proveedores.</td></tr>
                ) : (
                  supplierBalances.map((item) => (
                    <tr key={item.name} className="hover:bg-white/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-gray-800">{item.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold">{item.count}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 font-mono text-xs">
                        {getBusinessDateString(item.lastDate)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-orange-600 text-lg">
                        ${item.totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleViewSupplierDetail(item.name)}
                          className="text-brand-primary hover:text-brand-secondary font-bold text-xs underline"
                        >
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'PAYMENT_HISTORY' ? (
            /* PAYMENT HISTORY TABLE */
            <table className="w-full text-left text-xs">
              <thead className="bg-white/50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 min-w-[120px]">Fecha Pago</th>
                  <th className="py-3 px-4 min-w-[180px]">Proveedor / Gasto</th>
                  <th className="py-3 px-4 text-left min-w-[150px]">Nota / Referencia</th>
                  <th className="py-3 px-4 text-left min-w-[120px]">Registrado Por</th>
                  <th className="py-3 px-4 text-right min-w-[120px]">Monto Abonado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allPayments.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No hay abonos registrados.</td></tr>
                ) : (
                  allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(pay => {
                    // Find related expense to show supplier
                    const relatedExpense = expenses.find(e => e.id === pay.expense_id);
                    const supplierName = relatedExpense ? relatedExpense.supplier : 'Gasto Eliminado / Desconocido';

                    return (
                      <tr key={pay.id} className="hover:bg-white/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-700">{getBusinessDateString(pay.date)}</span>
                            <span className="text-[10px] text-gray-400">{new Date(pay.date).toLocaleTimeString()}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="block font-bold text-gray-800">{supplierName}</span>
                          {relatedExpense && <span className="text-[10px] text-gray-500">Ref Gasto: {relatedExpense.sub_account}</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-600 font-medium break-all max-w-[200px]">{pay.note || '-'}</td>
                        <td className="py-3 px-4 text-gray-500 text-[10px]">ID: {pay.user_id?.slice(0, 8)}...</td>
                        <td className="py-3 px-4 text-right font-black text-green-600">
                          +${pay.amount.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* STANDARD EXPENSE TABLE */
            <table className="w-full text-left text-xs">
              <thead className="bg-white/50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 min-w-[120px]">Fecha</th>
                  <th className="py-3 px-4 min-w-[180px]">Proveedor</th>
                  <th className="py-3 px-4 min-w-[180px]">Cuenta / Detalle</th>
                  <th className="py-3 px-4 text-center min-w-[100px]">Estado</th>
                  <th className="py-3 px-4 text-right min-w-[120px]">Total Orig.</th>
                  <th className="py-3 px-4 text-right min-w-[120px]">Saldo Pend.</th>
                  <th className="py-3 px-4 text-right min-w-[140px]">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedExpenses.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">No hay registros para esta vista.</td></tr>
                ) : (
                  displayedExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-white/40 transition-colors">
                      <td className="py-3 px-4 text-gray-600">
                        <span className="block font-bold">{getBusinessDateString(exp.date)}</span>
                        <span className="text-[10px] text-gray-400">{exp.id}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-800">{exp.supplier}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-700 text-xs">{formatAccountName(exp.account)}</span>
                          <span className="text-xs text-gray-500">{exp.sub_account}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {exp.status === 'PAID' ? (
                          <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold">PAGADO</span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs font-bold">PENDIENTE</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 font-medium">
                        ${exp.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-gray-800">
                        ${exp.remaining_amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuExpenseId(activeMenuExpenseId === exp.id ? null : exp.id);
                          }}
                          className={`p-2 rounded-full transition-colors ${activeMenuExpenseId === exp.id ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-brand-primary hover:bg-gray-100'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuExpenseId === exp.id && (
                          <>
                            <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveMenuExpenseId(null)} />
                            <div className="absolute right-8 top-8 z-50 bg-white/95 backdrop-blur-xl shadow-2xl rounded-xl border border-white/50 p-1.5 min-w-[200px] flex flex-col gap-1 animate-fade-in text-left">

                              {/* Abonar Action (Only if pending) */}
                              {exp.status !== 'PAID' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenDebtManager(exp); setActiveMenuExpenseId(null); }}
                                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-brand-primary/10 text-gray-700 hover:text-brand-primary rounded-lg transition-colors text-xs font-bold"
                                >
                                  <div className="p-1.5 bg-brand-primary/20 rounded-md text-brand-primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                  </div>
                                  Abonar Deuda
                                </button>
                              )}

                              <button
                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(exp); setActiveMenuExpenseId(null); }}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-lg transition-colors text-xs font-bold"
                              >
                                <div className="p-1.5 bg-blue-100 rounded-md text-blue-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                </div>
                                Editar Gasto
                              </button>

                              {/* View Receipt (if exists) */}
                              {exp.image_url && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewReceipt(exp.image_url!);
                                    setActiveMenuExpenseId(null);
                                  }}
                                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50 text-gray-600 hover:text-violet-600 rounded-lg transition-colors text-xs font-bold"
                                >
                                  <div className="p-1.5 bg-violet-100 rounded-md text-violet-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                  </div>
                                  Ver Recibo
                                </button>
                              )}

                              <div className="h-px bg-gray-100 my-1 mx-2"></div>

                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(exp); setActiveMenuExpenseId(null); }}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 text-gray-600 hover:text-red-500 rounded-lg transition-colors text-xs font-bold"
                              >
                                <div className="p-1.5 bg-red-100 rounded-md text-red-500">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </div>
                                Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </GlassCard>

      {/* ACCOUNT MANAGER MODAL */}
      {isAccountManagerOpen && (
        <ExpenseAccountManager
          onClose={() => setIsAccountManagerOpen(false)}
          onUpdate={loadAccountOptions}
        />
      )}

      {/* --- CXP DEBT MANAGER MODAL --- */}
      {isDebtModalOpen && selectedExpenseForDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-lg bg-white border-white shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Gestión de Deuda</h3>
                <p className="text-xs text-gray-500 font-mono">{selectedExpenseForDebt.id} • {selectedExpenseForDebt.supplier}</p>
              </div>
              <button onClick={() => setIsDebtModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* Debt Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div>
                <span className="block text-xs text-gray-500">Monto Original</span>
                <span className="block text-lg font-medium text-gray-800">${selectedExpenseForDebt.total.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="block text-xs text-gray-500 font-bold uppercase">Saldo Actual</span>
                <span className="block text-2xl font-black text-orange-600">${selectedExpenseForDebt.remaining_amount.toFixed(2)}</span>
              </div>
            </div>

            {/* New Payment Form */}
            {selectedExpenseForDebt.status !== 'PAID' && (
              <form onSubmit={handleRegisterPayment} className="mb-6 border-b border-gray-100 pb-6">
                <h4 className="text-sm font-bold text-gray-700 mb-4">Registrar Nuevo Abono</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">

                  {/* Column 1: Amount Stepper */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Monto a Pagar</label>
                    <div className="flex items-center h-11 rounded-xl border border-gray-200 bg-gray-50 focus-within:ring-2 focus-within:ring-brand-primary focus-within:bg-white transition-all overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => handleAdjustAmount(-5)}
                        className="w-10 h-full bg-gray-100 hover:bg-brand-primary hover:text-white text-gray-500 font-bold transition-colors border-r border-gray-200 flex items-center justify-center text-lg active:bg-brand-secondary"
                      >
                        -
                      </button>
                      <div className="flex-1 relative h-full">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-primary font-bold text-sm">$</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={selectedExpenseForDebt.remaining_amount}
                          value={newPaymentAmount}
                          onChange={e => setNewPaymentAmount(e.target.value)}
                          className="w-full h-full text-center bg-transparent border-none outline-none font-bold text-gray-800 text-base px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAdjustAmount(5)}
                        className="w-10 h-full bg-gray-100 hover:bg-brand-primary hover:text-white text-gray-500 font-bold transition-colors border-l border-gray-200 flex items-center justify-center text-lg active:bg-brand-secondary"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-[9px] text-gray-400 text-center mt-1">± $5.00 Rapido</div>
                  </div>

                  {/* Column 2: Note */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Nota / Referencia</label>
                    <input
                      type="text"
                      value={newPaymentNote}
                      onChange={e => setNewPaymentNote(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-brand-primary focus:bg-white focus:border-transparent outline-none text-sm transition-all shadow-sm"
                      placeholder="Ej. Cheque 404..."
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-5 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 transform active:scale-[0.98]"
                >
                  {loading ? 'Procesando...' : (
                    <>
                      <span>Confirmar Pago</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Payment History */}
            <div className="flex-1 overflow-y-auto">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Historial de Pagos</h4>
              {paymentHistory.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-sm text-gray-400 italic">No se han registrado abonos aún.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentHistory.map(pay => (
                    <div key={pay.id} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-gray-700">{new Date(pay.date).toLocaleString()}</span>
                          <span className="block text-[10px] text-gray-500">{pay.note || 'Sin nota'}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-green-600 text-sm">+${pay.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* CREATE EXPENSE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-2xl bg-white border-white shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">Registrar Nuevo Egreso</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fecha */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Fecha de Emisión</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>
                {/* Proveedor / Beneficiario CON AUTOCOMPLETADO */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Proveedor / Beneficiario</label>
                  <input
                    type="text"
                    required
                    placeholder="Buscar o Ingresar Nuevo..."
                    value={formData.supplier}
                    onChange={e => {
                      setFormData({ ...formData, supplier: e.target.value });
                      setShowSupplierResults(true);
                    }}
                    onFocus={() => setShowSupplierResults(true)}
                    // OnBlur optional handling can be tricky, relying on click outside or selection
                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                  {/* Supplier Dropdown - Updated to show full list on focus with custom scrollbar */}
                  {showSupplierResults && (
                    <>
                      {/* Backdrop to close when clicking outside */}
                      <div className="fixed inset-0 z-10" onClick={() => setShowSupplierResults(false)}></div>

                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto z-20 custom-scrollbar animate-fade-in">
                        {filteredSuppliers.length === 0 && formData.supplier ? (
                          <div className="px-4 py-3 text-gray-500 text-xs italic bg-gray-50">
                            Se registrará como nuevo: <span className="font-bold">"{formData.supplier}"</span>
                          </div>
                        ) : (
                          <>
                            {filteredSuppliers.map(s => (
                              <div
                                key={s.id}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, supplier: s.name }));
                                  setShowSupplierResults(false);
                                }}
                                className="px-4 py-3 hover:bg-brand-primary/5 hover:text-brand-primary cursor-pointer text-sm border-b border-gray-50 last:border-0 transition-colors flex items-center justify-between group"
                              >
                                <span className="font-medium">{s.name}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-primary"><polyline points="20 6 9 17 4 12" /></svg>
                              </div>
                            ))}
                            {filteredSuppliers.length === 0 && (
                              <div className="px-4 py-3 text-gray-400 text-xs text-center italic">No hay proveedores registrados aún</div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Cuenta Mayor - Custom Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Cuenta Principal <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                      className={`w-full px-4 py-3 rounded-xl bg-white border-2 transition-all shadow-sm flex items-center justify-between group ${!formData.account ? 'border-red-300 hover:border-red-400' : 'border-gray-200 hover:border-brand-primary'
                        } focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 outline-none font-medium text-left`}
                    >
                      <span className={formData.account ? 'text-gray-800' : 'text-gray-400'}>
                        {formData.account ? formatAccountName(formData.account) : '-- Seleccionar Cuenta --'}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`text-brand-primary transition-transform duration-200 ${isAccountDropdownOpen ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isAccountDropdownOpen && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setIsAccountDropdownOpen(false)}
                        ></div>

                        {/* Options */}
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden animate-fade-in">
                          <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {accountOptions.map((acc) => (
                              <button
                                key={acc.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, account: acc.name, sub_account: '' });
                                  setIsAccountDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-3 text-left hover:bg-brand-primary/5 transition-colors border-b border-gray-100 last:border-0 ${formData.account === acc.name ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-700'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{formatAccountName(acc.name)}</span>
                                  {formData.account === acc.name && (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-brand-primary">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Subcuenta - Custom Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Subcuenta / Detalle <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      disabled={!formData.account}
                      onClick={() => formData.account && setIsSubAccountDropdownOpen(!isSubAccountDropdownOpen)}
                      className={`w-full px-4 py-3 rounded-xl bg-white border-2 outline-none font-medium text-left transition-all shadow-sm flex items-center justify-between ${formData.account
                        ? (!formData.sub_account ? 'border-red-300 hover:border-red-400' : 'border-gray-200 hover:border-brand-primary') + ' focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                        }`}
                    >
                      <span className={formData.sub_account ? 'text-gray-800' : 'text-gray-400'}>
                        {!formData.account
                          ? '-- Primero seleccione una cuenta --'
                          : formData.sub_account
                            ? formData.sub_account
                            : '-- Seleccionar Subcuenta --'}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform duration-200 ${formData.account ? 'text-brand-primary' : 'text-gray-300'
                          } ${isSubAccountDropdownOpen ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isSubAccountDropdownOpen && formData.account && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setIsSubAccountDropdownOpen(false)}
                        ></div>

                        {/* Options */}
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden animate-fade-in">
                          <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {activeSubAccounts.map((sub) => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, sub_account: sub.name });
                                  setIsSubAccountDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-3 text-left hover:bg-brand-primary/5 transition-colors border-b border-gray-100 last:border-0 ${formData.sub_account === sub.name ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-700'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{sub.name}</span>
                                  {formData.sub_account === sub.name && (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-brand-primary">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* Total */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Monto Total</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={formData.total}
                      onChange={e => setFormData({ ...formData, total: e.target.value })}
                      className="w-full pl-8 pr-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none font-bold"
                    />
                  </div>
                </div>
                {/* Tipo Pago */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Condición de Pago</label>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, payment_type: 'CONTADO' })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${formData.payment_type === 'CONTADO' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      CONTADO
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, payment_type: 'CREDITO' })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${formData.payment_type === 'CREDITO' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      CRÉDITO
                    </button>
                  </div>
                </div>

                {/* Concepto / Descripción */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Concepto / Descripción</label>
                  <textarea
                    rows={2}
                    placeholder="Detalle adicional del gasto..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none transition-all resize-none text-sm"
                  />
                </div>
              </div>

              {/* Evidence Section */}
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-bold text-gray-500 mb-2">Comprobante / Factura</label>

                {formData.image_url ? (
                  <div className="relative h-40 w-full rounded-lg overflow-hidden border border-gray-200 group">
                    <img src={formData.image_url} alt="Evidence" className="w-full h-full object-contain bg-gray-50" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image_url: '' })}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                      <span className="text-xs font-bold">Subir Archivo</span>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-brand-primary/30 rounded-xl bg-brand-primary/5 hover:bg-brand-primary/10 transition-colors text-brand-primary"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                      <span className="text-xs font-bold">Tomar Foto</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3.5 rounded-xl mt-4 transition-all shadow-lg shadow-brand-primary/20"
              >
                {loading ? 'Guardando...' : 'Registrar Gasto'}
              </button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* EDIT EXPENSE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-2xl bg-white border-white shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-blue-800">Editar Gasto / Egreso</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fecha */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Fecha de Emisión</label>
                  <input
                    type="date"
                    required
                    value={editFormData.date}
                    onChange={e => setEditFormData({ ...editFormData, date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                {/* Proveedor / Beneficiario */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Proveedor / Beneficiario</label>
                  <input
                    type="text"
                    required
                    value={editFormData.supplier}
                    onChange={e => setEditFormData({ ...editFormData, supplier: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Cuenta Mayor */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Cuenta Principal</label>
                  <select
                    className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editFormData.account}
                    onChange={e => setEditFormData({ ...editFormData, account: e.target.value as ExpenseAccount, sub_account: '' })}
                  >
                    <option value="">-- Seleccionar --</option>
                    {accountOptions.map((acc) => (
                      <option key={acc.id} value={acc.name}>{formatAccountName(acc.name)}</option>
                    ))}
                  </select>
                </div>

                {/* Subcuenta */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Subcuenta / Detalle</label>
                  <select
                    className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editFormData.sub_account}
                    disabled={!editFormData.account}
                    onChange={e => setEditFormData({ ...editFormData, sub_account: e.target.value })}
                  >
                    <option value="">-- Seleccionar --</option>
                    {activeEditSubAccounts.map(sub => (
                      <option key={sub.id} value={sub.name}>{sub.name}</option>
                    ))}
                  </select>
                </div>

                {/* Total */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Monto Total</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={editFormData.total}
                      onChange={e => setEditFormData({ ...editFormData, total: e.target.value })}
                      className="w-full pl-8 pr-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                  </div>
                </div>

                {/* Tipo Pago */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Condición de Pago</label>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, payment_type: 'CONTADO' })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${editFormData.payment_type === 'CONTADO' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      CONTADO
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, payment_type: 'CREDITO' })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${editFormData.payment_type === 'CREDITO' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      CRÉDITO
                    </button>
                  </div>
                </div>

                {/* Concepto / Descripción */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Concepto / Descripción</label>
                  <textarea
                    rows={2}
                    placeholder="Detalle adicional..."
                    value={editFormData.description}
                    onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-sm"
                  />
                </div>
              </div>

              {/* Edit Evidence Section */}
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-bold text-gray-500 mb-2">Comprobante / Factura</label>

                {editFormData.image_url ? (
                  <div className="relative h-40 w-full rounded-lg overflow-hidden border border-gray-200 group">
                    <img src={editFormData.image_url} alt="Evidence" className="w-full h-full object-contain bg-gray-50" />
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, image_url: '' })}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputEditRef.current?.click()}
                      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                      <span className="text-xs font-bold">Subir Archivo</span>
                      <input ref={fileInputEditRef} type="file" accept="image/*" className="hidden" onChange={handleEditFileUpload} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-brand-primary/30 rounded-xl bg-brand-primary/5 hover:bg-brand-primary/10 transition-colors text-brand-primary"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                      <span className="text-xs font-bold">Tomar Foto</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-2 rounded-xl text-gray-500 hover:bg-gray-100 font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded-xl transition-all shadow-lg shadow-blue-500/20"
                >
                  {loading ? 'Guardando...' : 'Actualizar Gasto'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
          <div className="w-full h-full relative flex flex-col">
            <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
              <span className="text-white font-bold">Foto Comprobante</span>
              <button onClick={() => setIsCameraOpen(false)} className="bg-black/40 text-white p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center items-center bg-gradient-to-t from-black/80 to-transparent z-20">
              <button onClick={handleCapturePhoto} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:bg-white/40">
                <div className="w-16 h-16 bg-white rounded-full"></div>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* VIEW RECEIPT MODAL */}
      {/* VIEW RECEIPT MODAL (ZOOMABLE) */}
      {viewReceiptUrl && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in"
          onClick={() => setViewReceiptUrl(null)}
        >
          {/* Toolbar */}
          <div
            className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex gap-4">
              <button
                onClick={() => setReceiptZoom(prev => Math.max(0.5, prev - 0.25))}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                title="Zoom Out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
              <button
                onClick={() => setReceiptZoom(1)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white font-bold text-sm transition-colors"
              >
                {Math.round(receiptZoom * 100)}%
              </button>
              <button
                onClick={() => setReceiptZoom(prev => Math.min(3, prev + 0.25))}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                title="Zoom In"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
            </div>

            <button
              onClick={() => setViewReceiptUrl(null)}
              className="p-2 bg-white/10 hover:bg-red-500/80 rounded-full text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          {/* Image Container with Scroll */}
          <div
            className="w-full h-full overflow-auto flex items-center justify-center p-4 scrollbar-hide"
            onClick={() => setViewReceiptUrl(null)}
          >
            {/* 
                We use a wrapper to allow the image to scale without affecting layout flow abruptly 
                and to center it when smaller than viewport 
             */}
            <div className="relative" onClick={e => e.stopPropagation()}>
              <img
                src={viewReceiptUrl}
                alt="Comprobante"
                style={{
                  transform: `scale(${receiptZoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out',
                  maxWidth: '90vw',
                  maxHeight: '85vh'
                }}
                className={`object-contain rounded-lg shadow-2xl bg-white/5 ${receiptZoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                // Allow dragging via standard scrolling
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
