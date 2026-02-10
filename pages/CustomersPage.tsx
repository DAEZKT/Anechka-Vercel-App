
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { customerService } from '../services/supabaseService';
import { Customer } from '../types';

export const CustomersPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
    const data = await customerService.getAll();
    setCustomers(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert("Nombre Completo y Teléfono son obligatorios");
      return;
    }

    setLoading(true);
    // If NIT is empty, we can default to 'CF' or let backend handle it. 
    // Assuming backend accepts empty string or we default to CF here.
    const payload = {
      ...formData,
      nit: formData.nit || 'CF'
    };

    await customerService.create(payload);
    setFormData({ name: '', nit: '', phone: '', email: '', address: '' });
    setShowModal(false);
    await refreshCustomers();
    setLoading(false);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.nit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Responsivo: Stack en móvil, Row en Desktop */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Cartera de Clientes</h2>
          <p className="text-sm text-gray-500">Gestión de relaciones y datos de facturación.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full md:w-auto bg-brand-primary hover:bg-brand-secondary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand-primary/20 transition-all flex items-center justify-center gap-2"
        >
          <span className="text-xl leading-none">+</span> Nuevo Cliente
        </button>
      </header>

      {/* Search Bar */}
      <GlassCard className="py-3 px-4 flex gap-4 items-center bg-white/40">
        <div className="text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
        <input
          type="text"
          placeholder="Buscar por Nombre o NIT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none focus:outline-none text-sm font-medium"
        />
      </GlassCard>

      {/* Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/50 text-gray-500 font-semibold border-b border-gray-200">
              <tr>
                {/* Min-width añadido para forzar el ancho y evitar wrap */}
                <th className="py-3 px-4 min-w-[160px]">Nombre Completo</th>
                <th className="py-3 px-4 min-w-[100px]">NIT / ID</th>
                <th className="py-3 px-4 min-w-[140px]">Contacto</th>
                <th className="py-3 px-4 min-w-[150px]">Dirección</th>
                <th className="py-3 px-4 text-center min-w-[100px]">Registrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No se encontraron clientes.</td></tr>
              ) : (
                filteredCustomers.map(cust => (
                  <tr key={cust.id} className="hover:bg-white/40 transition-colors">
                    {/* Letra más pequeña en móvil (text-xs) normal en desktop (sm:text-sm) */}
                    <td className="py-3 px-4 font-bold text-gray-800 text-xs sm:text-sm whitespace-normal max-w-[200px]">
                      {cust.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600 text-xs sm:text-sm">{cust.nit}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col text-xs">
                        {cust.phone && <span className="flex items-center gap-1 font-medium">📞 {cust.phone}</span>}
                        {cust.email && <span className="flex items-center gap-1 text-brand-primary truncate max-w-[140px]">✉️ {cust.email}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 truncate max-w-[200px] text-xs">{cust.address || '-'}</td>
                    <td className="py-3 px-4 text-center text-xs text-gray-500">
                      {new Date(cust.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-md bg-white border-white shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">Registrar Cliente</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-2">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nombre Completo *</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Cedula / Licencia / Pasaporte</label>
                <input
                  value={formData.nit}
                  onChange={e => setFormData({ ...formData, nit: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                  placeholder="Número"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Teléfono *</label>
                  <input
                    required
                    type="tel"
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
                <label className="block text-xs font-bold text-gray-500 mb-1">Dirección</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3.5 rounded-xl mt-4 transition-all shadow-lg shadow-brand-primary/20"
              >
                {loading ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
