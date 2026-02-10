
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { paymentMethodService } from '../services/supabaseService';
import { PaymentMethod, PaymentMethodType } from '../types';

// Chevron Icon for Custom Select
const ChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);

export const AdminPage = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);

  // New Method Form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PaymentMethodType>('CARD');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await paymentMethodService.getAll();
    setMethods(data);
    setLoading(false);
  };

  const handleToggle = async (id: string) => {
    await paymentMethodService.toggleActive(id);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar este método de pago?')) {
      await paymentMethodService.delete(id);
      loadData();
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    await paymentMethodService.create({
      name: newName,
      type: newType,
      is_active: true
    });

    setNewName('');
    loadData();
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-gray-800">Control Interno</h2>
        <p className="text-gray-500">Configuración de Cuentas, POS y Métodos de Pago.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Formulario */}
        <div className="md:col-span-1">
          <GlassCard className="sticky top-4">
            <h3 className="text-lg font-bold text-brand-primary mb-4">Agregar Método</h3>
            <form onSubmit={handleAdd} className="space-y-4">
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
                    <option value="CARD">Tarjeta (POS)</option>
                    <option value="TRANSFER">Transferencia Bancaria</option>
                    <option value="CASH">Efectivo</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                    <ChevronDown />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 rounded-lg transition-colors shadow-lg shadow-brand-primary/20"
              >
                + Guardar Configuración
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
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDelete(method.id)}
                          className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded"
                          title="Eliminar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                        </button>
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
