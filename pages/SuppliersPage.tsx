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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return alert("El nombre es obligatorio");

        try {
            if (editingId) {
                await supplierService.update(editingId, formData);
                alert("Proveedor actualizado");
            } else {
                await supplierService.create(formData);
                alert("Proveedor creado exitosamente");
            }
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
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Proveedores</h2>
                    <p className="text-gray-500">Gestión de proveedores y acreedores.</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="bg-brand-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary transition-all flex items-center gap-2"
                >
                    <span>+</span> Nuevo Proveedor
                </button>
            </header>

            {/* Search Bar */}
            <GlassCard className="py-3 px-4 flex items-center gap-3 sticky top-0 z-10">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                    type="text"
                    placeholder="Buscar por nombre, contacto o NIT..."
                    className="bg-transparent w-full outline-none text-gray-700 placeholder-gray-400"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </GlassCard>

            {/* Contact List View - Replaces Grid */}
            <div className="space-y-3">
                {filteredSuppliers.map(sup => (
                    <div key={sup.id} className="group relative bg-white/70 backdrop-blur-md rounded-xl p-4 border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                            {/* Left: Avatar & Identity */}
                            <div className="flex items-center gap-4 min-w-[30%]">
                                <div className={`w-12 h-12 rounded-xl shrink-0 ${getAvatarColor(sup.name)} flex items-center justify-center text-white font-bold shadow-md group-hover:scale-105 transition-transform`}>
                                    {getInitials(sup.name)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 leading-tight group-hover:text-brand-primary transition-colors text-lg">{sup.name}</h3>
                                    {sup.contact_name && (
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${getAvatarColor(sup.name)}`}></span>
                                            <span className="text-sm font-medium text-gray-500">{sup.contact_name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Middle: Contact Info Chips */}
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 flex-1">
                                {sup.phone && (
                                    <div className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                        {sup.phone}
                                    </div>
                                )}
                                {sup.email && (
                                    <div className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                                        <span className="truncate max-w-[150px]">{sup.email}</span>
                                    </div>
                                )}
                                {sup.tax_id && (
                                    <div className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <span className="text-[10px] uppercase font-bold text-gray-300">NIT</span>
                                        <span className="font-mono">{sup.tax_id}</span>
                                    </div>
                                )}
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 mt-2 md:mt-0 border-gray-100 justify-end md:justify-start w-full md:w-auto min-w-[140px]">
                                {sup.phone && (
                                    <a
                                        href={`tel:${sup.phone}`}
                                        className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors flex items-center justify-center shadow-sm"
                                        title="Llamar"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                    </a>
                                )}
                                {sup.email && (
                                    <a
                                        href={`mailto:${sup.email}`}
                                        className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center shadow-sm"
                                        title="Enviar correo"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                                    </a>
                                )}

                                <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block"></div>

                                <button
                                    onClick={() => handleOpenEdit(sup)}
                                    className="p-2 text-gray-500 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors flex items-center justify-center shadow-sm"
                                    title="Editar"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                </button>
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
