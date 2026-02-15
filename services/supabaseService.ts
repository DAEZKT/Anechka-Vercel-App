import { supabase } from '../lib/supabaseClient';
import bcrypt from 'bcryptjs';
import {
  Product,
  Category,
  PaymentMethod,
  Customer,
  User,
  SaleHeader,
  SaleDetail,
  InventoryMovementHeader,
  InventoryMovementDetail,
  Expense, // Keeping Expense as it's used in the service, not ExpenseHeader
  AuditSession,
  Order, // Public Orders
  MovementType,
  CartItem,
  ExpensePayment,
  Supplier,
  ExpenseAccountModel,
  ExpenseSubAccountModel,
  Brand // Added Brand
} from '../types';

// ==================== CATEGORY SERVICE ====================
export const categoryService = {
  getAll: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  create: async (name: string, description?: string): Promise<{ success: boolean; id?: string }> => {
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, description })
      .select()
      .single();

    if (error) return { success: false };
    return { success: true, id: data.id };
  }
};

// ==================== BRAND SERVICE ====================
export const brandService = {
  getAll: async (onlyActive: boolean = false): Promise<Brand[]> => {
    let query = supabase
      .from('brands')
      .select('*')
      .order('name');

    if (onlyActive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  create: async (brand: Omit<Brand, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; id?: string }> => {
    // Generate slug from name
    const slug = brand.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

    const { data, error } = await supabase
      .from('brands')
      .insert({
        name: brand.name,
        slug: slug,
        image_url: brand.image_url,
        is_active: brand.is_active ?? true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating brand', error);
      return { success: false };
    }
    return { success: true, id: data.id };
  },

  update: async (id: string, updates: Partial<Brand>): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('brands')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return { success: !error };
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id);
    return { success: !error };
  }
};

// ==================== PAYMENT METHOD SERVICE ====================
export const paymentMethodService = {
  getAll: async (onlyActive: boolean = false): Promise<PaymentMethod[]> => {
    let query = supabase
      .from('payment_methods')
      .select('*')
      .order('name');

    if (onlyActive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  create: async (method: Omit<PaymentMethod, 'id'>): Promise<{ success: boolean; id?: string }> => {
    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        name: method.name,
        type: method.type,
        is_active: method.is_active ?? true
      })
      .select()
      .single();

    if (error) return { success: false };
    return { success: true, id: data.id };
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id);

    return { success: !error };
  },

  toggleActive: async (id: string): Promise<{ success: boolean }> => {
    // First get current state
    const { data, error: getError } = await supabase
      .from('payment_methods')
      .select('is_active')
      .eq('id', id)
      .single();

    if (getError || !data) return { success: false };

    const { error: updateError } = await supabase
      .from('payment_methods')
      .update({ is_active: !data.is_active })
      .eq('id', id);

    return { success: !updateError };
  },

  update: async (id: string, updates: Partial<PaymentMethod>): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('payment_methods')
      .update(updates)
      .eq('id', id);

    return { success: !error };
  }
};

