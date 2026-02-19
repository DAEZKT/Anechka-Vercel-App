import React, { useState, useEffect } from 'react';
import { expenseAccountService } from '../services/supabaseService';
import { ExpenseAccountModel, ExpenseSubAccountModel } from '../types';
import { GlassCard } from './GlassCard';

interface ExpenseAccountManagerProps {
    onClose: () => void;
    onUpdate: () => void;
}

export const ExpenseAccountManager: React.FC<ExpenseAccountManagerProps> = ({ onClose, onUpdate }) => {
    const [accounts, setAccounts] = useState<ExpenseAccountModel[]>([]);
    const [subAccounts, setSubAccounts] = useState<ExpenseSubAccountModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);

    // Form States
    const [newAccountName, setNewAccountName] = useState('');
    const [newSubAccountName, setNewSubAccountName] = useState('');
    const [editingItem, setEditingItem] = useState<{ type: 'ACCOUNT' | 'SUB', id: string, name: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [accs, subs] = await Promise.all([
                expenseAccountService.getAllAccounts(),
                expenseAccountService.getAllSubAccounts()
            ]);
            setAccounts(accs);
            setSubAccounts(subs);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to get subaccounts for a specific account
    const getSubAccountsFor = (accountId: string) => subAccounts.filter(s => s.account_id === accountId);

    // --- HANDLERS ---
    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAccountName.trim()) return;

        setLoading(true);
        const res = await expenseAccountService.createAccount(newAccountName.toUpperCase().trim());
        if (res.success) {
            setNewAccountName('');
            await loadData();
            onUpdate();
        } else {
            alert('Error: ' + res.error);
        }
        setLoading(false);
    };

    const handleAddSubAccount = async (e: React.FormEvent, accountId: string) => {
        e.preventDefault();
        if (!newSubAccountName.trim()) return;

        setLoading(true);
        const res = await expenseAccountService.createSubAccount(accountId, newSubAccountName.trim());
        if (res.success) {
            setNewSubAccountName('');
            await loadData();
            onUpdate();
        } else {
            alert('Error: ' + res.error);
        }
        setLoading(false);
    };

    const handleDelete = async (type: 'ACCOUNT' | 'SUB', id: string) => {
        if (!confirm('¿Estás seguro de eliminar este elemento?')) return;
        setLoading(true);
        const service = type === 'ACCOUNT' ? expenseAccountService.deleteAccount : expenseAccountService.deleteSubAccount;
        const res = await service(id);
        if (res.success) {
            await loadData();
            onUpdate();
        } else {
            alert('Error al eliminar: ' + res.error);
        }
        setLoading(false);
    };

    const handleSaveEdit = async () => {
        if (!editingItem) return;
        setLoading(true);
        const service = editingItem.type === 'ACCOUNT' ? expenseAccountService.updateAccount : expenseAccountService.updateSubAccount;
        const finalName = editingItem.type === 'ACCOUNT' ? editingItem.name.toUpperCase().trim() : editingItem.name.trim();

        const res = await service(editingItem.id, finalName);
        if (res.success) {
            setEditingItem(null);
            await loadData();
            onUpdate();
        } else {
            alert('Error al actualizar: ' + res.error);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <GlassCard className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white overflow-hidden shadow-2xl rounded-2xl">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Gestionar Cuentas de Gastos</h3>
                        <p className="text-xs text-gray-500">Configura las categorías y subcategorías para tus egresos.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 custom-scrollbar">

                    {/* Add New Main Account */}
                    <form onSubmit={handleAddAccount} className="mb-6 flex gap-3">
                        <input
                            autoFocus
                            type="text"
                            placeholder="NOMBRE DE NUEVA CUENTA PRINCIPAL..."
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase font-semibold text-sm"
                            value={newAccountName}
                            onChange={e => setNewAccountName(e.target.value)}
                        />
                        <button
                            disabled={!newAccountName.trim() || loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 font-bold rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all"
                        >
                            Crear
                        </button>
                    </form>

                    {/* Accounts List */}
                    <div className="space-y-3">
                        {accounts.map(acc => (
                            <div key={acc.id} className="bg-white border boundary-gray-200 rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                                {/* Account Row */}
                                <div
                                    onClick={() => setExpandedAccountId(expandedAccountId === acc.id ? null : acc.id)}
                                    className={`px-5 py-4 flex items-center justify-between cursor-pointer select-none ${expandedAccountId === acc.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className={`p-2 rounded-lg ${expandedAccountId === acc.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><polyline points="14 2 14 8 20 8" /><path d="M3 15h6" /><path d="M3 18h6" /></svg>
                                        </div>

                                        {editingItem?.type === 'ACCOUNT' && editingItem.id === acc.id ? (
                                            <div className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
                                                <input
                                                    className="flex-1 border-b-2 border-blue-500 bg-transparent px-1 outline-none font-bold text-gray-800 uppercase"
                                                    value={editingItem.name}
                                                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                                    autoFocus
                                                />
                                                <button onClick={handleSaveEdit} className="text-green-600 font-bold hover:bg-green-50 p-1 rounded">✔</button>
                                                <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded">✕</button>
                                            </div>
                                        ) : (
                                            <span className="font-bold text-gray-700">{acc.name}</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-100 rounded-md">
                                            {getSubAccountsFor(acc.id).length} subcuentas
                                        </span>
                                        <div className="flex items-center" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => setEditingItem({ type: 'ACCOUNT', id: acc.id, name: acc.name })}
                                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete('ACCOUNT', acc.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                            <div className={`transform transition-transform duration-200 ml-2 ${expandedAccountId === acc.id ? 'rotate-180' : ''}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Subaccounts Section (Accordion Content) */}
                                {expandedAccountId === acc.id && (
                                    <div className="border-t border-gray-100 bg-gray-50/50 p-4 pl-12 animate-fade-in-down">
                                        <div className="space-y-2 mb-4">
                                            {getSubAccountsFor(acc.id).map(sub => (
                                                <div key={sub.id} className="flex justify-between items-center group py-1.5 px-3 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all">
                                                    {editingItem?.type === 'SUB' && editingItem.id === sub.id ? (
                                                        <div className="flex-1 flex gap-2">
                                                            <input
                                                                className="flex-1 border-b border-orange-500 bg-transparent px-1 outline-none text-sm"
                                                                value={editingItem.name}
                                                                onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                                                autoFocus
                                                            />
                                                            <button onClick={handleSaveEdit} className="text-green-600 text-xs font-bold">✔</button>
                                                            <button onClick={() => setEditingItem(null)} className="text-gray-400 text-xs">✕</button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-gray-600 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                                            {sub.name}
                                                        </span>
                                                    )}

                                                    {!(editingItem?.type === 'SUB' && editingItem.id === sub.id) && (
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => setEditingItem({ type: 'SUB', id: sub.id, name: sub.name })}
                                                                className="p-1 text-gray-300 hover:text-blue-500"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete('SUB', sub.id)}
                                                                className="p-1 text-gray-300 hover:text-red-500"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {getSubAccountsFor(acc.id).length === 0 && (
                                                <p className="text-xs text-gray-400 italic pl-5">No hay subcuentas aún.</p>
                                            )}
                                        </div>

                                        <form onSubmit={(e) => handleAddSubAccount(e, acc.id)} className="flex items-center gap-2 pl-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><path d="M9 12H15" /><path d="M12 9V15" /></svg>
                                            <input
                                                type="text"
                                                placeholder="Agregar subcuenta..."
                                                className="flex-1 bg-transparent border-b border-gray-200 focus:border-orange-400 outline-none text-sm py-1 placeholder-gray-400 transition-colors"
                                                value={newSubAccountName}
                                                onChange={e => setNewSubAccountName(e.target.value)}
                                            />
                                            <button
                                                disabled={!newSubAccountName.trim() || loading}
                                                className="text-xs font-bold text-orange-500 hover:text-orange-600 disabled:opacity-30"
                                            >
                                                AGREGAR
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};
