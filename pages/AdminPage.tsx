
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { paymentMethodService, auditLogService } from '../services/supabaseService';
import { PaymentMethod, PaymentMethodType } from '../types';

// Chevron Icon for Custom Select
const ChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);

export const AdminPage = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'AUDIT'>('PAYMENTS');

  // Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PaymentMethodType>('CARD');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeMenuMethodId, setActiveMenuMethodId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'PAYMENTS') {
        const data = await paymentMethodService.getAll();
        setMethods(data);
      } else {
        const logs = await auditLogService.getAll();
        setAuditLogs(logs);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
      alert('Error al cargar datos administrativos.');
    }
    setLoading(false);
  };

  const handleToggle = async (id: string) => {
    const result = await paymentMethodService.toggleActive(id);
    if (result.success) {
      loadData();
    } else {
      alert('Error al cambiar el estado.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar este método de pago? Esta acción no se puede deshacer.')) {
      const result = await paymentMethodService.delete(id);
      if (result.success) {
        loadData();
      } else {
        alert('Error al eliminar. Verifique que no esté en uso.');
      }
    }
  };

  const handleEdit = (method: PaymentMethod) => {
    setEditingId(method.id);
    setNewName(method.name);
    setNewType(method.type);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewName('');
    setNewType('CARD');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    setLoading(true);
    if (editingId) {
      // UPDATE
      const result = await paymentMethodService.update(editingId, {
        name: newName,
        type: newType
      });
      if (result.success) {
        alert('Método actualizado correctamente.');
        handleCancelEdit();
        loadData();
      } else {
        alert('Error al actualizar método.');
      }
    } else {
      // CREATE
      const result = await paymentMethodService.create({
        name: newName,
        type: newType,
        is_active: true
      });

      if (result.success) {
        setNewName('');
        setNewType('CARD');
        loadData();
      } else {
        alert('Error al crear el método de pago.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-gray-800">Control Interno / Auditoría</h2>
        <p className="text-gray-500">Configuración del sistema y registro de acciones críticas.</p>
      </header>

      {/* TABS */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'PAYMENTS' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
          Métodos de Pago
        </button>
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'AUDIT' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
          Logs de Auditoría
        </button>
      </div>

      {activeTab === 'PAYMENTS' && (

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="md:col-span-1">
            <GlassCard className="sticky top-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-brand-primary">
                  {editingId ? 'Editar Método' : 'Agregar Método'}
                </h3>
                {editingId && (
                  <button
                    onClick={handleCancelEdit}
                    className="text-gray-400 hover:text-gray-600 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre Descriptivo</label>
                  <input
                    type="text"
                    placeholder="Ej. POS BAC Credomatic"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/60 border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de Transacción</label>
                  <div className="relative">
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value as PaymentMethodType)}
                      className="w-full px-4 py-2 pr-10 rounded-lg bg-white/60 border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm appearance-none"
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="CARD">Tarjeta (POS)</option>
                      <option value="TRANSFER">Transferencia Bancaria</option>
                      <option value="OTHER">Otro</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <ChevronDown />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 rounded-lg transition-colors shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                >
                  {loading ? 'Procesando...' : editingId ? 'Guardar Cambios' : '+ Guardar Configuración'}
                </button>
              </form>
            </GlassCard>
          </div>

          {/* Tabla */}
          <div className="md:col-span-2">
            <GlassCard>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="py-3 px-4">Método / Canal</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {methods.map(method => (
                      <tr key={method.id} className="hover:bg-white/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-gray-800">{method.name}</td>
                        <td className="py-3 px-4">
                          <BadgeType type={method.type} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggle(method.id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${method.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                          >
                            {method.is_active ? 'ACTIVO' : 'INACTIVO'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuMethodId(activeMenuMethodId === method.id ? null : method.id);
                            }}
                            className={`p-2 rounded-full transition-colors ${activeMenuMethodId === method.id ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-brand-primary hover:bg-gray-100'}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                          </button>

                          {/* Dropdown Menu */}
                          {activeMenuMethodId === method.id && (
                            <>
                              <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveMenuMethodId(null)} />
                              <div className="absolute right-8 top-8 z-50 bg-white/95 backdrop-blur-xl shadow-2xl rounded-xl border border-white/50 p-1.5 min-w-[200px] flex flex-col gap-1 animate-fade-in text-left">

                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEdit(method); setActiveMenuMethodId(null); }}
                                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-lg transition-colors text-xs font-bold"
                                >
                                  <div className="p-1.5 bg-blue-100 rounded-md text-blue-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                  </div>
                                  Editar Método
                                </button>

                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggle(method.id); setActiveMenuMethodId(null); }}
                                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-xs font-bold ${method.is_active ? 'hover:bg-red-50 text-gray-600 hover:text-red-500' : 'hover:bg-green-50 text-gray-600 hover:text-green-500'}`}
                                >
                                  <div className={`p-1.5 rounded-md ${method.is_active ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" x2="12" y1="2" y2="12" /></svg>
                                  </div>
                                  {method.is_active ? 'Desactivar' : 'Activar'}
                                </button>

                                <div className="h-px bg-gray-100 my-1 mx-2"></div>

                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(method.id); setActiveMenuMethodId(null); }}
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
                    ))}
                    {methods.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-gray-400">Sin métodos configurados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'AUDIT' && (
        <GlassCard>
          <h3 className="text-lg font-bold text-brand-primary mb-4">Registro de Acciones Críticas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200 bg-gray-50/50">
                  <th className="py-3 px-4 rounded-tl-lg">Fecha y Hora</th>
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Acción</th>
                  <th className="py-3 px-4 rounded-tr-lg">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-800">{log.user_name}</td>
                    <td className="py-3 px-4">
                      <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs font-bold font-mono tracking-tight">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{log.details}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      No hay registros de auditoría disponibles.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      Cargando logs...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

const BadgeType = ({ type }: { type: PaymentMethodType }) => {
  const styles = {
    CASH: 'bg-green-100 text-green-800',
    CARD: 'bg-blue-100 text-blue-800',
    TRANSFER: 'bg-purple-100 text-purple-800',
    OTHER: 'bg-gray-100 text-gray-800',
  };

  const labels = {
    CASH: 'EFECTIVO',
    CARD: 'POS / TARJETA',
    TRANSFER: 'TRANSFERENCIA',
    OTHER: 'OTRO',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${styles[type]}`}>
      {labels[type]}
    </span>
  );
};
