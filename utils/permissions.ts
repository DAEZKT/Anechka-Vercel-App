
import { UserRole } from '../types';

export const PUBLIC_ROUTES = ['public-catalog'];

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    [UserRole.ADMIN]: ['*'], // Access to everything
    [UserRole.VENDEDOR]: ['dashboard', 'pos', 'sales', 'customers', 'cash-close'],
    [UserRole.CONTADOR]: ['dashboard', 'sales', 'expenses', 'cash-close'], // Audit? Maybe read only
    [UserRole.AUDITOR]: ['inventory-audit'],
    [UserRole.CLIENTE]: [] // No internal access
};

export const hasPermission = (role: UserRole, page: string): boolean => {
    const allowedPages = ROLE_PERMISSIONS[role];
    if (!allowedPages) {
        console.warn(`Role ${role} not found in permissions`);
        return false;
    }
    if (allowedPages.includes('*')) return true;

    // Handle sub-routes (e.g., 'inventory-stock' matched by 'inventory')
    // For now, prompt logic uses exact matches mostly, but let's be safe.
    if (allowedPages.includes(page)) return true;

    // Partial match for inventory if role has 'inventory' (Admin has *)
    // Specific inventory roles:
    if (page.startsWith('inventory-')) {
        if (role === UserRole.AUDITOR && page === 'inventory-audit') return true;
        // Other inventory roles can be added here
    }

    return false;
};
