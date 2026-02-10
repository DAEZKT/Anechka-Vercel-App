
import React, { useState, useEffect } from 'react';
import { productService, categoryService } from '../services/supabaseService';
import { Product, Category, CartItem } from '../types';
import { GlassCard } from '../components/GlassCard';

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
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [isCartOpen, setIsCartOpen] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const [prods, cats] = await Promise.all([
                productService.getAll(),
                categoryService.getAll()
            ]);
            // Filter only Active logic if existed? For now show all with stock > 0
            setProducts(prods.filter(p => p.stock_level > 0));
            setCategories(cats);
        };
        loadData();
    }, []);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock_level) return prev; // Max Stock Reached
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setIsCartOpen(true);
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = item.quantity + delta;
                if (newQty < 1) return item; // Handled by remove usually, but keep min 1
                if (newQty > item.stock_level) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;

        let message = `Hola, me gustaría ordenar lo siguiente desde el catálogo web:\n\n`;
        let total = 0;

        cart.forEach(item => {
            const subtotal = item.price * item.quantity;
            message += `- ${item.quantity}x ${item.name} (${item.sku}) - Q${subtotal.toFixed(2)}\n`;
            total += subtotal;
        });

        message += `\n*Total a Pagar: Q${total.toFixed(2)}*`;

        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/50581028407?text=${encodedMessage}`, '_blank');
    };

    const filteredProducts = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.brand.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = selectedCategory === 'ALL' || p.category_id === selectedCategory;
        return matchSearch && matchCategory;
    });

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-24">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
                <div>
                    <h1 className="font-black text-xl tracking-tighter text-brand-primary">ANECHKA</h1>
                    <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Catálogo en Línea</p>
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

            {/* Filters */}
            <div className="p-4 space-y-3">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Buscar productos..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-brand-primary bg-white"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Icons.Search />
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('ALL')}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === 'ALL' ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 shadow-sm'}`}
                    >
                        Todos
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === cat.id ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 shadow-sm'}`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div className="px-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                    <div key={product.id} className="bg-white rounded-xl overflow-hidden shadow-sm flex flex-col h-full animate-fade-in-up">
                        <div className="relative aspect-square bg-gray-100">
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <span className="text-xs">Sin Imagen</span>
                                </div>
                            )}
                            {product.stock_level < 5 && (
                                <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                                    ¡Solo quedan {product.stock_level}!
                                </span>
                            )}
                        </div>
                        <div className="p-3 flex-1 flex flex-col">
                            <h3 className="font-bold text-sm text-gray-900 line-clamp-2 leading-snug">{product.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">{product.brand}</p>
                            <div className="mt-auto pt-3 flex items-center justify-between">
                                <span className="font-bold text-lg text-brand-primary">Q{product.price.toFixed(2)}</span>
                                <button
                                    onClick={() => addToCart(product)}
                                    className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                                >
                                    <Icons.Plus />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
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
                                            <p className="text-xs text-gray-500">Q{item.price.toFixed(2)}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Icons.Minus /></button>
                                                <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Icons.Plus /></button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col justify-between items-end">
                                            <span className="font-bold text-sm">Q{(item.price * item.quantity).toFixed(2)}</span>
                                            <button onClick={() => removeFromCart(item.id)} className="text-red-400 p-1"><Icons.Trash /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 safe-area-pb">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-gray-500">Total</span>
                                <span className="text-xl font-black text-brand-primary">Q{cartTotal.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={handleCheckout}
                                disabled={cart.length === 0}
                                className="w-full py-4 bg-[#25D366] text-white font-bold rounded-xl shadow-lg shadow-green-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                            >
                                <span className="fill-current"><Icons.Whatsapp /></span>
                                Enviar Pedido por WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
