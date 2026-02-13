
import React, { useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { InventoryPage } from './pages/InventoryPage';
import { AdminPage } from './pages/AdminPage';
import { CustomersPage } from './pages/CustomersPage';
import { UsersPage } from './pages/UsersPage';
import { SalesPage } from './pages/SalesPage'; // Import Sales Page
import { ExpensesPage } from './pages/ExpensesPage'; // Import Expenses Page
import { SuppliersPage } from './pages/SuppliersPage'; // Import Suppliers Page
import { CashClosePage } from './pages/CashClosePage'; // Import CashClose Page
import { Layout } from './components/Layout';
import { User, UserRole } from './types';
import { PublicCatalogPage } from './pages/PublicCatalogPage';
import { hasPermission } from './utils/permissions';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('login');
  };

  // 1. PUBLIC ROUTES (No Login Required)
  if (currentPage === 'public-catalog') {
    return <PublicCatalogPage />;
  }

  // 2. Auth Guard
  if (!user) {
    return <LoginPage onLogin={handleLogin} onNavigate={setCurrentPage} />;
  }

  // Router Switch
  const renderPage = () => {
    // Basic routing logic
    if (currentPage === 'dashboard') return <Dashboard user={user} />;
    if (currentPage === 'pos') return <POS user={user} />;
    if (currentPage === 'cash-close') return <CashClosePage user={user} />;
    if (currentPage === 'sales') return <SalesPage />;
    if (currentPage === 'customers') return <CustomersPage />;
    if (currentPage === 'expenses') return <ExpensesPage user={user} />;
    if (currentPage === 'suppliers') return <SuppliersPage />;

    // Inventory Sub-routes

    // Inventory Sub-routes
    if (currentPage === 'inventory-stock') return <InventoryPage user={user} initialView="STOCK" />;
    if (currentPage === 'inventory-catalog') return <InventoryPage user={user} initialView="CATALOG" />;
    if (currentPage === 'inventory-movements') return <InventoryPage user={user} initialView="MOVEMENT" />;
    if (currentPage === 'inventory-kardex') return <InventoryPage user={user} initialView="KARDEX" />;
    if (currentPage === 'inventory-audit') return <InventoryPage user={user} initialView="AUDIT" />;

    // Admin / Internal Control
    if (currentPage === 'admin') return <AdminPage />;
    if (currentPage === 'users') return <UsersPage />;



    // Default fallback for inventory parent or unknown routes
    if (currentPage.startsWith('inventory')) return <InventoryPage user={user} initialView="STOCK" />;

    return <Dashboard user={user} />;
  };

  // 3. Permission Guard
  if (!hasPermission(user.role, currentPage, user.custom_permissions)) {
    // If unauthorized, redirect to dashboard or show error
    // Ideally we would set state, but simple return works for now
    // Prevent infinite loop if dashboard is also restricted (unlikely for most)
    if (currentPage !== 'dashboard') {
      // If role is CLIENTE, they shouldn't even be here (Auth Guard handles logged in users)
      // But if a Client logs in somehow?
      console.warn(`User ${user.role} restricted from ${currentPage}`);
      return (
        <Layout user={user} onLogout={handleLogout} currentPage={currentPage} onNavigate={setCurrentPage}>
          <div className="p-8 text-center text-red-500 font-bold">
            Acceso Restringido. No tiene permisos para ver esta página.
          </div>
        </Layout>
      );
    }
  }

  return (
    <Layout
      user={user}
      onLogout={handleLogout}
      currentPage={currentPage}
      onNavigate={setCurrentPage}
    >
      {renderPage()}
    </Layout>
  );
}
