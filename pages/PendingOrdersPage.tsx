import React, { useState, useEffect } from 'react';
import { orderService, salesService, paymentMethodService, customerService } from '../services/supabaseService';
import { Order, CartItem, User, PaymentMethod } from '../types';
import { GlassCard } from '../components/GlassCard';

interface PendingOrdersPageProps {
    user: User;
}

export const PendingOrdersPage: React.FC<PendingOrdersPageProps> = ({ user }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Process Modal State
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadOrders();
        loadPaymentMethods();
    }, []);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const data = await orderService.getAll();
            console.log('All Orders Fetched:', data);
            const pending = data.filter(o => o.status === 'PENDING');
            console.log('Pending Orders:', pending);
            setOrders(pending);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadPaymentMethods = async () => {
        const methods = await paymentMethodService.getAll(true);
        setPaymentMethods(methods);
        if (methods.length > 0) setSelectedMethodId(methods[0].id);
    };

    const handleOpenProcess = (order: Order) => {
        setSelectedOrder(order);
        setIsProcessModalOpen(true);
    };

    const handleProcessOrder = async () => {
        if (!selectedOrder || !selectedMethodId) return;

        setProcessing(true);
        try {
            const method = paymentMethods.find(m => m.id === selectedMethodId);
            if (!method) throw new Error("Método de pago inválido");

            // 1. Get or Create Customer
            // Strategy: Check if customer name exists? No, too risky.
            // Just create a new customer record for this order to ensure name and address are preserved.
            // Or ideally, prompts user to select a customer? But for now, auto-create to fix "Consumidor Final" issue.

            let finalCustomerId = undefined;
            try {
                // Determine if we should create a customer. 
                // Always create one for Web Orders so we capture their specific info.
                const newCustomerData = {
                    name: selectedOrder.customer_name,
                    address: selectedOrder.customer_address || '',
                    phone: selectedOrder.customer_phone || '', // Assuming phone might be in order future
                    notes: `Cliente Web - GPS: ${selectedOrder.customer_gps || 'N/A'}`
                };

                // Simple check to avoid duplicates if possible? 
                // For now, let's create new to be safe and ensure data linkage.
                const customerResult = await customerService.create(newCustomerData);
                if (customerResult.success && customerResult.id) {
                    finalCustomerId = customerResult.id;
                }
            } catch (err) {
                console.error("Error creating customer from web order, proceeding as guest", err);
            }

            // 2. Create Sale
            const paymentEntry = {
                methodId: method.id,
                methodName: method.name,
                type: method.type,
                amount: selectedOrder.total
            };

            const result = await salesService.createSale(
                user.id,
                selectedOrder.customer_name, // Customer Name (Fallback visuals)
                selectedOrder.items,
                [paymentEntry],
                finalCustomerId // Use the newly created ID
            );

            if (result.success) {
                // 2. Update Order Status
                await orderService.updateStatus(selectedOrder.id, 'COMPLETED');

                alert("Pedido procesado y convertido a venta correctamente.");
                setIsProcessModalOpen(false);
                setSelectedOrder(null);
                loadOrders(); // Refresh status
            } else {
                alert("Error al crear la venta: " + result.error || "Desconocido");
            }

        } catch (error) {
            console.error(error);
            alert("Error al procesar pedido");
        } finally {
            setProcessing(false);
        }
    };

    const handleCancelOrder = async (order: Order) => {
        if (!window.confirm("¿Estás seguro de cancelar este pedido?")) return;

        try {
            await orderService.updateStatus(order.id, 'CANCELLED');
            loadOrders();
        } catch (error) {
            console.error(error);
            alert("Error al cancelar");
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">
                <span className="bg-orange-100 p-2 rounded-lg text-orange-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
                </span>
                Pedidos Web Pendientes
            </h1>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Cargando pedidos...</div>
            ) : orders.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <p className="text-gray-500 font-medium">No hay pedidos pendientes por procesar.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.map(order => (
                        <GlassCard key={order.id} className="flex flex-col relative group hover:border-brand-primary/30 transition-all">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-gray-800">{order.customer_name}</h3>
                                    <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                                </div>
                                <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                    Pendiente
                                </span>
                            </div>

                            <div className="p-4 flex-1">
                                {order.customer_address && (
                                    <div className="flex items-start gap-2 mb-2 text-xs text-gray-600">
                                        <svg className="shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                        <p>{order.customer_address}</p>
                                    </div>
                                )}

                                {order.customer_gps && (
                                    <a
                                        href={order.customer_gps.startsWith('http') ? order.customer_gps : `https://www.google.com/maps?q=${order.customer_gps}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 mb-4 text-xs text-blue-600 hover:underline bg-blue-50 p-2 rounded-lg"
                                    >
                                        <svg className="shrink-0" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" x2="9" y1="3" y2="18" /><line x1="15" x2="15" y1="6" y2="21" /></svg>
                                        Ver Ubicación GPS
                                    </a>
                                )}

                                <div className="space-y-2 mb-4">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Productos ({order.items.length})</p>
                                    <div className="space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                        {Array.isArray(order.items) && order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-xs">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-700">
                                                        <span className="font-bold">{item.quantity}x</span> {item.name}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-mono">SKU: {item.sku || 'N/A'}</span>
                                                </div>
                                                <span className="font-mono text-gray-500">${(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center text-sm font-bold pt-3 border-t border-gray-100">
                                    <span>Total</span>
                                    <span className="text-xl text-brand-primary">${order.total.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-100 bg-gray-50/30 rounded-b-2xl flex gap-2">
                                <button
                                    onClick={() => handleCancelOrder(order)}
                                    className="flex-1 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleOpenProcess(order)}
                                    className="flex-[2] py-2 text-xs font-bold text-white bg-brand-primary hover:bg-brand-secondary rounded-lg transition-colors shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    Procesar Pedido
                                </button>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            {/* Process Modal */}
            {isProcessModalOpen && selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="bg-brand-primary p-4 text-white">
                            <h3 className="font-bold text-lg">Procesar Venta</h3>
                            <p className="text-xs text-white/80">Confirma el pago para entregar el pedido</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-500">Cliente:</span>
                                    <span className="font-bold text-gray-800">{selectedOrder.customer_name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Total a Cobrar:</span>
                                    <span className="font-black text-lg text-brand-primary">${selectedOrder.total.toFixed(2)}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-2">Método de Pago</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {paymentMethods.map(method => (
                                        <button
                                            key={method.id}
                                            onClick={() => setSelectedMethodId(method.id)}
                                            className={`
                                                p-3 rounded-xl border text-sm font-bold transition-all
                                                ${selectedMethodId === method.id
                                                    ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                                            `}
                                        >
                                            {method.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setIsProcessModalOpen(false)}
                                className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleProcessOrder}
                                disabled={processing}
                                className="flex-[2] py-3 bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:bg-green-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {processing ? 'Procesando...' : 'Confirmar Entrega'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