// ==================== PRODUCT SERVICE ====================
export const productService = {
  getAll: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select(`
                *,
                categories (
                    id,
                    name
                ),
                brands (
                    id,
                    name
                )
            `)
      .order('name');

    if (error) throw error;

    // Transform to match Product interface
    return (data || []).map(p => ({
      ...p,
      category_id: p.category_id || '',
      category_name: p.categories?.name || 'Sin categoría',
      brand_id: p.brand_id || null,
      brand_name: p.brands?.name || p.brand || 'Genérico', // Fallback to text brand
      price: p.price ?? 0,
      cost: p.cost ?? 0,
      stock_level: p.stock_level ?? 0,
      min_stock: p.min_stock ?? 0
    }));
  },

  getById: async (id: string): Promise<Product | null> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  createProduct: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; id?: string }> => {
    const { data, error } = await supabase
      .from('products')
      .insert({
        sku: product.sku,
        name: product.name,
        description: product.description,
        category_id: product.category_id || null,
        brand: product.brand, // Legacy text
        brand_id: product.brand_id || null, // FK
        color: product.color,
        size: product.size,
        gender: product.gender,
        price: product.price || 0,
        cost: product.cost || 0,
        stock_level: product.stock_level || 0,
        min_stock: product.min_stock || 0,
        image_url: product.image_url,
        is_active: product.is_active ?? true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      return { success: false };
    }
    return { success: true, id: data.id };
  },

  updateProduct: async (id: string, updates: Partial<Product>): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('products')
      .update({
        sku: updates.sku,
        name: updates.name,
        description: updates.description,
        category_id: updates.category_id,
        brand: updates.brand,
        brand_id: updates.brand_id, // Update FK
        color: updates.color,
        size: updates.size,
        gender: updates.gender,
        price: updates.price,
        cost: updates.cost,
        stock_level: updates.stock_level,
        min_stock: updates.min_stock,
        image_url: updates.image_url,
        is_active: updates.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) console.error('Error updating product:', error);
    return { success: !error };
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    return { success: !error };
  },

  updateStock: async (productId: string, newStock: number): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('products')
      .update({ stock_level: newStock, updated_at: new Date().toISOString() })
      .eq('id', productId);

    return { success: !error };
  }
};

// ==================== CUSTOMER SERVICE ====================
export const customerService = {
  getAll: async (): Promise<Customer[]> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  create: async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; id?: string }> => {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        nit: customer.nit,
        address: customer.address,
        notes: customer.notes
      })
      .select()
      .single();

    if (error) return { success: false };
    return { success: true, id: data.id };
  },

  update: async (id: string, updates: Partial<Customer>): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id);

    return { success: !error };
  }
};

// ==================== SALES SERVICE ====================
export const salesService = {
  getAll: async (): Promise<SaleHeader[]> => {
    return salesService.getSalesHistory();
  },

  getSalesHistory: async (): Promise<SaleHeader[]> => {
    const { data, error } = await supabase
      .from('sales')
      .select(`
                *,
                users (full_name),
                customers (name),
                payment_methods (name)
            `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(s => ({
      ...s,
      total_amount: Number(s.total || 0),
      subtotal: Number(s.subtotal || 0),
      discount: Number(s.discount || 0),
      tax: Number(s.tax || 0),
      status: 'COMPLETED',
      user_name: s.users?.full_name || 'Desconocido',
      customer_name: s.customers?.name || 'Consumidor Final',
      payment_method_name: s.payment_methods?.name || 'N/A',
      // If snapshot is missing but we have payment_method_name and total, construct it for backward compatibility
      payment_method_snapshot: s.payment_method_snapshot || `${s.payment_methods?.name || 'Desconocido'}: $${s.total || 0}`
    }));
  },

  getById: async (id: string): Promise<{ header: SaleHeader; details: SaleDetail[] } | null> => {
    const { data: header, error: headerError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', id)
      .single();

    if (headerError || !header) return null;

    const { data: details, error: detailsError } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', id);

    if (detailsError) return null;

    return { header, details: details || [] };
  },

  getSaleDetails: async (saleId: string): Promise<SaleDetail[]> => {
    const { data, error } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId);

    if (error) return [];
    return data || [];
  },

  getAllDetails: async (): Promise<SaleDetail[]> => {
    const { data, error } = await supabase
      .from('sale_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all sale details:', error);
      return [];
    }
    return data || [];
  },

  updateCustomer: async (saleId: string, customerId: string, customerName: string): Promise<boolean> => {
    // Check if customer exists first or if it's just a name update? 
    // The UI passes ID and Name. We update the FK.
    const { error } = await supabase
      .from('sales')
      .update({ customer_id: customerId })
      .eq('id', saleId);

    return !error;
  },

  deleteSale: async (saleId: string): Promise<boolean> => {
    // The trigger on sale_items should handle stock reversion.
    // But we need to delete items first? No, cascade delete usually handles it, 
    // but to trigger the stock reversion on each item, we might need to delete items one by one or ensure the trigger fires on bulk delete.
    // Postgres triggers fire per row on DELETE FROM table, so verifying cascade setup.
    // Assuming cascade delete is set up on foreign keys. If not, we delete items manually.

    // To be safe and ensure stock triggers run:
    const { error: itemsError } = await supabase.from('sale_items').delete().eq('sale_id', saleId);
    if (itemsError) return false;

    const { error } = await supabase.from('sales').delete().eq('id', saleId);
    return !error;
  },

  createSale: async (
    userId: string,
    customerName: string, // Changed from customerId to match POS.tsx expectations or handle both
    items: CartItem[],
    paymentEntries: any[],
    customerId?: string
  ): Promise<{ success: boolean; saleId?: string; saleNumber?: string; error?: string }> => {
    try {
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const discount = items.reduce((sum, item) => sum + ((item.discountPerUnit || 0) * item.quantity), 0);
      const total = subtotal - discount;

      // Generate sale number
      const saleNumber = `SALE-${Date.now()}`;

      // Generate snapshot string with TYPE for proper categorization
      // Format: "TYPE|Method Name: $Amount, TYPE|Method Name: $Amount"
      // Example: "CASH|Efectivo Caja 1: $100.00, TRANSFER|Bac David: $50.00"
      const paymentSnapshot = paymentEntries
        .map(p => `${p.type}|${p.methodName}: $${p.amount.toFixed(2)}`)
        .join(', ');

      // Create sale header
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          sale_number: saleNumber,
          user_id: userId,
          customer_id: customerId || null,
          subtotal,
          discount,
          tax: 0,
          total,
          payment_method_id: paymentEntries[0]?.methodId, // FK to primary method
          payment_method_snapshot: paymentSnapshot // Store the full string with types
        })
        .select()
        .single();

      if (saleError || !sale) {
        console.error('Error creating sale:', saleError);
        return { success: false, error: saleError?.message || 'Error al crear cabecera de venta' };
      }

      // Create sale items
      const saleItems = items.map((item) => ({
        sale_id: sale.id,
        product_id: item.id,
        product_name: item.name,
        product_sku: item.sku,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) {
        console.error('Error creating sale items:', itemsError);
        return { success: false, error: itemsError.message || 'Error al crear ítems de venta' };
      }

      return { success: true, saleId: sale.id, saleNumber: sale.sale_number };
    } catch (error: any) {
      console.error('Error in sales service:', error);
      return { success: false, error: error.message || 'Error interno en el servicio de ventas' };
    }
  }
};

