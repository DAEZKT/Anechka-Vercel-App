
import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '../components/GlassCard';
import { customerService, salesService } from '../services/supabaseService';
import { Customer, SaleHeader } from '../types';

// Standard SVG Icons for a cleaner look
const Icons = {
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>,
  User: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  Phone: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  Mail: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>,
  MapPin: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>,
  Edit: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>,
  Badge: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.74Z" /></svg>,
  Star: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  Trophy: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
};

export const CustomersPage = () => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYSIS'>('LIST');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<SaleHeader[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    nit: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    refreshCustomers();
  }, []);

  const refreshCustomers = async () => {
    setLoading(true);
    const [custData, salesData] = await Promise.all([
      customerService.getAll(),
      salesService.getSalesHistory()
    ]);
    setCustomers(custData);
    setSales(salesData);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ name: '', nit: '', phone: '', email: '', address: '' });
    setEditingId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setFormData({
      name: c.name,
      nit: c.nit || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || ''
    });
    setEditingId(c.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert("Nombre Completo y Teléfono son obligatorios");
      return;
    }

    setLoading(true);
    const payload = {
      ...formData,
      nit: formData.nit || 'CF'
    };

    if (editingId) {
      // UPDATE
      const result = await customerService.update(editingId, {
        ...payload,
        updated_at: new Date().toISOString()
      });
      if (!result.success) alert("Error al actualizar cliente");
    } else {
      // CREATE
      await customerService.create(payload);
    }

    resetForm();
    setShowModal(false);
    await refreshCustomers();
    setLoading(false);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.nit || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper for cleaner display
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // ANALYSIS LOGIC
  const customerMetrics = useMemo(() => {
    if (!customers.length) return [];

    // Map of CustomerID -> Metrics
    const metrics: Record<string, { total: number, count: number, lastDate: string }> = {};

    sales.forEach(s => {
      if (s.customer_id && s.status === 'COMPLETED') {
        if (!metrics[s.customer_id]) {
          metrics[s.customer_id] = { total: 0, count: 0, lastDate: '' };
        }
        metrics[s.customer_id].total += s.total_amount;
        metrics[s.customer_id].count += 1;
        if (s.created_at > metrics[s.customer_id].lastDate) {
          metrics[s.customer_id].lastDate = s.created_at;
        }
      }
    });

    // Merge with customers
    return customers.map(c => {
      const m = metrics[c.id] || { total: 0, count: 0, lastDate: '' };
      return {
        ...c,
        totalSpent: m.total,
        visitCount: m.count,
        lastVisit: m.lastDate,
        averageTicket: m.count ? m.total / m.count : 0
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent); // Default sort by spend
  }, [customers, sales]);

  const topSpenders = customerMetrics.filter(c => c.totalSpent > 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Responsivo */}
      {/* Header Responsivo */}
      <header className="flex flex-col xl:flex-row justify-between xl:items-end gap-6 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">Cartera de Clientes</h2>
          <p className="text-sm md:text-base text-gray-500 font-medium">Gestión de relaciones y análisis de lealtad.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-200 flex-1 sm:flex-none">
            <button
              onClick={() => setActiveTab('LIST')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-bold transition-all text-center ${activeTab === 'LIST' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
            >
              Lista
            </button>
            <button
              onClick={() => setActiveTab('ANALYSIS')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'ANALYSIS' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
            >
              <Icons.Trophy /> Top Consumo
            </button>
          </div>
          <button
            onClick={handleOpenCreate}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 transform active:scale-95"
          >
            <Icons.Plus /> <span>Nuevo Cliente</span>
          </button>
        </div>
      </header>

      {/* CONDITIONAL RENDER */}
      {activeTab === 'LIST' ? (
        <>
          {/* Search Bar only for List */}
          <GlassCard className="py-3 px-4 flex gap-4 items-center bg-white/60">
            <div className="text-gray-400">
              <Icons.Search />
            </div>
            <input
              type="text"
              placeholder="Buscar por Nombre, Razón Social o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-sm font-medium text-gray-700 placeholder-gray-400"
            />
          </GlassCard>

          {/* Table */}
          <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/50 text-gray-500 font-semibold border-b border-gray-200 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="py-4 px-6 w-16 text-center">#</th>
                    <th className="py-4 px-4">Cliente</th>
                    <th className="py-4 px-4">Identificación</th>
                    <th className="py-4 px-4">Contacto</th>
                    <th className="py-4 px-4">Ubicación</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white/40">
                  {filteredCustomers.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-gray-400 italic">No se encontraron clientes.</td></tr>
                  ) : (
                    filteredCustomers.map((cust, idx) => (
                      <tr key={cust.id} className="hover:bg-white/60 transition-colors group">
                        {/* Index / Avatar */}
                        <td className="py-4 px-6 text-center">
                          <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary font-bold flex items-center justify-center text-xs mx-auto">
                            {getInitials(cust.name)}
                          </div>
                        </td>

                        {/* Nombre */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-gray-800 text-sm">{cust.name}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <span className="opacity-70">Registrado: {new Date(cust.created_at || Date.now()).toLocaleDateString()}</span>
                          </div>
                        </td>

                        {/* ID */}
                        {/* ID */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium ${!cust.nit || cust.nit === 'CF' ? 'bg-gray-50 text-gray-400' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                            {!cust.nit || cust.nit === 'CF' ? 'sin datos' : cust.nit}
                          </span>
                        </td>

                        {/* Contacto */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1.5">
                            {cust.phone ? (
                              <div className="flex items-center gap-2 text-gray-600 text-xs">
                                <span className="text-gray-400"><Icons.Phone /></span>
                                <span className="font-medium">{cust.phone}</span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-[10px] italic pl-6">sin teléfono</span>
                            )}

                            {cust.email ? (
                              <div className="flex items-center gap-2 text-gray-500 text-xs">
                                <span className="text-gray-400"><Icons.Mail /></span>
                                <a href={`mailto:${cust.email}`} className="hover:text-brand-primary truncate max-w-[150px] transition-colors">
                                  {cust.email}
                                </a>
                              </div>
                            ) : null}
                          </div>
                        </td>

                        {/* Dirección */}
                        <td className="py-4 px-4">
                          {cust.address ? (
                            <div className="flex items-start gap-2 max-w-[180px]">
                              <span className="text-gray-400 mt-0.5"><Icons.MapPin /></span>
                              <span className="text-gray-600 text-xs whitespace-normal leading-tight">{cust.address}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-[10px] italic pl-6">sin dirección</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleOpenEdit(cust)}
                            className="text-gray-400 hover:text-brand-primary p-2 hover:bg-brand-primary/10 rounded-lg transition-all"
                            title="Editar Información"
                          >
                            <Icons.Edit />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      ) : (
        /* ANALYSIS TAB */
        <div className="space-y-6 animate-fade-in">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              </div>
              <h3 className="text-sm font-bold opacity-80 uppercase tracking-widest">Mejor Cliente (MVP)</h3>
              {topSpenders.length > 0 ? (
                <div className="mt-2">
                  <div className="text-3xl font-black">{topSpenders[0].name}</div>
                  <div className="text-sm opacity-90 font-medium">Ha comprado ${topSpenders[0].totalSpent.toLocaleString()} en {topSpenders[0].visitCount} visitas</div>
                </div>
              ) : (
                <div className="mt-2 text-xl font-bold opacity-50">Sin datos</div>
              )}
            </GlassCard>

            <GlassCard className="relative overflow-hidden">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Frecuencia Media</h3>
              {topSpenders.length > 0 ? (
                <div className="mt-2 text-3xl font-black text-gray-800">
                  {(topSpenders.reduce((acc, c) => acc + c.visitCount, 0) / topSpenders.length).toFixed(1)} <span className="text-sm font-normal text-gray-400">visitas / cliente</span>
                </div>
              ) : <div className="mt-2 text-xl font-bold text-gray-300">-</div>}
            </GlassCard>

            <GlassCard className="relative overflow-hidden">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Ticket Promedio Global</h3>
              {topSpenders.length > 0 ? (
                <div className="mt-2 text-3xl font-black text-emerald-600">
                  ${(topSpenders.reduce((acc, c) => acc + c.totalSpent, 0) / topSpenders.reduce((acc, c) => acc + c.visitCount, 0)).toFixed(2)}
                </div>
              ) : <div className="mt-2 text-xl font-bold text-gray-300">-</div>}
            </GlassCard>
          </div>

          {/* Ranking Table */}
          <GlassCard className="overflow-hidden p-0">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Icons.Trophy /> Ranking de Lealtad
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-gray-400 font-semibold border-b border-gray-100 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6 text-center w-16">Rank</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4 text-right">Compras Totales</th>
                    <th className="py-3 px-4 text-center">Frecuencia</th>
                    <th className="py-3 px-4 text-right">Ticket Prom.</th>
                    <th className="py-3 px-4 text-right">Última Visita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topSpenders.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400">No hay historial de compras.</td></tr>
                  ) : (
                    topSpenders.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3 px-6 text-center font-bold text-gray-500">
                          {idx === 0 && <span className="text-xl">🥇</span>}
                          {idx === 1 && <span className="text-xl">🥈</span>}
                          {idx === 2 && <span className="text-xl">🥉</span>}
                          {idx > 2 && `#${idx + 1}`}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-800">{c.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{c.nit || 'CF'}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                            ${c.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-medium text-gray-700">{c.visitCount}</span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          ${c.averageTicket.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-500 text-xs">
                          {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Search Bar */}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setShowModal(false)}>
          <GlassCard className="w-full max-w-lg bg-white border-white shadow-2xl overflow-y-auto max-h-[90vh] p-0" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-brand-primary flex items-center gap-2">
                <Icons.User /> {editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">NOMBRE COMPLETO <span className="text-red-400">*</span></label>
                  <input
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">IDENTIFICACIÓN (NIT / DPI)</label>
                  <input
                    value={formData.nit}
                    onChange={e => setFormData({ ...formData, nit: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all font-mono text-sm"
                    placeholder="CF / Número"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">TELÉFONO <span className="text-red-400">*</span></label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all"
                    placeholder="Ej. 5555-1234"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">CORREO ELECTRÓNICO</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all"
                    placeholder="ejemplo@correo.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">DIRECCIÓN FÍSICA</label>
                  <textarea
                    rows={2}
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all resize-none"
                    placeholder="Calle, Zona, Ciudad..."
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 group"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Icons.User />
                      {editingId ? 'Guardar Cambios' : 'Registrar Cliente'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
