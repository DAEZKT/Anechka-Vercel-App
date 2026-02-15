
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GlassCard } from '../components/GlassCard';
import { productService, salesService, paymentMethodService, customerService, categoryService } from '../services/supabaseService';
import { geminiService } from '../services/geminiService';
import { Product, CartItem, User, PaymentMethod, Customer, PaymentMethodType, Category, ProductGender } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import { jsPDF } from "jspdf";
import { ScannerModal } from '../components/ScannerModal';

// --- PAYMENT ICONS (Lucide) ---
const PaymentIcons = {
  Cash: () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>,
  Card: () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>,
  Transfer: () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="22" y2="22" /><line x1="6" x2="6" y1="18" y2="11" /><line x1="10" x2="10" y1="18" y2="11" /><line x1="14" x2="14" y1="18" y2="11" /><line x1="18" x2="18" y1="18" y2="11" /><polygon points="12 2 20 7 4 7" /></svg>,
  Other: () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>,
  Back: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>,
  ChevronRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
};

interface POSProps {
  user: User;
}

interface PaymentEntry {
  methodId: string;
  methodName: string;
  type: PaymentMethodType;
  amount: number;
}

export const POS: React.FC<POSProps> = ({ user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // --- FILTERS STATE ---
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [uniqueBrands, setUniqueBrands] = useState<string[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const activeFiltersCount = [filterCategory, filterBrand, filterGender].filter(Boolean).length;

  // --- CUSTOM DROPDOWN STATE ---
  const [activeDropdown, setActiveDropdown] = useState<'CATEGORY' | 'BRAND' | 'GENDER' | null>(null);

  // Mobile View State
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'CART'>('CATALOG');

  // Customer Management
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', nit: '', phone: '', email: '', address: '' });

  const [processing, setProcessing] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentMethodType | null>(null);

  // SPLIT PAYMENT STATE
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [pendingAmount, setPendingAmount] = useState<string>(''); // For the input field

  // --- SCANNER STATE ---
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const [prods, cats, methods] = await Promise.all([
        productService.getAll(),
        categoryService.getAll(),
        paymentMethodService.getAll(true)
      ]);
      setProducts(prods);
      setCategories(cats);
      setPaymentMethods(methods);

      // Extract unique brands for filter
      const brands = Array.from(new Set(prods.map(p => p.brand))).sort();
      setUniqueBrands(brands);
    };
    loadData();
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const data = await customerService.getAll();
    setCustomers(data);
  };

  // --- TICKET GENERATOR ---
  const generateTicket = (orderId: string, customerName: string, items: CartItem[], payments: PaymentEntry[]) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200] // 80mm thermal paper width
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 10;

    // Header
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TIENDA ANECHKA", pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Moda y Estilo", pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.text(`${new Date().toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.text(`Ticket: ${orderId}`, pageWidth / 2, y, { align: "center" });
    y += 7;

    // Customer
    doc.text(`Cliente: ${customerName}`, 5, y);
    y += 5;
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Items
    doc.setFontSize(8);

    items.forEach(item => {
      const finalPrice = item.price - (item.discountPerUnit || 0);
      const subtotal = finalPrice * item.quantity;

      // Line 1: Name
      doc.setFont("helvetica", "bold");
      doc.text(`${item.quantity} x ${item.name}`, 5, y);
      y += 4;

      // Line 2: Prices
      doc.setFont("helvetica", "normal");
      let priceText = `$${item.price.toFixed(2)}`;
      if (item.discountPerUnit && item.discountPerUnit > 0) {
        priceText += ` (-$${item.discountPerUnit.toFixed(2)})`;
      }
      doc.text(priceText, 10, y);
      doc.setFont("helvetica", "bold");
      doc.text(`$${subtotal.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
      y += 5;
    });

    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Totals
    const total = items.reduce((sum, item) => sum + ((item.price - (item.discountPerUnit || 0)) * item.quantity), 0);
    doc.setFontSize(10);
    doc.text("TOTAL:", 5, y);
    doc.text(`$${total.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
    y += 7;

    // Payments
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Pagos Recibidos:", 5, y);
    y += 4;

    payments.forEach(p => {
      doc.text(`${p.methodName}`, 10, y);
      doc.text(`$${p.amount.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
      y += 4;
    });

    // Footer
    y += 5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.text("¡Gracias por su compra!", pageWidth / 2, y, { align: "center" });

    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  // --- SCANNER LOGIC REPLACED BY MODAL ---
  const handleScanSuccess = (code: string) => {
    setSearchTerm(code);
    // Try to auto-add if exact match
    const exactMatch = products.find(p => p.sku.toLowerCase() === code.toLowerCase());
    if (exactMatch) {
      addToCart(exactMatch);
      // setSearchTerm(''); // Optional: clear search if added
    } else {
      alert(`Código ${code} no encontrado o no exacto.`);
    }
    setIsScanning(false);
  };

  // --- SEARCH & FILTER LOGIC ---
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return;

      const exactMatch = products.find(p => p.sku.toLowerCase() === term);

      if (exactMatch) {
        addToCart(exactMatch);
        setSearchTerm('');
      }
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory ? p.category_id === filterCategory : true;
    const matchesBrand = filterBrand ? p.brand === filterBrand : true;
    const matchesGender = filterGender ? p.gender === filterGender : true;

    return matchesSearch && matchesCategory && matchesBrand && matchesGender;
  });

  // --- CART LOGIC ---
  const addToCart = (product: Product) => {
    if (product.stock_level <= 0) {
      alert("Producto sin stock disponible.");
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        // Check stock limit
        if (existing.quantity >= product.stock_level) {
          alert("No hay más stock disponible para agregar.");
          return prev;
        }
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const product = products.find(p => p.id === productId);
        const newQty = item.quantity + delta;

        if (newQty < 1) return item; // Min 1
        if (product && newQty > product.stock_level) {
          alert("Stock insuficiente.");
          return item;
        }

        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  // Calculate total with item discounts
  const cartTotal = cart.reduce((sum, item) => sum + ((item.price - (item.discountPerUnit || 0)) * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const applyDiscount = (productId: string, discountAmount: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, discountPerUnit: discountAmount };
      }
      return item;
    }));
  };

  // --- CUSTOMER LOGIC ---
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    c.nit.includes(customerSearchTerm)
  );

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearchTerm(customer.name);
    setShowCustomerResults(false);
  };

  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name || !newCustomerForm.phone) {
      alert("Nombre y Teléfono son obligatorios");
      return;
    }

    const payload = {
      ...newCustomerForm,
      nit: newCustomerForm.nit || 'CF'
    };

    const result = await customerService.create(payload);
    if (result.success && result.id) {
      await loadCustomers();
      // Find the created customer in the updated list or construct it
      const newCust = { ...payload, id: result.id };
      setSelectedCustomer(newCust);
      setIsNewCustomerModalOpen(false);
      setNewCustomerForm({ name: '', nit: '', phone: '', email: '', address: '' });
    } else {
      alert("Error al crear cliente");
    }
  };

  // --- PAYMENT / CHECKOUT LOGIC ---

  const handleOpenPaymentModal = () => {
    if (cart.length === 0) return;

    if (!selectedCustomer) {
      alert("Debe seleccionar un cliente registrado para continuar. Por favor regístrelo si es nuevo.");
      return;
    }

    // Reset Modal State
    setSelectedPaymentType(null);
    setPaymentEntries([]);
    setPendingAmount('');
    setIsPaymentModalOpen(true);
  };

  // Split Payment Calculations
  const totalPaid = paymentEntries.reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = Math.max(0, cartTotal - totalPaid);

  const handleAddPaymentEntry = (methodId: string) => {
    const method = paymentMethods.find(m => m.id === methodId);
    if (!method) return;

    // Use user input if available, otherwise default to full remaining balance
    let amountToAdd = pendingAmount ? parseFloat(pendingAmount) : remainingBalance;

    if (isNaN(amountToAdd) || amountToAdd <= 0) {
      amountToAdd = remainingBalance;
    }

    if (amountToAdd > remainingBalance + 0.01) { // Tolerance for float math
      alert("El monto excede el saldo restante.");
      return;
    }

    setPaymentEntries(prev => [
      ...prev,
      {
        methodId: method.id,
        methodName: method.name,
        type: method.type,
        amount: amountToAdd
      }
    ]);

    // Reset UI for next entry
    setSelectedPaymentType(null);
    setPendingAmount('');
  };

  const handleRemovePaymentEntry = (index: number) => {
    setPaymentEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinalizeSale = async () => {
    if (remainingBalance > 0.01) {
      alert("Aún queda saldo pendiente por cobrar.");
      return;
    }

    setProcessing(true);
    const finalCustomerName = selectedCustomer ? selectedCustomer.name : customerSearchTerm;

    try {
      // Send array of payments
      const result = await salesService.createSale(
        user.id,
        finalCustomerName,
        cart,
        paymentEntries,
        selectedCustomer?.id
      );

      if (result.success) {
        if (window.confirm(`Cobro registrado correctamente. Ticket: ${result.saleId || result.saleNumber}\n¿Desea imprimir el ticket?`)) {
          generateTicket(result.saleId || result.saleNumber || '', finalCustomerName, cart, paymentEntries);
        }

        // Reset everything
        setCart([]);
        setSelectedCustomer(null);
        setCustomerSearchTerm('');
        setAiMessage('');
        setIsPaymentModalOpen(false);
        setSelectedPaymentType(null);
        setPaymentEntries([]);
        setActiveTab('CATALOG');

        const prods = await productService.getAll();
        setProducts(prods);
      }
    } catch (e) {
      console.error(e);
      alert("Error al procesar la venta.");
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (cart.length > 0 && (selectedCustomer || customerSearchTerm.length > 3)) {
      const name = selectedCustomer ? selectedCustomer.name : customerSearchTerm;
      const timer = setTimeout(async () => {
        const msg = await geminiService.generateWhatsAppPitch(cart, name);
        setAiMessage(msg);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [cart, selectedCustomer, customerSearchTerm]);

  // Helper for Payment Modal Steps
  const renderPaymentContent = () => {
    // SCENARIO: Sale Fully Paid
    if (remainingBalance <= 0.01 && paymentEntries.length > 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Pago Completo</h3>
          <p className="text-gray-500 mb-6">El saldo ha sido cubierto.</p>
          <button
            onClick={handleFinalizeSale}
            disabled={processing}
            className="w-full bg-brand-primary hover:bg-brand-secondary text-white py-4 rounded-xl text-lg font-bold shadow-lg shadow-brand-primary/30 transition-all"
          >
            {processing ? 'Procesando...' : 'FINALIZAR VENTA'}
          </button>
        </div>
      );
    }

    // SCENARIO: Adding Payments
    if (!selectedPaymentType) {
      // Step 1: Select Type
      const types: { id: PaymentMethodType, label: string, Icon: React.FC<any>, color: string }[] = [
        { id: 'CASH', label: 'Efectivo', Icon: PaymentIcons.Cash, color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
        { id: 'CARD', label: 'Tarjeta (POS)', Icon: PaymentIcons.Card, color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
        { id: 'TRANSFER', label: 'Transferencia', Icon: PaymentIcons.Transfer, color: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
      ];

      return (
        <div className="grid grid-cols-2 gap-3 p-1">
          {types.map((t) => {
            // Only show types that actually have active methods configured
            const count = paymentMethods.filter(pm => pm.type === t.id).length;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedPaymentType(t.id)}
                disabled={count === 0}
                className={`
                   flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-95
                   ${t.color}
                   ${count === 0 ? 'opacity-40 grayscale cursor-not-allowed' : ''}
                 `}
              >
                <t.Icon />
                <span className="font-bold text-sm text-center mt-2">{t.label}</span>
                {count === 0 && <span className="text-[10px] mt-1">(Sin configurar)</span>}
              </button>
            );
          })}
        </div>
      );
    } else {
      // Step 2: Select Specific Method & Confirm Amount
      const filteredMethods = paymentMethods.filter(pm => pm.type === selectedPaymentType);

      return (
        <div className="flex flex-col h-full animate-fade-in-right">
          <button
            onClick={() => setSelectedPaymentType(null)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-primary mb-4 font-bold"
          >
            <PaymentIcons.Back />
            Volver a Tipos
          </button>

          {/* Amount Input Override */}
          <div className="mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
            <label className="block text-xs font-bold text-yellow-700 mb-1">Monto a abonar con este método:</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-bold">$</span>
              <input
                type="number"
                autoFocus
                value={pendingAmount}
                placeholder={remainingBalance.toFixed(2)}
                onChange={(e) => setPendingAmount(e.target.value)}
                className="w-full bg-transparent text-lg font-bold text-gray-800 outline-none placeholder-gray-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto p-1">
            {filteredMethods.map(pm => (
              <button
                key={pm.id}
                onClick={() => handleAddPaymentEntry(pm.id)}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white hover:bg-violet-50 hover:border-violet-200 transition-all shadow-sm group"
              >
                <span className="font-bold text-gray-800 text-left">{pm.name}</span>
                <span className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-brand-primary group-hover:text-white flex items-center justify-center transition-colors">
                  <PaymentIcons.ChevronRight />
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] relative">

      {/* MOBILE TABS SWITCHER */}
      <div className="lg:hidden flex bg-white/40 p-1 rounded-xl mb-4 backdrop-blur-md border border-white/40">
        <button
          onClick={() => setActiveTab('CATALOG')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'CATALOG' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500'}`}
        >
          Catálogo
        </button>
        <button
          onClick={() => setActiveTab('CART')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all relative ${activeTab === 'CART' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500'}`}
        >
          Orden Actual
          {cartItemCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          )}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">

        {/* LEFT: Product Catalog */}
        <div className={`
          flex-col gap-4 h-full
          lg:w-2/3 lg:flex
          ${activeTab === 'CATALOG' ? 'flex' : 'hidden'}
        `}>
          {/* SEARCH & FILTERS CONTAINER */}
          <GlassCard className="p-4 flex flex-col gap-3 sticky top-0 z-30 bg-white/30 backdrop-blur-xl shrink-0">
            {/* Search Row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                </div>
                <input
                  type="text"
                  placeholder="Escanear SKU o Buscar..."
                  className="w-full pl-10 pr-12 px-4 py-2.5 rounded-xl bg-white/60 border-none focus:ring-2 focus:ring-brand-primary outline-none transition-shadow shadow-sm font-medium"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  autoFocus
                />
                <button
                  onClick={() => setIsScanning(true)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors shadow-md"
                  title="Abrir Escáner"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5v14" /><path d="M8 5v14" /><path d="M12 5v14" /><path d="M17 5v14" /><path d="M21 5v14" /></svg>
                </button>
              </div>

              {/* Mobile Filter Toggle */}
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={`
                     lg:hidden
                     px-3 rounded-xl flex items-center justify-center transition-all shadow-sm border
                     ${showMobileFilters || activeFiltersCount > 0
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white/60 text-gray-600 border-white/40 hover:bg-white/80'}
                  `}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                {activeFiltersCount > 0 && (
                  <span className="ml-1 text-[10px] font-bold bg-white text-brand-primary rounded-full w-5 h-5 flex items-center justify-center">{activeFiltersCount}</span>
                )}
              </button>
            </div>

            {/* Filters Row - Responsive Container */}
            <div className={`
               w-full transition-all duration-300 ease-in-out relative z-50
               lg:flex lg:flex-row lg:items-center lg:gap-2 lg:opacity-100 lg:h-auto lg:visible
               ${showMobileFilters
                ? 'grid grid-cols-2 gap-2 mt-2 opacity-100 visible'
                : 'hidden h-0 opacity-0 lg:flex'}
            `}>
              {/* Click Outside Handler Layer (Invisible) */}
              {activeDropdown && (
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveDropdown(null)} />
              )}

              <CustomDropdown
                className="w-full"
                label="Todas Categorías"
                value={filterCategory}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
                isOpen={activeDropdown === 'CATEGORY'}
                onToggle={() => setActiveDropdown(activeDropdown === 'CATEGORY' ? null : 'CATEGORY')}
                onSelect={(val) => { setFilterCategory(val); setActiveDropdown(null); }}
              />

              <CustomDropdown
                className="w-full"
                label="Todas Marcas"
                value={filterBrand}
                options={uniqueBrands.map(b => ({ value: b, label: b }))}
                isOpen={activeDropdown === 'BRAND'}
                onToggle={() => setActiveDropdown(activeDropdown === 'BRAND' ? null : 'BRAND')}
                onSelect={(val) => { setFilterBrand(val); setActiveDropdown(null); }}
              />

              <CustomDropdown
                className="w-full col-span-2 lg:col-span-1"
                label="Todo Sexo"
                value={filterGender}
                options={[
                  { value: 'MUJER', label: 'Mujer' },
                  { value: 'HOMBRE', label: 'Hombre' },
                  { value: 'UNISEX', label: 'Unisex' },
                  { value: 'NIÑA', label: 'Niña' },
                  { value: 'NIÑO', label: 'Niño' },
                ]}
                isOpen={activeDropdown === 'GENDER'}
                onToggle={() => setActiveDropdown(activeDropdown === 'GENDER' ? null : 'GENDER')}
                onSelect={(val) => { setFilterGender(val); setActiveDropdown(null); }}
              />

              {/* Reset Filters Pill */}
              {(filterCategory || filterBrand || filterGender || searchTerm) && (
                <button
                  onClick={() => {
                    setFilterCategory('');
                    setFilterBrand('');
                    setFilterGender('');
                    setSearchTerm('');
                    setShowMobileFilters(false);
                  }}
                  className="col-span-2 lg:col-span-1 px-4 py-2 rounded-full bg-red-100/80 border border-red-200 text-red-600 text-xs font-bold hover:bg-red-200 transition-all whitespace-nowrap shadow-sm backdrop-blur-sm z-30"
                >
                  ✕ Limpiar
                </button>
              )}
            </div>
          </GlassCard>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto pr-2 pb-24 lg:pb-0 scrollbar-hide z-0">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 opacity-60">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <p className="text-sm">No se encontraron productos con estos filtros.</p>
              </div>
            ) : (
              filteredProducts.map(product => (
                <GlassCard key={product.id} className="p-0 overflow-hidden flex flex-col h-full hover:shadow-xl transition-shadow group relative min-h-[220px]">
                  <div className="h-32 bg-gray-200 relative overflow-hidden">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className={`absolute top-2 right-2 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-md ${product.stock_level <= product.min_stock ? 'bg-red-500/80' : 'bg-black/50'}`}>
                      Stock: {product.stock_level}
                    </div>
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <h4 className="font-bold text-gray-800 text-sm mb-1 leading-tight line-clamp-2">{product.name}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1 rounded">{product.sku}</span>
                      {product.size && <span className="text-[9px] font-bold text-gray-600 border border-gray-200 px-1 rounded">{product.size}</span>}
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-bold text-brand-primary">${product.price.toFixed(2)}</span>
                      <button
                        onClick={() => addToCart(product)}
                        className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center hover:bg-brand-secondary transition-colors shadow-lg shadow-brand-primary/30 active:scale-90"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </GlassCard>
              ))
            )}
          </div>

          {/* MOBILE FLOATING CART SUMMARY (Only visible in Catalog tab on Mobile) */}
          {cart.length > 0 && activeTab === 'CATALOG' && (
            <div className="lg:hidden absolute bottom-4 left-0 right-0 z-30 animate-fade-in-up px-2">
              <button
                onClick={() => setActiveTab('CART')}
                className="w-full bg-gray-900/90 backdrop-blur-md text-white p-4 rounded-xl shadow-2xl flex justify-between items-center border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-brand-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs">
                    {cartItemCount}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-gray-400">Total Estimado</span>
                    <span className="font-bold text-lg">${cartTotal.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-bold text-sm">
                  Ver Orden <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Cart & Checkout */}
        <div className={`
          lg:w-1/3 flex-col h-full
          ${activeTab === 'CART' ? 'flex' : 'hidden lg:flex'}
        `}>
          <GlassCard className="flex-1 flex flex-col bg-white/50 border-white/60 shadow-2xl overflow-hidden">
            <div className="border-b border-gray-200 pb-4 mb-4 z-20 relative shrink-0">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg text-gray-800">Orden Actual</h3>
                {/* Mobile Back Button */}
                <button
                  onClick={() => setActiveTab('CATALOG')}
                  className="lg:hidden text-xs font-bold text-brand-primary bg-brand-primary/10 px-3 py-1 rounded-full"
                >
                  + Agregar Items
                </button>
              </div>

              <div className="mt-4 relative">
                <label className="text-xs font-semibold text-gray-600 uppercase flex justify-between">
                  <span>Selecciona Cliente</span>
                  {selectedCustomer && <span className="text-green-600 font-bold">✓ Registrado</span>}
                </label>

                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Buscar Cliente..."
                      value={customerSearchTerm}
                      onChange={e => {
                        setCustomerSearchTerm(e.target.value);
                        setSelectedCustomer(null);
                        setShowCustomerResults(true);
                      }}
                      onFocus={() => setShowCustomerResults(true)}
                      className="w-full px-3 py-2 bg-white/60 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary text-sm"
                    />
                    {/* Autocomplete Dropdown */}
                    {showCustomerResults && !selectedCustomer && (
                      <>
                        {/* Overlay to close on click outside */}
                        <div className="fixed inset-0 z-20" onClick={() => setShowCustomerResults(false)} />

                        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-xl shadow-2xl p-1 animate-fade-in-down z-30 overflow-hidden">
                          <div className="max-h-60 overflow-y-auto scrollbar-thin">
                            {filteredCustomers.length > 0 ? (
                              filteredCustomers.map(c => (
                                <div
                                  key={c.id}
                                  onClick={() => handleSelectCustomer(c)}
                                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex flex-col cursor-pointer group hover:bg-violet-50"
                                >
                                  <div className="font-bold text-gray-700 group-hover:text-brand-primary transition-colors">{c.name}</div>
                                  <div className="text-xs text-gray-400 group-hover:text-violet-400 font-mono">Tel: {c.phone || 'S/T'}</div>
                                </div>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-xs text-gray-500 italic text-center">
                                No encontrado. Use (+) para crear.
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setIsNewCustomerModalOpen(true)}
                    className="bg-brand-primary text-white rounded-lg w-10 flex items-center justify-center hover:bg-brand-secondary transition-colors"
                    title="Registrar Nuevo Cliente"
                  >
                    +
                  </button>
                </div>
                {selectedCustomer && (
                  <div className="text-[10px] text-gray-500 mt-1 ml-1">Tel: {selectedCustomer.phone || 'S/T'}</div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1" onClick={() => setShowCustomerResults(false)}>
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                  <span className="text-4xl mb-2">🛒</span>
                  <p className="text-sm">Escanee un producto</p>
                  <button onClick={() => setActiveTab('CATALOG')} className="mt-4 lg:hidden text-brand-primary font-bold text-sm underline">Ir al Catálogo</button>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-white/40 p-2 rounded-lg border border-white/50">
                    <div className="w-12 h-12 bg-gray-200 rounded-md overflow-hidden flex-shrink-0">
                      <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>

                      {/* Price & Discount UI */}
                      <div className="flex flex-col">
                        <p className="text-xs text-gray-500">
                          {item.discountPerUnit ? (
                            <>
                              <span className="line-through text-gray-400 mr-1">${item.price.toFixed(2)}</span>
                              <span className="text-green-600 font-bold">${(item.price - item.discountPerUnit).toFixed(2)}</span>
                            </>
                          ) : (
                            <>${item.price.toFixed(2)} unit.</>
                          )}
                        </p>

                        {/* Discount Input */}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-gray-400">Desc: $</span>
                          <input
                            type="number"
                            min="0"
                            max={item.price}
                            className="w-12 text-[10px] border border-gray-200 rounded px-1 py-0.5 focus:border-brand-primary outline-none"
                            placeholder="0.00"
                            value={item.discountPerUnit || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0 && val <= item.price) {
                                applyDiscount(item.id, val);
                              } else if (e.target.value === '') {
                                applyDiscount(item.id, 0);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 flex items-center justify-center font-bold">-</button>
                      <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 flex items-center justify-center font-bold">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 ml-1">×</button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4 space-y-3 shrink-0">
              <div className="flex justify-between items-center text-xl font-bold text-gray-800">
                <span>Total</span>
                <div className="text-right">
                  {cart.some(i => (i.discountPerUnit || 0) > 0) && (
                    <div className="text-xs text-gray-400 font-normal line-through mb-[-4px]">
                      ${cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                    </div>
                  )}
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleOpenPaymentModal}
                disabled={processing || cart.length === 0}
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white py-4 rounded-xl text-lg font-bold transition-all shadow-xl shadow-brand-primary/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 mb-20 md:mb-0" // mb-20 for mobile nav safety
              >
                <span>PROCESAR COBRO</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-lg bg-white border-white shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {selectedPaymentType ? 'Seleccione Cuenta / Canal' : 'Cobro y Pagos'}
                </h3>
                <p className="text-sm text-gray-500">Cliente: {selectedCustomer ? selectedCustomer.name : customerSearchTerm}</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600"><PaymentIcons.Back /></button>
            </div>

            {/* Added Payments List (Split Payment Logic) */}
            <div className="mb-4 bg-gray-50 rounded-xl p-3 shrink-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase">Monto Total</span>
                <span className="text-lg font-black text-gray-800">${cartTotal.toFixed(2)}</span>
              </div>

              {/* List of Applied Payments */}
              {paymentEntries.length > 0 && (
                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                  {paymentEntries.map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-gray-200">
                      <div className="flex items-center gap-2">
                        {entry.type === 'CASH' && <PaymentIcons.Cash />}
                        {/* Simple Dot for others for brevity in list */}
                        {(entry.type !== 'CASH') && <div className="w-2 h-2 rounded-full bg-brand-primary"></div>}
                        <span className="font-medium text-gray-700">{entry.methodName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">${entry.amount.toFixed(2)}</span>
                        <button onClick={() => handleRemovePaymentEntry(idx)} className="text-red-400 hover:text-red-600"><PaymentIcons.Trash /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={`flex justify-between items-center pt-2 border-t ${remainingBalance > 0 ? 'border-gray-200 text-red-600' : 'border-green-200 text-green-600'}`}>
                <span className="text-xs font-bold uppercase">Saldo Restante</span>
                <span className="text-xl font-black">${remainingBalance.toFixed(2)}</span>
              </div>
            </div>

            {/* Main Selection Area */}
            <div className="flex-1 overflow-y-auto">
              {renderPaymentContent()}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Quick Customer Create Modal */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-sm bg-white border-white shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Registro Rápido</h3>
              <button onClick={() => setIsNewCustomerModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleQuickCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nombre Completo *</label>
                <input
                  required
                  value={newCustomerForm.name}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                  autoFocus
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Teléfono *</label>
                  <input
                    required
                    type="tel"
                    value={newCustomerForm.phone}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                    placeholder="Obligatorio"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Cedula / ID</label>
                  <input
                    value={newCustomerForm.nit}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, nit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                    placeholder="Opcional (CF)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={newCustomerForm.email}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Dirección</label>
                <textarea
                  rows={2}
                  value={newCustomerForm.address}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 rounded-lg mt-2 transition-all shadow-md"
              >
                Guardar y Seleccionar
              </button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* SCANNER MODAL OVERLAY */}

      <ScannerModal
        isOpen={isScanning}
        onClose={() => setIsScanning(false)}
        onScan={handleScanSuccess}
        title="Escáner"
      />
    </div>
  );
};

// --- CUSTOM GLASS DROPDOWN COMPONENT ---
interface CustomDropdownProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (val: string) => void;
  className?: string; // Support for custom width
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ label, value, options, isOpen, onToggle, onSelect, className = '' }) => {
  const selectedLabel = value ? options.find(o => o.value === value)?.label : label;
  const isActive = value !== '';

  return (
    <div className={`relative ${isOpen ? 'z-[70]' : 'z-40'} ${className}`}>
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm backdrop-blur-md whitespace-nowrap justify-between
          ${isActive
            ? 'bg-brand-primary text-white shadow-brand-primary/30'
            : 'bg-white/40 text-gray-700 hover:bg-white/60 border border-white/40'
          }
          ${isOpen ? 'ring-2 ring-brand-primary/50 bg-white/80' : ''}
        `}
      >
        <span className="truncate mr-1">{isActive ? selectedLabel : label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white/90 backdrop-blur-xl border border-white rounded-xl shadow-2xl p-1 animate-fade-in-down z-[60] overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            <button
              onClick={() => onSelect('')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors mb-1 ${!value ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              {label} (Todo)
            </button>
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => onSelect(opt.value)}
                className={`
                     w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex justify-between items-center group
                     ${value === opt.value
                    ? 'bg-brand-primary text-white font-bold shadow-md'
                    : 'text-gray-700 hover:bg-violet-50 hover:text-brand-primary font-medium'
                  }
                  `}
              >
                <span className="truncate">{opt.label}</span>
                {value === opt.value && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