// ==================== INVENTORY SERVICE ====================
export const inventoryService = {
  getAllMovements: async (): Promise<InventoryMovementHeader[]> => {
    const { data, error } = await supabase
      .from('inventory_movement_headers')
      .select(`
                *,
                users (full_name)
            `)
      .order('date', { ascending: false });

    if (error) throw error;

    return (data || []).map(m => ({
      ...m,
      user_name: m.users?.full_name || 'Desconocido'
    }));
  },

  getMovementDetails: async (headerId: string): Promise<InventoryMovementDetail[]> => {
    const { data, error } = await supabase
      .from('inventory_movement_details')
      .select(`
                *,
                products (name, sku)
            `)
      .eq('header_id', headerId);

    if (error) throw error;

    return (data || []).map(d => ({
      ...d,
      product_name: d.products?.name || 'Desconocido',
      product_sku: d.products?.sku || 'N/A'
    }));
  },

  createMovement: async (
    userId: string,
    type: MovementType,
    reason: string,
    items: { productId: string; quantity: number; unitCost: number; newPrice?: number }[],
    auditSessionId?: string,
    referenceDoc?: string
  ): Promise<{ success: boolean; movementId?: string; error?: string }> => {
    try {
      const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

      // Create header
      const { data: header, error: headerError } = await supabase
        .from('inventory_movement_headers')
        .insert({
          user_id: userId,
          type,
          reason,
          reference_doc: referenceDoc,
          total_cost_impact: totalCost,
          audit_session_id: auditSessionId || null
        })
        .select()
        .single();

      if (headerError || !header) {
        console.error('Error creating movement header:', headerError);
        return { success: false, error: headerError?.message || 'Error al crear cabecera de movimiento' };
      }

      // Create details
      const details = items.map(item => ({
        header_id: header.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        new_price: item.newPrice,
        total_cost: item.quantity * item.unitCost
      }));

      const { error: detailsError } = await supabase
        .from('inventory_movement_details')
        .insert(details);

      if (detailsError) {
        console.error('Error creating movement details:', detailsError);
        return { success: false, error: detailsError.message || 'Error al crear detalle de movimiento' };
      }

      return { success: true, movementId: header.id };
    } catch (error: any) {
      console.error('Error in inventory service:', error);
      return { success: false, error: error.message || 'Error interno en el servicio de inventario' };
    }
  },

  updateMovement: async (
    movementId: string,
    userId: string,
    type: MovementType,
    reason: string,
    items: { productId: string; quantity: number; unitCost: number; newPrice?: number }[]
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Logic: For simplicity in this demo, delete old details and insert new ones
      // This is not the most efficient way but works for maintaining consistency
      // Note: In production you would want to handle stock reversal properly here

      const { error: deleteError } = await supabase
        .from('inventory_movement_details')
        .delete()
        .eq('header_id', movementId);

      if (deleteError) throw deleteError;

      const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

      const { error: headerError } = await supabase
        .from('inventory_movement_headers')
        .update({
          user_id: userId,
          type,
          reason,
          total_cost_impact: totalCost,
          date: new Date().toISOString()
        })
        .eq('id', movementId);

      if (headerError) throw headerError;

      const details = items.map(item => ({
        header_id: movementId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        new_price: item.newPrice,
        total_cost: item.quantity * item.unitCost
      }));

      const { error: detailsError } = await supabase
        .from('inventory_movement_details')
        .insert(details);

      if (detailsError) throw detailsError;

      return { success: true };
    } catch (error: any) {
      console.error('Error updating movement:', error);
      return { success: false, error: error.message || 'Error al actualizar movimiento' };
    }
  },

  deleteMovement: async (movementId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('inventory_movement_headers')
      .delete()
      .eq('id', movementId);

    return { success: !error };
  },

  deleteMovementDetail: async (detailId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('inventory_movement_details')
      .delete()
      .eq('id', detailId);

    return { success: !error };
  },

  getLastProductCost: async (productId: string): Promise<number> => {
    const product = await productService.getById(productId);
    return product?.cost || 0;
  }
};

