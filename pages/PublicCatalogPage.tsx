
import React, { useState, useEffect } from 'react';
import { productService, categoryService, orderService, brandService } from '../services/supabaseService';
import { Product, Category, CartItem, Brand } from '../types';
import { GlassCard } from '../components/GlassCard';
import { Captcha } from '../components/Captcha';

// Icons need to be redefined here or imported if exported. Copying for self-containment or could import.
// Let's copy simple versions to avoid dependency issues if Layout isn't exporting them.
const Icons = {
    ShoppingCart: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
    ),
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
    ),
    Minus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
    ),
    Trash: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
    ),
    Search: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    ),
    Whatsapp: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" /></svg>
    )
};

export const PublicCatalogPage: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCheckoutFormOpen, setIsCheckoutFormOpen] = useState(false);

    // Customer Info State
    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerGPS, setCustomerGPS] = useState('');
    const [isCaptchaValid, setIsCaptchaValid] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const [prods, cats, brnds] = await Promise.all([
                productService.getAll(),
                categoryService.getAll(),
                brandService.getAll(true)
            ]);
            setProducts(prods.filter(p => p.stock_level > 0));
            setCategories(cats);
            setBrands(brnds);
        };
        loadData();
    }, []);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock_level) return prev;
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        // setIsCartOpen(true); // Don't auto open cart
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = item.quantity + delta;
                if (newQty < 1) return item;
                if (newQty > item.stock_level) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const handleProceedToCheckout = () => {
        if (cart.length === 0) return;
        setIsCartOpen(false);
        setIsCheckoutFormOpen(true);
        // Auto-request GPS when opening the form
        requestGPSLocation();
    };

    const handleFinalCheckout = async () => {
        if (!customerName.trim()) {
            alert('Por favor ingresa tu nombre');
            return;
        }

        if (!isCaptchaValid) {
            alert("Por favor verifica el código de seguridad (Captcha)");
            return;
        }

        // Sanitize content (basic example, Supabase and React already handle most XSS/SQLi)
        // PostgreSQL parameterization handles SQLi, but we should trim
        const cleanName = customerName.trim().replace(/[<>]/g, ""); // Basic strip tags
        const cleanAddress = customerAddress.trim().replace(/[<>]/g, "");
        const cleanGPS = customerGPS.trim().replace(/[<>]/g, "");

        const totalItems = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // 1. Save Order to Database
        try {
            await orderService.create({
                customer_name: cleanName,
                customer_address: cleanAddress,
                customer_gps: cleanGPS,
                items: cart,
                total: totalItems
            });
        } catch (error) {
            console.error("Error saving order", error);
        }

        let message = `NUEVO PEDIDO - CATÁLOGO WEB\n\n`;
        message += `CLIENTE: ${cleanName}\n`;
        if (cleanAddress) message += `DIRECCIÓN: ${cleanAddress}\n`;
        if (cleanGPS) message += `UBICACIÓN GPS: ${cleanGPS}\n`;
        message += `\nPRODUCTOS:\n`;

        let total = 0;
        cart.forEach(item => {
            const subtotal = item.price * item.quantity;
            message += `- ${item.quantity}x ${item.name} ${item.size ? `[Talla: ${item.size}]` : ''} (${item.sku}) - $${subtotal.toFixed(2)}\n`;
            total += subtotal;
        });

        message += `\nTOTAL: $${total.toFixed(2)}`;

        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/50581028407?text=${encodedMessage}`, '_blank');

        // Reset
        setCart([]);
        setCustomerName('');
        setCustomerAddress('');
        setCustomerGPS('');
        setIsCheckoutFormOpen(false);
    };

    const requestGPSLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setCustomerGPS(`https://www.google.com/maps?q=${latitude},${longitude}`);
                },
                (error) => {
                    console.log('GPS no disponible o denegado por el usuario');
                }
            );
        } else {
            console.log('Tu navegador no soporta geolocalización.');
        }
    };

    const filteredProducts = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.brand_name || p.brand).toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = selectedCategory === 'ALL' || p.category_id === selectedCategory;
        const matchBrand = selectedBrand === 'ALL' || p.brand_id === selectedBrand || (!p.brand_id && p.brand === selectedBrand); // Handle legacy text match if needed, though ID preferred
        return matchSearch && matchCategory && matchBrand;
    });

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-24">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); window.location.href = '/'; }}
                        className="text-xs text-gray-500 hover:text-brand-primary font-medium"
                    >
                        ← Volver
                    </a>
                    <div className="h-4 w-px bg-gray-200"></div>
                    <div>
                        <h1 className="font-black text-xl tracking-tighter text-brand-primary">DAEZKT</h1>
                        <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Catálogo en Línea</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    className="relative p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                    <Icons.ShoppingCart />
                    {cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                            {cartCount}
                        </span>
                    )}
                </button>
            </header>

            {/* Main Content with Container */}
            <div className="max-w-7xl mx-auto w-full">
                {/* Filters */}
                <div className="p-4 space-y-3 sticky top-[64px] z-20 bg-gray-50/95 backdrop-blur-sm shadow-sm">
                    <div className="relative max-w-lg mx-auto md:mx-0 mb-6">
                        <input
                            type="text"
                            placeholder="Buscar productos..."
                            className="w-full pl-10 pr-4 py-3 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-brand-primary/20 bg-white text-sm transition-all text-gray-700 placeholder:text-gray-400 font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <Icons.Search />
                        </div>
                    </div>

                    {/* Brand Filter - Premium Pill Design */}
                    <div className="flex gap-2 overflow-x-auto py-3 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] items-center">
                        <button
                            onClick={() => setSelectedBrand('ALL')}
                            className={`min-w-[70px] h-[40px] rounded-xl flex items-center justify-center px-3 transition-all duration-300 font-bold text-[10px] tracking-wide shadow-sm flex-shrink-0
                                ${selectedBrand === 'ALL'
                                    ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20 scale-105'
                                    : 'bg-white text-gray-500 hover:bg-white hover:text-gray-800'}`}
                        >
                            TODAS
                        </button>

                        {brands.map(brand => (
                            <button
                                key={brand.id}
                                onClick={() => setSelectedBrand(brand.id)}
                                className={`h-[40px] min-w-[70px] max-w-[120px] bg-white rounded-xl flex items-center justify-center px-3 py-1.5 transition-all duration-300 shadow-sm group border flex-shrink-0
                                    ${selectedBrand === brand.id
                                        ? 'border-brand-primary ring-2 ring-brand-primary/10 shadow-lg shadow-brand-primary/10 scale-105 z-10'
                                        : 'border-transparent hover:border-gray-100 hover:shadow-md'}`}
                                title={brand.name}
                            >
                                {brand.image_url ? (
                                    <img
                                        src={brand.image_url}
                                        alt={brand.name}
                                        className={`h-full w-auto object-contain transition-all duration-300 ${selectedBrand === brand.id ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 grayscale-0'}`}
                                    />
                                ) : (
                                    <span className={`text-[10px] font-bold uppercase truncate transition-colors ${selectedBrand === brand.id ? 'text-brand-primary' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                        {brand.name}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Category Filter - Minimal Chips */}
                    <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar mask-gradient-right">
                        <button
                            onClick={() => setSelectedCategory('ALL')}
                            className={`px-5 py-2 rounded-full text-xs font-medium transition-all duration-200 border
                                ${selectedCategory === 'ALL'
                                    ? 'bg-brand-primary text-white border-brand-primary shadow-md shadow-brand-primary/20'
                                    : 'bg-transparent text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 border
                                    ${selectedCategory === cat.id
                                        ? 'bg-brand-primary text-white border-brand-primary shadow-md shadow-brand-primary/20'
                                        : 'bg-transparent text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product Grid */}
                <div className="px-4 pb-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredProducts.map(product => (
                        <div key={product.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full border border-gray-100 group animate-fade-in-up">
                            {/* Image Container - Aspect Square for Uniformity */}
                            <div className="relative aspect-square bg-gray-50 overflow-hidden">
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                        <span className="text-[10px] mt-2 font-medium">Sin Imagen</span>
                                    </div>
                                )}

                                {/* Stock Badge */}
                                {product.stock_level > 0 && product.stock_level < 5 && (
                                    <span className="absolute top-2 right-2 bg-orange-500/90 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
                                        Quedan {product.stock_level}
                                    </span>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-3 flex-1 flex flex-col">
                                <div className="mb-2">
                                    <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-tight min-h-[2.5em]" title={product.name}>
                                        {product.name}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <p className="text-[10px] text-gray-500 truncate">{product.brand_name || product.brand || 'Genérico'}</p>
                                        {product.size && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                                                {product.size}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-auto pt-2 flex items-end justify-between border-t border-gray-50">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400 font-medium line-through decoration-gray-300 hidden">
                                            {/* Idea: Show MSRP if needed later */}
                                        </span>
                                        <span className="font-bold text-lg text-brand-primary leading-none">
                                            ${product.price.toFixed(2)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => addToCart(product)}
                                        className="w-8 h-8 rounded-full bg-gray-50 text-brand-primary border border-gray-200 flex items-center justify-center hover:bg-brand-primary hover:text-white hover:border-brand-primary hover:shadow-lg hover:shadow-brand-primary/30 active:scale-95 transition-all"
                                        title="Agregar al Carrito"
                                    >
                                        <Icons.Plus />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cart Modal / Sheet */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => setIsCartOpen(false)} />
                    <div className="bg-white rounded-t-2xl shadow-xl w-full max-h-[85vh] flex flex-col pointer-events-auto animate-slide-up relative">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-bold text-lg">Tu Pedido</h2>
                            <button onClick={() => setIsCartOpen(false)} className="text-sm text-gray-500 font-medium">Cerrar</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cart.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <Icons.ShoppingCart />
                                    <p className="mt-2 text-sm">Tu carrito está vacío</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex gap-3">
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                            {item.image_url && <img src={item.image_url} alt="" className="w-full h-full object-cover" />}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-sm text-gray-800">{item.name}</h4>
                                            <div className="flex flex-wrap gap-1 text-xs text-gray-500">
                                                <span>${item.price.toFixed(2)}</span>
                                                {item.size && <span className="text-gray-400">• Talla: {item.size}</span>}
                                            </div>
                                            <div className="flex items-center gap-3 mt-2">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Icons.Minus /></button>
                                                <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Icons.Plus /></button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col justify-between items-end">
                                            <span className="font-bold text-sm">${(item.price * item.quantity).toFixed(2)}</span>
                                            <button onClick={() => removeFromCart(item.id)} className="text-red-400 p-1"><Icons.Trash /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 safe-area-pb">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-gray-500">Total</span>
                                <span className="text-xl font-black text-brand-primary">${cartTotal.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={handleProceedToCheckout}
                                disabled={cart.length === 0}
                                className="w-full py-4 bg-brand-primary text-white font-bold rounded-xl shadow-lg shadow-brand-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                            >
                                Continuar con el Pedido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Info Form Modal */}
            {isCheckoutFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-brand-primary p-4 text-white">
                            <h2 className="font-bold text-lg">Información de Entrega</h2>
                            <p className="text-xs text-white/80 mt-1">Completa tus datos para finalizar el pedido</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-2">Nombre Completo *</label>
                                <input
                                    type="text"
                                    required
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="Ej: Juan Pérez"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-2">Dirección de Entrega</label>
                                <textarea
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                    placeholder="Ej: Zona 10, Calle Principal #123"
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-2">Ubicación GPS (Opcional)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={customerGPS}
                                        onChange={(e) => setCustomerGPS(e.target.value)}
                                        placeholder="Lat, Long o pega el link de Google Maps"
                                        className="flex-1 px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={requestGPSLocation}
                                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-sm transition-colors flex items-center justify-center"
                                        title="Obtener mi ubicación actual"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                                            <circle cx="12" cy="10" r="3"></circle>
                                        </svg>
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Ayúdanos a encontrarte más fácil</p>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Total a Pagar:</span>
                                    <span className="font-black text-xl text-brand-primary">${cartTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="block text-xs font-bold text-gray-600 mb-2">Verificación de Seguridad</label>
                                <Captcha onVerify={setIsCaptchaValid} />
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => {
                                    setIsCheckoutFormOpen(false);
                                    setIsCartOpen(true);
                                }}
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleFinalCheckout}
                                className="flex-1 py-3 bg-[#25D366] text-white font-bold rounded-xl shadow-lg shadow-green-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Icons.Whatsapp />
                                Enviar Pedido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
