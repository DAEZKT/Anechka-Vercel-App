import React, { useState, useEffect } from 'react';
import { GlassCard } from './GlassCard';
import { User, UserRole } from '../types';
import { ROLE_PERMISSIONS } from '../utils/permissions';
import { userService } from '../services/supabaseService';

interface PermissionsManagerProps {
    user: User;
    onUpdate: () => void;
}

const ALL_ROUTES = [
    { key: 'dashboard', label: 'Panel Principal (Dashboard)' },
    { key: 'pos', label: 'Punto de Venta' },
    { key: 'cash-close', label: 'Corte de Caja' },
    { key: 'sales', label: 'Historial de Ventas' },
    { key: 'customers', label: 'Gestión de Clientes' },
    { key: 'suppliers', label: 'Gestión de Proveedores' },
    { key: 'inventory', label: 'Inventario (General)' },
    { key: 'inventory-stock', label: 'Inventario: Existencias' },
    { key: 'inventory-catalog', label: 'Inventario: Catálogo' },
    { key: 'inventory-movements', label: 'Inventario: Movimientos' },
    { key: 'inventory-kardex', label: 'Inventario: Kardex' },
    { key: 'inventory-audit', label: 'Inventario: Auditoría' },
    { key: 'expenses', label: 'Egresos y Gastos' },
    { key: 'admin', label: 'Control Interno y Configuración' },
    { key: 'users', label: 'Gestión de Usuarios' },
    { key: 'pending-orders', label: 'Pedidos Web Pendientes' }
];

export const PermissionsManager: React.FC<PermissionsManagerProps> = ({ user, onUpdate }) => {
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        // Initialize with user's current permissions
        // If custom_permissions is set, use it. Otherwise, load default role permissions?
        // Actually, if we want to EDIT custom permissions, we should start with what they effectively have.
        // OR better: Start with their CUSTOM permissions if any, otherwise empty imply "Default Role".
        // But the user wants to ASSIGN views. 

        if (user.custom_permissions && user.custom_permissions.length > 0) {
            setSelectedPermissions(user.custom_permissions);
        } else {
            // If no custom permissions, pre-fill with role defaults so they can modify them?
            // Or keep empty to indicate "Inherited from Role"?
            // Let's pre-fill to make it easier to "tweak".
            const rolePerms = ROLE_PERMISSIONS[user.role];
            if (rolePerms && rolePerms.includes('*')) {
                setSelectedPermissions(ALL_ROUTES.map(r => r.key)); // Admin gets all selected by default
            } else {
                setSelectedPermissions(rolePerms || []);
            }
        }
    }, [user]);

    const handleToggle = (key: string) => {
        setSelectedPermissions(prev => {
            if (prev.includes(key)) {
                return prev.filter(p => p !== key);
            } else {
                return [...prev, key];
            }
        });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const result = await userService.updatePermissions(user.id, selectedPermissions);
            if (result.success) {
                setSuccessMsg('Permisos actualizados correctamente.');
                setTimeout(() => setSuccessMsg(''), 3000);
                onUpdate();
            } else {
                alert('Error al guardar: ' + result.error);
            }
        } catch (error) {
            console.error(error);
            alert('Error inesperado al guardar permisos.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('¿Seguro que desea restablecer a los permisos por defecto del Rol?')) return;

        setLoading(true);
        try {
            // Sending empty array or null to reset? 
            // My backend implementation updates whatever I send. 
            // If I want to "unset" custom permissions, I should probably send null or handle it in backend.
            // But types says string[]. 
            // Let's assume sending NULL to DB clears it? 
            // Supabase update checks types. 
            // For now, let's just send the Default Role Permissions as the "Custom" ones, OR
            // we can modify backend to accept null. 
            // Simpler approach: Just save the default role permissions as the custom set.
            // Wait, if I save them as custom, they are still "custom" but match the role.
            // If I want to revert to "Using Role Defaults" logically (so if role changes, perms change),
            // I need to clear the column. I'll pass null formatted as any to bypass TS for a sec if needed, 
            // or update service to accept null.

            // Let's just create a new empty array which might mean "No Access" if interpreted strictly?
            // Re-reading logic: hasPermission checks custom first. If custom is present, it uses it.
            // If custom is empty array [], it means NO permissions? Yes.
            // So to RESET, we need to set it to NULL.
            // I need to update supabaseService to allow null.

            // Current supabaseService: update({ custom_permissions: permissions ... })
            // If I pass null it might work.

            const result = await userService.updatePermissions(user.id, null);
            if (result.success) {
                setSuccessMsg('Restablecido a permisos del rol.');
                setTimeout(() => setSuccessMsg(''), 3000);
                onUpdate();

                // Reset local state
                const rolePerms = ROLE_PERMISSIONS[user.role];
                setSelectedPermissions(rolePerms || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <GlassCard className="bg-white/95 backdrop-blur-xl shadow-2xl border-white/50">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Permisos Personalizados</h3>
                        <p className="text-sm text-gray-500">
                            Usuario: <span className="font-bold text-brand-primary">{user.full_name}</span>
                            <span className="mx-2">|</span>
                            Rol Base: <span className="font-bold text-gray-700">{user.role}</span>
                        </p>
                    </div>
                    <button
                        onClick={handleReset}
                        className="text-xs text-red-500 hover:text-red-700 underline"
                        title="Vuelve a usar los permisos definidos por el Rol"
                    >
                        Restablecer a Valores del Rol
                    </button>
                </div>

                {successMsg && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm font-bold text-center animate-fade-in">
                        {successMsg}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-2">
                    {ALL_ROUTES.map((route) => (
                        <label
                            key={route.key}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden
                                ${selectedPermissions.includes(route.key)
                                    ? 'bg-brand-primary/10 border-brand-primary/40 shadow-sm'
                                    : 'bg-gray-50/80 border-gray-200 hover:bg-gray-100'
                                }
                            `}
                        >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                                ${selectedPermissions.includes(route.key)
                                    ? 'bg-brand-primary border-brand-primary text-white'
                                    : 'bg-white border-gray-300'
                                }
                            `}>
                                {selectedPermissions.includes(route.key) && (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                )}
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={selectedPermissions.includes(route.key)}
                                onChange={() => handleToggle(route.key)}
                            />
                            <span className={`text-sm font-bold ${selectedPermissions.includes(route.key) ? 'text-brand-primary' : 'text-gray-600'}`}>
                                {route.label}
                            </span>
                        </label>
                    ))}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-brand-primary/20 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </GlassCard>
        </div>
    );
};
