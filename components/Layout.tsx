
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { ChangePasswordModal } from './ChangePasswordModal';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

// --- PROFESSIONAL ICONS (Lucide Style) ---
const Icons = {
  Menu: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
  ),
  X: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  ),
  Dashboard: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></svg>
  ),
  POS: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
  ),
  Sales: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
  ),
  Customers: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  Inventory: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22v-9" /></svg>
  ),
  Expenses: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
  ),
  Settings: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  Security: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
  ),
  Logout: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
  ),
  Cashbox: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>
  ),
  Suppliers: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11" /><path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
  ),
  Orders: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
};

// Helper to check permission
import { hasPermission } from '../utils/permissions';

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentPage, onNavigate }) => {
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Auto-expand menu if current page belongs to it
  useEffect(() => {
    if (currentPage.startsWith('inventory')) {
      setIsInventoryOpen(true);
    }
  }, [currentPage]);

  // Handle Mobile Navigation Click (Close menu)
  const handleMobileNavigate = (page: string) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  const toggleInventory = () => {
    setIsInventoryOpen(!isInventoryOpen);
  };

  const checkAccess = (page: string) => {
    if (!user) return false;
    return hasPermission(user.role, page, user.custom_permissions);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans text-gray-800 bg-gradient-to-br from-[#e0c3fc] to-[#8ec5fc]">

      {/* MOBILE HEADER (Visible only on mobile/tablet) */}
      <header className="lg:hidden flex items-center justify-between p-4 glass-panel m-4 mb-0 sticky top-4 z-40 bg-white/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-white/40 text-brand-primary active:scale-95 transition-transform"
          >
            <Icons.Menu className="w-7 h-7" />
          </button>
          <div>
            <h1 className="text-lg font-black text-gray-800 tracking-tighter uppercase leading-none">DAEZKT</h1>
            <p className="text-[9px] text-gray-500 tracking-[0.2em] font-medium leading-none">POS SYSTEM</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-brand-primary/30">
          {user?.full_name.charAt(0)}
        </div>
      </header>

      {/* MOBILE MENU BACKDROP OVERLAY */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR (Responsive: Fixed Drawer on Mobile/Tablet, Static on Desktop) */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-64
          glass-panel lg:m-4 lg:rounded-2xl
          flex flex-col h-full lg:h-[calc(100vh-2rem)]
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0 rounded-r-2xl border-r-white/50 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
          bg-white/80 lg:bg-white/25
        `}
      >
        {/* Sidebar Header */}
        <div className="p-6 flex justify-between items-start border-b border-white/20">
          <div className="text-left lg:text-center lg:w-full">
            <h1 className="text-2xl font-bold text-brand-primary tracking-tight">DAEZKT</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">POS & ERP System</p>
          </div>
          {/* Close Button (Mobile Only) */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-gray-500 hover:text-red-500 transition-colors"
          >
            <Icons.X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
          {checkAccess('dashboard') && (
            <NavButton active={currentPage === 'dashboard'} onClick={() => handleMobileNavigate('dashboard')} icon={Icons.Dashboard} label="Dashboard" />
          )}

          {checkAccess('pos') && (
            <NavButton active={currentPage === 'pos'} onClick={() => handleMobileNavigate('pos')} icon={Icons.POS} label="Punto de Venta" />
          )}

          {checkAccess('pending-orders') && (
            <NavButton active={currentPage === 'pending-orders'} onClick={() => handleMobileNavigate('pending-orders')} icon={Icons.Orders} label="Pedidos Web" />
          )}

          {checkAccess('cash-close') && (
            <NavButton active={currentPage === 'cash-close'} onClick={() => handleMobileNavigate('cash-close')} icon={Icons.Cashbox} label="Cierre de Caja" />
          )}

          {checkAccess('sales') && (
            <NavButton active={currentPage === 'sales'} onClick={() => handleMobileNavigate('sales')} icon={Icons.Sales} label="Historial Ventas" />
          )}

          {checkAccess('customers') && (
            <NavButton active={currentPage === 'customers'} onClick={() => handleMobileNavigate('customers')} icon={Icons.Customers} label="Clientes" />
          )}

          {checkAccess('suppliers') && (
            <NavButton active={currentPage === 'suppliers'} onClick={() => handleMobileNavigate('suppliers')} icon={Icons.Suppliers} label="Proveedores" />
          )}

          {/* Inventory Group */}
          {/* Check general inventory permission or any specific inventory sub-permission */}
          {(checkAccess('inventory') || checkAccess('inventory-stock')) && (
            <div className="space-y-1">
              <button
                onClick={toggleInventory}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium group
                ${currentPage.startsWith('inventory')
                    ? 'bg-white/50 text-brand-primary shadow-sm'
                    : 'hover:bg-white/40 text-gray-700'
                  }
              `}
              >
                <div className="flex items-center gap-3">
                  <Icons.Inventory className={`w-5 h-5 ${currentPage.startsWith('inventory') ? 'text-brand-primary' : 'text-gray-500 group-hover:text-brand-primary'}`} />
                  <span>Inventario</span>
                </div>
                <ChevronDown isOpen={isInventoryOpen} />
              </button>

              {isInventoryOpen && (
                <div className="pl-4 space-y-1 animate-fade-in-down border-l-2 border-brand-primary/20 ml-4 my-1">
                  <NavSubButton
                    active={currentPage === 'inventory-stock'}
                    onClick={() => handleMobileNavigate('inventory-stock')}
                    label="Existencias"
                  />
                  <NavSubButton
                    active={currentPage === 'inventory-catalog'}
                    onClick={() => handleMobileNavigate('inventory-catalog')}
                    label="Nuevo Producto"
                  />
                  <NavSubButton
                    active={currentPage === 'inventory-brands'}
                    onClick={() => handleMobileNavigate('inventory-brands')}
                    label="Marcas"
                  />
                  <NavSubButton
                    active={currentPage === 'inventory-movements'}
                    onClick={() => handleMobileNavigate('inventory-movements')}
                    label="Movimientos"
                  />
                  <NavSubButton
                    active={currentPage === 'inventory-kardex'}
                    onClick={() => handleMobileNavigate('inventory-kardex')}
                    label="Kardex"
                  />
                  {checkAccess('inventory-audit') && (
                    <NavSubButton
                      active={currentPage === 'inventory-audit'}
                      onClick={() => handleMobileNavigate('inventory-audit')}
                      label="Auditoría"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {checkAccess('expenses') && (
            <NavButton active={currentPage === 'expenses'} onClick={() => handleMobileNavigate('expenses')} icon={Icons.Expenses} label="Egresos y Gastos" />
          )}

          {/* Admin / Control Interno */}
          {/* Usually admin only, but maybe customizable? For now keep 'admin' check */}
          {checkAccess('admin') && (
            <NavButton active={currentPage === 'admin'} onClick={() => handleMobileNavigate('admin')} icon={Icons.Settings} label="Control Interno" />
          )}

          {/* Users - Restricted to Admin typically, but let's check permission 'users' specifically if we add it */}
          {(user?.role === UserRole.ADMIN || checkAccess('users')) && (
            <NavButton active={currentPage === 'users'} onClick={() => handleMobileNavigate('users')} icon={Icons.Security} label="Usuarios" />
          )}
        </nav>

        {/* Sidebar Footer (User Profile) */}
        <div className="p-4 border-t border-white/20 bg-white/30 lg:bg-white/10">
          <div
            className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-white/20 p-2 rounded-lg transition-colors group/profile"
            onClick={() => setIsProfileModalOpen(true)}
            title="Clic para cambiar contraseña"
          >
            <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-xs">
              {user?.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gray-800">{user?.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role}</p>
            </div>
            <Icons.Settings className="w-4 h-4 text-gray-400 group-hover/profile:text-brand-primary transition-colors opacity-0 group-hover/profile:opacity-100" />
          </div>
          <button
            onClick={onLogout}
            className="w-full text-xs bg-red-400/10 hover:bg-red-400/20 text-red-600 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 font-bold group border border-red-200/50"
          >
            <Icons.Logout className="w-4 h-4 text-red-500 group-hover:text-red-700" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {user && (
        <ChangePasswordModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          userId={user.id}
          userName={user.full_name}
          userEmail={user.email}
          requireOldPassword={true}
        />
      )}

      {/* Main Content Area */}
      {/* Adjusted margins: lg:ml-0 because Sidebar is now flex in flow on desktop, no longer absolute positioning needed for main layout */}
      <main className="flex-1 p-4 lg:p-8 overflow-x-hidden min-h-[calc(100vh-80px)] lg:min-h-screen">
        {children}
      </main>

    </div>
  );
};

// UI Components
const NavButton = ({ children, active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium group
      ${active
        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30'
        : 'hover:bg-white/40 text-gray-700'
      }
    `}
  >
    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-500 group-hover:text-brand-primary'}`} />
    {label || children}
  </button>
);

const NavSubButton = ({ active, onClick, label }: any) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-medium transition-colors relative
      ${active
        ? 'text-brand-primary bg-brand-primary/10 font-bold'
        : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'
      }
    `}
  >
    {/* Visual indicator line for hierarchy */}
    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3 rounded-r-full bg-brand-primary"></span>}
    {label}
  </button>
);

const ChevronDown = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