// ==================== AUDIT SERVICE ====================
export const auditService = {
  startAuditSession: async (userId: string, type: 'PARTIAL' | 'FULL', note?: string): Promise<{ success: boolean; sessionId?: string }> => {
    const { data, error } = await supabase
      .from('audit_sessions')
      .insert({
        user_id: userId,
        type,
        status: 'OPEN',
        note
      })
      .select()
      .single();

    if (error) return { success: false };
    return { success: true, sessionId: data.id };
  },

  getParameterActiveSession: async (): Promise<AuditSession | null> => {
    const { data, error } = await supabase
      .from('audit_sessions')
      .select('*')
      .eq('status', 'OPEN')
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  },

  closeAuditSession: async (
    sessionId: string,
    summary: { systemVal: number; physicalVal: number; netVariance: number }
  ): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('audit_sessions')
      .update({
        status: 'CLOSED',
        end_date: new Date().toISOString(),
        summary_total_system_value: summary.systemVal,
        summary_total_physical_value: summary.physicalVal,
        summary_net_variance: summary.netVariance
      })
      .eq('id', sessionId);

    return { success: !error };
  },

  getAuditHistory: async (): Promise<AuditSession[]> => {
    const { data, error } = await supabase
      .from('audit_sessions')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};

// ==================== SUPPLIER SERVICE ====================
export const supplierService = {
  getAll: async (): Promise<Supplier[]> => {
    const { data, error } = await supabase.from('suppliers').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  create: async (supplier: Omit<Supplier, 'id' | 'created_at'>): Promise<{ success: boolean; id?: string }> => {
    const { data, error } = await supabase.from('suppliers').insert(supplier).select().single();
    if (error) return { success: false };
    return { success: true, id: data.id };
  },

  update: async (id: string, updates: Partial<Supplier>): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('suppliers').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    return { success: !error };
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    return { success: !error };
  }
};

