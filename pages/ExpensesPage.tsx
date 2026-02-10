
import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../components/GlassCard';
import { expenseService } from '../services/supabaseService';
import { User, Expense, ExpenseAccount, ExpensePaymentType, ExpensePayment } from '../types';

interface ExpensesPageProps {
  user: User;
}

// Configuración de Cuentas y Subcuentas
const ACCOUNT_OPTIONS: Record<ExpenseAccount, string> = {
  SERVICIOS_BASICOS: 'Servicios Básicos',
  GASTOS_OPERATIVOS: 'Gastos Operativos',
  COMPRA_MERCADERIA: 'Compra Mercadería',
  IMPUESTOS: 'Impuestos y Tasas',
  MANTENIMIENTO: 'Mantenimiento'
};

const SUB_ACCOUNT_OPTIONS: Record<ExpenseAccount, string[]> = {
  SERVICIOS_BASICOS: ['Energía Eléctrica', 'Agua Potable', 'Internet y Telefonía', 'Extracción Basura'],
  GASTOS_OPERATIVOS: ['Alquiler Local', 'Planilla', 'Papelería y Útiles', 'Limpieza', 'Transporte/Combustible'],
  COMPRA_MERCADERIA: ['Proveedores Nacionales', 'Importación', 'Fletes de Compra', 'Aduanas'],
  IMPUESTOS: ['IVA', 'ISR', 'IBI', 'Tasas Municipales'],
  MANTENIMIENTO: ['Reparaciones Local', 'Mantenimiento Equipos', 'Pintura', 'Jardinería']
};

const INITIAL_FORM_STATE = {
  date: new Date().toISOString().split('T')[0],
  supplier: '',
  account: '' as ExpenseAccount | '',
  sub_account: '',
  total: '',
  payment_type: 'CONTADO' as ExpensePaymentType,
  image_url: ''
};

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ user }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);

  // Tab State: ALL (Registro General) vs CREDIT (Cuentas por Pagar)
  const [activeTab, setActiveTab] = useState<'ALL' | 'CREDIT'>('ALL');

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await expenseService.getAll();
    setExpenses(data);
    setLoading(false);
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
    await expenseService.create({
      date: formData.date,
      supplier: formData.supplier,
      account: formData.account as ExpenseAccount,
      sub_account: formData.sub_account,
      total: parseFloat(formData.total),
      payment_type: formData.payment_type,
      image_url: formData.image_url,
      user_id: user.id
    });

    setFormData(INITIAL_FORM_STATE);
    setShowModal(false);
    await loadData();
    setLoading(false);
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
      alert("Error al registrar pago.");
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
        setFormData(prev => ({ ...prev, image_url: dataUrl }));
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
  const displayedExpenses = activeTab === 'ALL'
    ? expenses
    : expenses.filter(e => e.status !== 'PAID');

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Control de Egresos</h2>
          <p className="text-gray-500">Gestión de gastos, compras y Cuentas por Pagar (CxP).</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-2"
        >
          <span className="text-xl leading-none">+</span> Registrar Gasto
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
      </div>

      {/* Expense Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/50 text-gray-500 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">Cuenta / Detalle</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Total Orig.</th>
                <th className="py-3 px-4 text-right">Saldo Pend.</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedExpenses.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400">No hay registros para esta vista.</td></tr>
              ) : (
                displayedExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-white/40 transition-colors">
                    <td className="py-3 px-4 text-gray-600">
                      <span className="block font-bold">{new Date(exp.date).toLocaleDateString()}</span>
                      <span className="text-[10px] text-gray-400">{exp.id}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-800">{exp.supplier}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-700 text-xs">{ACCOUNT_OPTIONS[exp.account]}</span>
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
                    <td className="py-3 px-4 text-right">
                      {exp.status !== 'PAID' && (
                        <button
                          onClick={() => handleOpenDebtManager(exp)}
                          className="bg-brand-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-secondary transition-colors shadow-md"
                        >
                          Abonar
                        </button>
                      )}
                      {exp.status === 'PAID' && exp.image_url && (
                        <button
                          onClick={() => window.open(exp.image_url)}
                          className="text-blue-500 hover:text-blue-700 text-xs underline"
                        >
                          Ver Recibo
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

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

      {/* CREATE EXPENSE MODAL (Unchanged logic, kept for consistency) */}
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
                {/* Proveedor */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Proveedor / Beneficiario</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Claro, Walmart, Juan Perez"
                    value={formData.supplier}
                    onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>
                {/* Cuenta Mayor */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Cuenta Principal</label>
                  <select
                    required
                    value={formData.account}
                    onChange={handleAccountChange}
                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                  >
                    <option value="">-- Seleccionar --</option>
                    {Object.entries(ACCOUNT_OPTIONS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                {/* Subcuenta (Dependiente) */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Subcuenta / Detalle</label>
                  <select
                    required
                    disabled={!formData.account}
                    value={formData.sub_account}
                    onChange={e => setFormData({ ...formData, sub_account: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">-- Seleccionar --</option>
                    {formData.account && SUB_ACCOUNT_OPTIONS[formData.account].map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
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
    </div>
  );
};
