import { supabase } from '../lib/supabaseClient';
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
  MovementType,
  CartItem // Added CartItem
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

// ==================== PAYMENT METHOD SERVICE ====================
export const paymentMethodService = {
  getAll: async (): Promise<PaymentMethod[]> => {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
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
                )
            `)
      .order('name');

    if (error) throw error;

    // Transform to match Product interface
    return (data || []).map(p => ({
      ...p,
      category_id: p.category_id || '',
      category_name: p.categories?.name || 'Sin categoría',
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
        brand: product.brand,
        color: product.color,
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
        color: updates.color,
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
    const { data, error } = await supabase
      .from('sales')
      .select(`
                *,
                users (full_name),
                customers (name),
                payment_methods (name)
            `)
      .order('sale_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(s => ({
      ...s,
      user_name: s.users?.full_name || 'Desconocido',
      customer_name: s.customers?.name || 'Consumidor Final',
      payment_method_name: s.payment_methods?.name || 'N/A'
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
          payment_method_id: paymentEntries[0]?.methodId // Snapshot of primary payment or handle multi-payment table if exists
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
      user_name: e.users?.full_name || 'Desconocido',
      payment_method_name: e.payment_methods?.name || 'N/A'
    }));
  },

  create: async (expense: {
    userId: string;
    category: string;
    description: string;
    amount: number;
    paymentMethodId: string;
    receiptNumber?: string;
    notes?: string;
  }): Promise<{ success: boolean; id?: string }> => {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: expense.userId,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        payment_method_id: expense.paymentMethodId,
        receipt_number: expense.receiptNumber,
        notes: expense.notes
      })
      .select()
      .single();

    if (error) return { success: false };
    return { success: true, id: data.id };
  }
};

// ==================== USER SERVICE (for authentication) ====================
export const userService = {
  authenticate: async (email: string, password: string): Promise<User | null> => {
    // Note: In production, you should use Supabase Auth
    // For now, simple password check (NOT SECURE - for demo only)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    // In production, verify password hash here
    // For now, accepting any password for demo
    return data;
  },

  getAll: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('full_name');

    if (error) throw error;
    return data || [];
  }
};

// Export mock users for login page
export const MOCK_USERS = [
  { id: 'usr-001', email: 'admin@anechka.com', full_name: 'Administrador', role: 'ADMIN' as const, is_active: true, created_at: new Date().toISOString() }
];
