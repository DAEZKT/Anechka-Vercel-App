import React, { useState } from 'react';
import { GlassCard } from './GlassCard';
import { userService } from '../services/supabaseService';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    requireOldPassword?: boolean;
    userEmail?: string; // Needed for verification if requiring old password
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
    isOpen, onClose, userId, userName, requireOldPassword, userEmail
}) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        if (newPassword.length < 4) {
            setError('La contraseña debe tener al menos 4 caracteres.');
            return;
        }

        setLoading(true);

        try {
            // 1. Verify old password if required
            if (requireOldPassword && userEmail) {
                const user = await userService.authenticate(userEmail, oldPassword);
                if (!user) {
                    setError('La contraseña actual es incorrecta.');
                    setLoading(false);
                    return;
                }
            }

            // 2. Update password
            const result = await userService.changePassword(userId, newPassword);
            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                }, 1500);
            } else {
                setError(result.error || 'Error al actualizar.');
            }
        } catch (err: any) {
            setError(err.message || 'Error inesperado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <GlassCard className="w-full max-w-md bg-white relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>

                <h3 className="text-xl font-bold text-gray-800 mb-1">Cambiar Contraseña</h3>
                <p className="text-xs text-gray-500 mb-6">Usuario: <span className="font-bold text-brand-primary">{userName}</span></p>

                {success ? (
                    <div className="p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">✓</div>
                        <div>
                            <p className="font-bold">¡Actualizado!</p>
                            <p className="text-xs">La contraseña se ha cambiado correctamente.</p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {requireOldPassword && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Contraseña Actual</label>
                                <input
                                    type="password"
                                    required
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                                    autoFocus
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Nueva Contraseña</label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                                placeholder="Mínimo 4 caracteres"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Confirmar Nueva Contraseña</label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                            />
                        </div>

                        {error && (
                            <div className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100 font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 mt-2"
                        >
                            {loading ? 'Procesando...' : 'Actualizar Contraseña'}
                        </button>
                    </form>
                )}
            </GlassCard>
        </div>
    );
};
