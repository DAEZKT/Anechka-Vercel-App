import React from 'react';
import { GlassCard } from './GlassCard';
import { User } from '../types';
import { ROLE_PERMISSIONS } from '../utils/permissions';

interface PermissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

const ROUTE_LABELS: Record<string, string> = {
    '*': 'Acceso Total (Super Admin)',
    'dashboard': 'Panel Principal',
    'pos': 'Punto de Venta',
    'sales': 'Historial de Ventas',
    'customers': 'Clientes',
    'expenses': 'Gastos',
    'cash-close': 'Corte de Caja',
    'inventory-audit': 'Auditoría de Inventario'
};

export const PermissionsModal: React.FC<PermissionsModalProps> = ({ isOpen, onClose, user }) => {
    if (!isOpen) return null;

    const permissions = ROLE_PERMISSIONS[user.role] || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <GlassCard className="w-full max-w-sm bg-white relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto mb-3 text-brand-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">Permisos de Acceso</h3>
                    <p className="text-sm text-gray-500">Usuario: <span className="font-bold text-gray-700">{user.full_name}</span></p>
                    <div className="mt-2 inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold border border-gray-200">
                        Rol: {user.role}
                    </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 max-h-[300px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Módulos Habilitados</h4>
                    <ul className="space-y-2">
                        {permissions.map((perm, index) => (
                            <li key={index} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                </div>
                                <span className="text-sm font-medium text-gray-700">
                                    {ROUTE_LABELS[perm] || perm}
                                </span>
                            </li>
                        ))}
                        {permissions.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-4">Este usuario no tiene acceso a módulos internos.</p>
                        )}
                    </ul>
                </div>

                <div className="mt-6 text-center">
                    <button
                        onClick={onClose}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </GlassCard>
        </div>
    );
};
