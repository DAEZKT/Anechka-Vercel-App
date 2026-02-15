import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { supplierService } from '../services/supabaseService';
import { Supplier } from '../types';

const getAvatarColor = (name: string) => {
    const colors = [
        'bg-blue-500', 'bg-purple-500', 'bg-emerald-500',
        'bg-orange-500', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => {
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

export const SuppliersPage: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeMenuSupplierId, setActiveMenuSupplierId] = useState<string | null>(null);

    // Form State
    const initialForm = {
        name: '',
        contact_name: '',
        phone: '',
        email: '',
        tax_id: '', // NIT
        address: '',
        notes: ''
    };
    const [formData, setFormData] = useState(initialForm);

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        setLoading(true);
        try {
            const data = await supplierService.getAll();
            setSuppliers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setFormData(initialForm);
        setEditingId(null);
        setShowModal(true);
    };

    const handleOpenEdit = (sup: Supplier) => {
        setFormData({
            name: sup.name,
            contact_name: sup.contact_name || '',
            phone: sup.phone || '',
            email: sup.email || '',
            tax_id: sup.tax_id || '',
            address: sup.address || '',
            notes: sup.notes || ''
        });
        setEditingId(sup.id);
        setShowModal(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`¿Eliminar proveedor "${name}"?`)) {
            try {
                const result = await supplierService.delete(id);
                if (result.success) {
                    loadSuppliers();
                } else {
                    alert("No se pudo eliminar el proveedor");
                }
            } catch (error) {
                console.error(error);
                alert("Error al eliminar");
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return alert("El nombre es obligatorio");

        try {
            let result;
            if (editingId) {
                result = await supplierService.update(editingId, formData);
                if (result.success) alert("Proveedor actualizado");
            } else {
                result = await supplierService.create(formData);
                if (result.success) alert("Proveedor creado exitosamente");
            }

            if (!result.success) throw new Error("Error en la operación");
            setShowModal(false);
            loadSuppliers();
        } catch (e) {
            console.error(e);
            alert("Error al guardar");
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.tax_id && s.tax_id.includes(searchTerm))
    );

    return (
        <div className="space-y-6 animate-fade-in-up">
            <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">Proveedores</h2>
                    <p className="text-sm md:text-base text-gray-500 font-medium">Gestión de proveedores y acreedores.</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="w-full md:w-auto bg-brand-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary transition-all flex items-center justify-center gap-2 transform active:scale-95"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                    Nuevo Proveedor
                </button>
            </header>

            {/* Search Bar */}
            <GlassCard className="py-2.5 px-4 flex items-center gap-3 sticky top-0 z-10 bg-white/80 backdrop-blur-md shadow-sm border-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                    type="text"
                    placeholder="Buscar por nombre, contacto o NIT..."
                    className="bg-transparent w-full outline-none text-gray-700 placeholder-gray-400"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </GlassCard>

            {/* Compact Supplier List View */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredSuppliers.map(sup => (
                    <div key={sup.id} className={`group relative bg-white/80 hover:bg-white backdrop-blur-md rounded-xl p-3 border border-gray-100 hover:border-brand-primary/30 shadow-sm hover:shadow-lg transition-all duration-300 ${activeMenuSupplierId === sup.id ? 'z-30' : ''}`}>
                        <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-lg shrink-0 ${getAvatarColor(sup.name)} flex items-center justify-center text-white text-sm font-bold shadow-sm group-hover:scale-105 transition-transform mt-1`}>
                                {getInitials(sup.name)}
                            </div>

                            {/* Main Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-gray-800 text-sm leading-tight truncate pr-6 transition-colors group-hover:text-brand-primary">{sup.name}</h3>

                                    {/* Kebab Menu Trigger - Absolute Positioned */}
                                    <div className="absolute top-2 right-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuSupplierId(activeMenuSupplierId === sup.id ? null : sup.id);
                                            }}
                                            className={`p-1.5 rounded-full transition-colors ${activeMenuSupplierId === sup.id ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-brand-primary hover:bg-gray-50'}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                        </button>

                                        {/* Dropdown Menu */}
                                        {activeMenuSupplierId === sup.id && (
                                            <>
                                                <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveMenuSupplierId(null)} />
                                                <div className="absolute right-0 top-full mt-1 z-50 bg-white/95 backdrop-blur-xl shadow-xl rounded-lg border border-gray-100 p-1 min-w-[160px] flex flex-col gap-0.5 animate-fade-in text-left origin-top-right">

                                                    {sup.phone && (
                                                        <a
                                                            href={`tel:${sup.phone}`}
                                                            onClick={() => setActiveMenuSupplierId(null)}
                                                            className="flex items-center gap-2 px-3 py-2 hover:bg-green-50 text-gray-600 hover:text-green-600 rounded-md transition-colors text-xs font-medium"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                                            Llamar
                                                        </a>
                                                    )}

                                                    {sup.email && (
                                                        <a
                                                            href={`mailto:${sup.email}`}
                                                            onClick={() => setActiveMenuSupplierId(null)}
                                                            className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-md transition-colors text-xs font-medium"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                                                            Email
                                                        </a>
                                                    )}

                                                    {(sup.phone || sup.email) && <div className="h-px bg-gray-100 my-1 mx-2"></div>}

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(sup); setActiveMenuSupplierId(null); }}
                                                        className="flex items-center gap-2 px-3 py-2 hover:bg-brand-primary/10 text-gray-600 hover:text-brand-primary rounded-md transition-colors text-xs font-medium"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                                        Editar
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(sup.id, sup.name); setActiveMenuSupplierId(null); }}
                                                        className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-gray-600 hover:text-red-500 rounded-md transition-colors text-xs font-medium"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Detailed Info */}
                                <div className="space-y-1.5 mt-1">
                                    {sup.contact_name && (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                            <span className="truncate">{sup.contact_name}</span>
                                        </div>
                                    )}

                                    {/* Badges Row */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {sup.phone && (
                                            <div className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                                {sup.phone}
                                            </div>
                                        )}
                                        {sup.email && (
                                            <div className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 max-w-full truncate">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                                                <span className="truncate max-w-[80px] sm:max-w-none">{sup.email}</span>
                                            </div>
                                        )}
                                        {sup.tax_id && (
                                            <div className="inline-flex items-center gap-1 text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                                <span className="font-bold text-[8px] uppercase text-gray-400">NIT</span>
                                                {sup.tax_id}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <GlassCard className="w-full max-w-lg bg-white border-white shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nombre Empresa / Proveedor *</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                                    placeholder="Ej. Distribuidora S.A."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Contacto Principal</label>
                                    <input
                                        value={formData.contact_name}
                                        onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                                        placeholder="Ej. Juan Pérez"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">NIT / Tax ID</label>
                                    <input
                                        value={formData.tax_id}
                                        onChange={e => setFormData({ ...formData, tax_id: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                                        placeholder="Ej. 654321-K"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Teléfono</label>
                                    <input
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Dirección / Notas</label>
                                <textarea
                                    rows={2}
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none resize-none"
                                    placeholder="Dirección física..."
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3.5 rounded-xl mt-4 transition-all shadow-lg shadow-brand-primary/20"
                            >
                                {editingId ? 'Actualizar' : 'Guardar Proveedor'}
                            </button>
                        </form>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};
