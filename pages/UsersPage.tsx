
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { userService } from '../services/supabaseService';
import { User, UserRole } from '../types';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { PermissionsModal } from '../components/PermissionsModal';
import { PermissionsManager } from '../components/PermissionsManager';

export const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [viewPermissionsUser, setViewPermissionsUser] = useState<User | null>(null);
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: UserRole.VENDEDOR,
    password: '' // Only for UI (Mocked)
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const data = await userService.getAll();
    setUsers(data);
    setLoading(false);
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleStatus = async (user: User) => {
    const action = user.is_active ? 'DESACTIVAR' : 'ACTIVAR';
    if (window.confirm(`¿Confirma que desea ${action} el acceso de ${user.full_name}?`)) {
      await userService.toggleStatus(user.id);
      loadUsers();
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      password: '' // Don't show password on edit
    });
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      full_name: '',
      email: '',
      role: UserRole.VENDEDOR,
      password: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingUser) {
        await userService.update(editingUser.id, {
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role
        });
      } else {
        await userService.create({
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
          password: formData.password
        });
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (error: any) {
      console.error(error);
      alert("Error al guardar usuario: " + (error.message || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return <span className="px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs font-bold border border-violet-200">ADMINISTRADOR</span>;
      case UserRole.VENDEDOR:
        return <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">VENDEDOR</span>;
      case UserRole.CONTADOR:
        return <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">CONTADOR</span>;
      case UserRole.AUDITOR:
        return <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">AUDITOR</span>;
      default:
        return <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-bold">{role}</span>;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h2>
          <p className="text-gray-500">Administración de accesos y roles del sistema.</p>
        </div>
        <button
          onClick={handleCreate}
          className="w-full md:w-auto bg-brand-primary hover:bg-brand-secondary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand-primary/20 transition-all flex items-center justify-center gap-2"
        >
          <span className="text-xl leading-none">+</span> Nuevo Usuario
        </button>
      </header>

      {/* Search Bar */}
      <GlassCard className="py-3 px-4 flex gap-4 items-center bg-white/40">
        <div className="text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
        <input
          type="text"
          placeholder="Buscar por Nombre o Correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none focus:outline-none text-sm font-medium"
        />
      </GlassCard>

      {/* Users Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/50 text-gray-500 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 w-16">Avatar</th>
                <th className="py-3 px-4 min-w-[200px]">Nombre Completo</th>
                <th className="py-3 px-4 min-w-[220px]">Correo Electrónico</th>
                <th className="py-3 px-4">Rol / Permisos</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No se encontraron usuarios.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className={`hover:bg-white/40 transition-colors group ${!u.is_active ? 'opacity-60 bg-gray-50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border ${u.is_active ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' : 'bg-gray-200 text-gray-500 border-gray-300'}`}>
                        {getInitials(u.full_name)}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-800">{u.full_name}</td>
                    <td className="py-3 px-4 text-gray-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getRoleBadge(u.role)}
                        <button
                          onClick={() => setViewPermissionsUser(u)}
                          className="text-gray-400 hover:text-brand-primary transition-colors"
                          title="Ver Permisos Detallados"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                      >
                        {u.is_active ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuUserId(activeMenuUserId === u.id ? null : u.id);
                        }}
                        className={`p-2 rounded-full transition-colors ${activeMenuUserId === u.id ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-brand-primary hover:bg-gray-100'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuUserId === u.id && (
                        <>
                          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveMenuUserId(null)} />
                          <div className="absolute right-8 top-8 z-50 bg-white/95 backdrop-blur-xl shadow-2xl rounded-xl border border-white/50 p-1.5 min-w-[200px] flex flex-col gap-1 animate-fade-in text-left">
                            <button
                              onClick={(e) => { e.stopPropagation(); setPasswordResetUser(u); setActiveMenuUserId(null); }}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50 text-gray-600 hover:text-amber-600 rounded-lg transition-colors text-xs font-bold"
                            >
                              <div className="p-1.5 bg-amber-100 rounded-md text-amber-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                              </div>
                              Cambiar Contraseña
                            </button>

                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(u); setActiveMenuUserId(null); }}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-lg transition-colors text-xs font-bold"
                            >
                              <div className="p-1.5 bg-blue-100 rounded-md text-blue-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                              </div>
                              Editar Usuario
                            </button>

                            <div className="h-px bg-gray-100 my-1 mx-2"></div>

                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleStatus(u); setActiveMenuUserId(null); }}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-xs font-bold ${u.is_active ? 'hover:bg-red-50 text-gray-600 hover:text-red-500' : 'hover:bg-green-50 text-gray-600 hover:text-green-600'}`}
                            >
                              <div className={`p-1.5 rounded-md ${u.is_active ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" x2="12" y1="2" y2="12" /></svg>
                              </div>
                              {u.is_active ? 'Desactivar Acceso' : 'Reactivar Acceso'}
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-md bg-white border-white shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nombre Completo *</label>
                <input
                  required
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Rol de Sistema *</label>
                <div className="relative">
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-4 py-2 pr-10 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none appearance-none"
                  >
                    <option value={UserRole.ADMIN}>ADMINISTRADOR</option>
                    <option value={UserRole.VENDEDOR}>VENDEDOR</option>
                    <option value={UserRole.CONTADOR}>CONTADOR</option>
                    <option value={UserRole.AUDITOR}>AUDITOR</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Contraseña Temporal</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                    placeholder="••••••"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 rounded-lg mt-4 transition-all"
              >
                {loading ? 'Guardando...' : (editingUser ? 'Actualizar Usuario' : 'Crear Usuario')}
              </button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Reset Password Modal */}
      {passwordResetUser && (
        <ChangePasswordModal
          isOpen={true}
          onClose={() => setPasswordResetUser(null)}
          userId={passwordResetUser.id}
          userName={passwordResetUser.full_name}
          requireOldPassword={false}
        />
      )}

      {/* View Permissions Modal */}
      {viewPermissionsUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl relative">
            <button onClick={() => setViewPermissionsUser(null)} className="absolute -top-10 right-0 text-white hover:text-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <PermissionsManager
              user={viewPermissionsUser}
              onUpdate={() => {
                loadUsers();
                // setViewPermissionsUser(null); // Keep open to see changes? Or close. Let's keep open.
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