// ==================== EXPENSE ACCOUNT SERVICE ====================
export const expenseAccountService = {
  getAllAccounts: async (): Promise<ExpenseAccountModel[]> => {
    const { data, error } = await supabase
      .from('expense_accounts')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  getAllSubAccounts: async (): Promise<ExpenseSubAccountModel[]> => {
    const { data, error } = await supabase
      .from('expense_sub_accounts')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  getSubAccountsByAccountId: async (accountId: string): Promise<ExpenseSubAccountModel[]> => {
    const { data, error } = await supabase
      .from('expense_sub_accounts')
      .select('*')
      .eq('account_id', accountId)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  createAccount: async (name: string, description?: string): Promise<{ success: boolean; id?: string; error?: string }> => {
    const { data, error } = await supabase
      .from('expense_accounts')
      .insert({ name, description })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  },

  createSubAccount: async (accountId: string, name: string): Promise<{ success: boolean; id?: string; error?: string }> => {
    const { data, error } = await supabase
      .from('expense_sub_accounts')
      .insert({ account_id: accountId, name })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  },

  updateAccount: async (id: string, name: string, description?: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase
      .from('expense_accounts')
      .update({ name, description, updated_at: new Date().toISOString() })
      .eq('id', id);

    return { success: !error, error: error?.message };
  },

  updateSubAccount: async (id: string, name: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase
      .from('expense_sub_accounts')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id);

    return { success: !error, error: error?.message };
  },

  deleteAccount: async (id: string): Promise<{ success: boolean; error?: string }> => {
    // Note: Database cascade delete should handle sub-accounts, but best to be safe
    const { error } = await supabase
      .from('expense_accounts')
      .delete()
      .eq('id', id);

    return { success: !error, error: error?.message };
  },

  deleteSubAccount: async (id: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase
      .from('expense_sub_accounts')
      .delete()
      .eq('id', id);

    return { success: !error, error: error?.message };
  }
};

// ==================== EXPENSE SERVICE ====================
export const expenseService = {
  getAll: async (): Promise<Expense[]> => {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
                *,
                users (full_name),
                payment_methods (name)
            `)
      .order('date', { ascending: false });

    if (error) throw error;

    return (data || []).map(e => ({
      ...e,
      total: e.amount || 0, // Map 'amount' from DB to 'total' for interface compatibility
      user_name: e.users?.full_name || 'Desconocido',
      payment_method_name: e.payment_methods?.name || 'N/A',
      // Ensure defaults for older records
      status: e.status || 'PAID',
      remaining_amount: e.remaining_amount ?? 0,
      payment_type: e.payment_type || 'CONTADO'
    }));
  },

  create: async (expense: {
    user_id: string;
    date: string;
    supplier: string;
    supplier_id?: string; // New Optional Link
    account: string;
    sub_account: string;
    total: number;
    payment_type: 'CONTADO' | 'CREDITO';
    image_url?: string;
  }): Promise<{ success: boolean; id?: string }> => {
    // Logic for debt management
    const isCredit = expense.payment_type === 'CREDITO';
    const status = isCredit ? 'PENDING' : 'PAID';
    const remaining_amount = isCredit ? expense.total : 0;

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: expense.user_id,
        date: expense.date,
        supplier: expense.supplier,
        supplier_id: expense.supplier_id || null, // Link if provided
        account: expense.account,       // Maps to Account Type
        sub_account: expense.sub_account, // Maps to SubAccount
        category: expense.account,        // Fallback for legacy
        description: `${expense.supplier} - ${expense.sub_account}`, // Fallback description
        amount: expense.total,
        payment_type: expense.payment_type,
        status: status,
        remaining_amount: remaining_amount,
        image_url: expense.image_url,
        notes: expense.sub_account // Redundancy
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating expense:', error);
      return { success: false };
    }

    // Fix: Ensure data exists before accessing id to prevent "Cannot read properties of null"
    if (!data) {
      return { success: false };
    }

    return { success: true, id: data.id };
  },

  getPayments: async (expenseId: string): Promise<ExpensePayment[]> => {
    const { data, error } = await supabase
      .from('expense_payments')
      .select('*')
      .eq('expense_id', expenseId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
    return data || [];
  },

  addPayment: async (
    expenseId: string,
    amount: number,
    note: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Get current expense state
      const { data: expense, error: fetchError } = await supabase
        .from('expenses')
        .select('remaining_amount, amount')
        .eq('id', expenseId)
        .single();

      if (fetchError || !expense) {
        console.error('Error fetching expense for payment:', fetchError);
        return {
          success: false,
          error: `Error al buscar el gasto. Detalle: ${fetchError?.message || 'El registro no existe o no tienes permiso para verlo.'} (Código: ${fetchError?.code || 'N/A'})`
        };
      }

      // 2. Insert Payment Record
      const { error: insertError } = await supabase
        .from('expense_payments')
        .insert({
          expense_id: expenseId,
          amount,
          note,
          user_id: userId,
          date: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error inserting payment:', insertError);
        return { success: false, error: `Error al guardar el abono: ${insertError.message}` };
      }

      // 3. Update Expense Status and Remaining Amount
      const newRemaining = Math.max(0, expense.remaining_amount - amount);
      const newStatus = newRemaining <= 0.01 ? 'PAID' : 'PARTIAL';

      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          remaining_amount: newRemaining,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', expenseId);

      if (updateError) {
        console.error('Error updating expense status:', updateError);
        return { success: false, error: `Error al actualizar saldo: ${updateError.message}` };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Unexpected error in addPayment:', err);
      return { success: false, error: err.message || 'Error inesperado' };
    }
  },

  getAllPayments: async (): Promise<ExpensePayment[]> => {
    const { data, error } = await supabase
      .from('expense_payments')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching all payments:', error);
      return [];
    }
    return data || [];
  },

  update: async (
    expenseId: string,
    updates: {
      date?: string;
      supplier?: string;
      supplier_id?: string;
      account?: string;
      sub_account?: string;
      total?: number;
      payment_type?: 'CONTADO' | 'CREDITO';
      image_url?: string;
    }
  ): Promise<{ success: boolean }> => {
    try {
      // Build update object
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.date !== undefined) updateData.date = updates.date;
      if (updates.supplier !== undefined) updateData.supplier = updates.supplier;
      if (updates.supplier_id !== undefined) updateData.supplier_id = updates.supplier_id || null;
      if (updates.account !== undefined) {
        updateData.account = updates.account;
        updateData.category = updates.account; // Keep legacy field in sync
      }
      if (updates.sub_account !== undefined) {
        updateData.sub_account = updates.sub_account;
        updateData.notes = updates.sub_account; // Keep legacy field in sync
      }
      if (updates.total !== undefined) updateData.amount = updates.total;
      if (updates.payment_type !== undefined) updateData.payment_type = updates.payment_type;
      if (updates.image_url !== undefined) updateData.image_url = updates.image_url;

      // Update description if supplier or sub_account changed
      if (updates.supplier || updates.sub_account) {
        // Get current expense to build description
        const { data: current } = await supabase
          .from('expenses')
          .select('supplier, sub_account')
          .eq('id', expenseId)
          .single();

        const supplier = updates.supplier || current?.supplier || '';
        const subAccount = updates.sub_account || current?.sub_account || '';
        updateData.description = `${supplier} - ${subAccount}`;
      }

      const { error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', expenseId);

      if (error) {
        console.error('Error updating expense:', error);
        return { success: false };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in update expense:', error);
      return { success: false };
    }
  },

  delete: async (expenseId: string): Promise<{ success: boolean }> => {
    try {
      // First, delete any associated payments
      const { error: paymentsError } = await supabase
        .from('expense_payments')
        .delete()
        .eq('expense_id', expenseId);

      if (paymentsError) {
        console.error('Error deleting expense payments:', paymentsError);
        return { success: false };
      }

      // Then delete the expense
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) {
        console.error('Error deleting expense:', error);
        return { success: false };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in delete expense:', error);
      return { success: false };
    }
  }
};

// ==================== USER SERVICE (for authentication) ====================
export const userService = {
  authenticate: async (email: string, password: string): Promise<User | null> => {
    try {
      // 1. Check DB for user
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.warn("User authentication failed: Not found or error", error);
        return null;
      }

      // 2. Verify password
      // If user has a password_hash, verify it
      if (data.password_hash) {
        const isValid = await bcrypt.compare(password, data.password_hash);
        if (!isValid) {
          console.warn("User authentication failed: Invalid password");
          return null;
        }
      } else {
        // Legacy or Migrated users without hash - Fail secure
        // Or if you want to allow a specific fallback, handle it here.
        // For strictly secure system:
        console.warn("User has no password set");
        return null;
      }

      return data;
    } catch (err) {
      console.error("Auth Exception:", err);
      return null;
    }
  },

  getAll: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('full_name');

    if (error) throw error;
    return data || [];
  },

  changePassword: async (userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const hash = await bcrypt.hash(newPassword, 10);
      const { error } = await supabase
        .from('users')
        .update({ password_hash: hash, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Error updating password' };
    }
  },

  create: async (user: { full_name: string; email: string; role: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!user.password || user.password.length < 4) {
        throw new Error('La contraseña es obligatoria y debe tener al menos 4 caracteres.');
      }

      const newUser: any = {
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_active: true
      };

      try {
        const hash = await bcrypt.hash(user.password, 10);
        newUser.password_hash = hash;
      } catch (bcryptError: any) {
        console.error("Bcrypt Error:", bcryptError);
        throw new Error("Error al procesar la contraseña. (Bcrypt)");
      }

      const { error } = await supabase.from('users').insert(newUser);

      if (error) {
        console.error("Supabase Insert Error:", error);
        throw new Error(error.message || "Error al insertar usuario en base de datos.");
      }

      return { success: true };
    } catch (e: any) {
      console.error("Create User Error:", e);
      throw e; // Throw to be caught by UI
    }
  },

  update: async (id: string, updates: { full_name?: string; email?: string; role?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error("Update User Error:", e);
      throw e;
    }
  },

  toggleStatus: async (id: string): Promise<void> => {
    try {
      // 1. Get current status
      const { data, error } = await supabase
        .from('users')
        .select('is_active')
        .eq('id', id)
        .single();

      if (error || !data) throw error || new Error("User not found");

      // 2. Toggle
      await supabase
        .from('users')
        .update({ is_active: !data.is_active })
        .eq('id', id);

    } catch (e) {
      console.error("Toggle Status Error:", e);
      throw e;
    }
  },

  updatePermissions: async (id: string, permissions: string[] | null): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ custom_permissions: permissions, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error("Update Permissions Error:", e);
      return { success: false, error: e.message || "Error al actualizar permisos" };
    }
  }
};

// Export mock users for reference (Legacy)
export const MOCK_USERS = [
  // Keep for reference if needed, but logic now uses DB
];

// ==================== ORDER SERVICE (Public Catalog) ====================
export const orderService = {
  create: async (order: {
    customer_name: string;
    customer_address?: string;
    customer_gps?: string;
    items: CartItem[];
    total: number;
    phone?: string;
  }): Promise<{ success: boolean; id?: string }> => {
    // Explicitly allow public insert via RLS, but we use the anon client here
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name: order.customer_name,
        customer_address: order.customer_address,
        customer_gps: order.customer_gps,
        items: order.items, // JSONB
        total: order.total,
        status: 'PENDING'
      }); // Removed .select() to avoid RLS Select error for anon

    if (error) {
      console.error('Error creating order:', error);
      return { success: false };
    }
    return { success: true }; // No ID returned for public orders, but that's fine
  },

  getAll: async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  updateStatus: async (id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED'): Promise<{ success: boolean }> => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id);

    return { success: !error };
  }
};
