
import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '../components/GlassCard';
import { salesService, productService, customerService } from '../services/supabaseService';
import { SaleHeader, SaleDetail, Product, Customer } from '../types';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// --- ICONS ---
const Icons = {
   Calendar: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>,
   Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>,
   Filter: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
   X: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>,
   Printer: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>,
   WhatsApp: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
};

export const SalesPage = () => {
   // Raw Data
   const [allSales, setAllSales] = useState<SaleHeader[]>([]);
   const [products, setProducts] = useState<Product[]>([]);
   const [customers, setCustomers] = useState<Customer[]>([]);

   // Filtered Data (Display)
   const [filteredSales, setFilteredSales] = useState<SaleHeader[]>([]);

   // UI State
   const [loading, setLoading] = useState(true);
   const [selectedSale, setSelectedSale] = useState<SaleHeader | null>(null);
   const [saleDetails, setSaleDetails] = useState<SaleDetail[]>([]);
   const [isEditing, setIsEditing] = useState(false);
   const [editCustomerId, setEditCustomerId] = useState('');

   // Filter State
   const [dateRange, setDateRange] = useState({ start: '', end: '' });
   const [searchCustomer, setSearchCustomer] = useState('');
   const [searchMethod, setSearchMethod] = useState('');

   // Analytics State
   const [stats, setStats] = useState({
      totalSales: 0,
      count: 0,
      avgTicket: 0,
      byMethod: {} as Record<string, number>,
      topCustomers: [] as { name: string, count: number, total: number }[]
   });

   useEffect(() => {
      loadData();
   }, []);

   // --- FILTERING ENGINE ---
   useEffect(() => {
      let result = [...allSales]; // Create a copy to avoid mutating original state

      // 1. Filter by Date Range
      if (dateRange.start) {
         const start = new Date(dateRange.start);
         start.setHours(0, 0, 0, 0);
         result = result.filter(s => new Date(s.created_at) >= start);
      }
      if (dateRange.end) {
         const end = new Date(dateRange.end);
         end.setHours(23, 59, 59, 999);
         result = result.filter(s => new Date(s.created_at) <= end);
      }

      // 2. Filter by Customer Name
      if (searchCustomer) {
         const term = searchCustomer.toLowerCase();
         result = result.filter(s => (s.customer_name || '').toLowerCase().includes(term));
      }

      // 3. Filter by Payment Method
      if (searchMethod) {
         const term = searchMethod.toLowerCase();
         result = result.filter(s => s.payment_method_snapshot.toLowerCase().includes(term));
      }

      // 4. SORTING: Descending by Timestamp (Newest first)
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setFilteredSales(result);
      calculateStats(result);
   }, [allSales, dateRange, searchCustomer, searchMethod]);

   const loadData = async () => {
      setLoading(true);
      const [salesData, productsData, customersData] = await Promise.all([
         salesService.getSalesHistory(),
         productService.getAll(),
         customerService.getAll()
      ]);

      setAllSales(salesData);
      setProducts(productsData);
      setCustomers(customersData);
      setLoading(false);
   };

   const calculateStats = (data: SaleHeader[]) => {
      let total = 0;
      let methodStats: Record<string, number> = {};
      let customerStats: Record<string, { count: number, total: number }> = {};

      data.forEach(sale => {
         total += sale.total_amount;

         const snapshot = sale.payment_method_snapshot || '';
         const parts = snapshot.split(', ');

         parts.forEach(part => {
            const [method, amountStr] = part.split(': ');
            if (method && amountStr) {
               const cleanMethod = method.trim();
               const amount = parseFloat(amountStr.replace('$', ''));
               methodStats[cleanMethod] = (methodStats[cleanMethod] || 0) + amount;
            }
         });

         const custName = sale.customer_name || 'Desconocido';
         if (!customerStats[custName]) customerStats[custName] = { count: 0, total: 0 };
         customerStats[custName].count += 1;
         customerStats[custName].total += sale.total_amount;
      });

      const sortedCustomers = Object.entries(customerStats)
         .map(([name, data]) => ({ name, ...data }))
         .sort((a, b) => b.total - a.total)
         .slice(0, 3);

      setStats({
         totalSales: total,
         count: data.length,
         avgTicket: data.length > 0 ? total / data.length : 0,
         byMethod: methodStats,
         topCustomers: sortedCustomers
      });
   };

   const handleViewDetails = async (sale: SaleHeader) => {
      setLoading(true);
      const details = await salesService.getSaleDetails(sale.id);
      setSaleDetails(details);
      setSelectedSale(sale);
      setLoading(false);
   };

   const clearFilters = () => {
      setDateRange({ start: '', end: '' });
      setSearchCustomer('');
      setSearchMethod('');
   };

   // --- PDF EXPORT LOGIC ---
   const handleExportPDF = () => {
      const doc = new jsPDF();
      const primaryColor: [number, number, number] = [139, 92, 246]; // Violet Brand
      const grayColor = [100, 116, 139];

      // 1. Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Tienda Anechka - Reporte de Ventas", 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.setFont("helvetica", "normal");
      doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);

      // 2. Context (Filters)
      let filterText = "Filtro Aplicado: ";
      const activeFilters = [];
      if (dateRange.start || dateRange.end) activeFilters.push(`Período: ${dateRange.start || 'Inicio'} a ${dateRange.end || 'Hoy'}`);
      if (searchCustomer) activeFilters.push(`Cliente: "${searchCustomer}"`);
      if (searchMethod) activeFilters.push(`Método: "${searchMethod}"`);

      filterText += activeFilters.length > 0 ? activeFilters.join(" | ") : "Histórico Completo";

      doc.text(filterText, 14, 34);

      // 3. Financial Summary (KPIs) Box
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 40, 182, 24, 3, 3, 'FD');

      doc.setFontSize(10);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text("Ventas Totales", 20, 48);
      doc.text("Transacciones", 90, 48);
      doc.text("Ticket Promedio", 150, 48);

      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(`$${stats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 20, 58);
      doc.text(`${stats.count}`, 90, 58);
      doc.text(`$${stats.avgTicket.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 150, 58);

      // 4. Analysis by Method (Small Table)
      let finalY = 70;

      doc.setFontSize(12);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Desglose por Método de Pago", 14, finalY);

      const methodData = Object.entries(stats.byMethod).map(([method, total]) => [
         method,
         `$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
         `${((total / stats.totalSales) * 100).toFixed(1)}%`
      ]);

      autoTable(doc, {
         startY: finalY + 5,
         head: [['Método / Canal', 'Monto Total', '% Participación']],
         body: methodData,
         theme: 'grid',
         headStyles: { fillColor: [243, 244, 246], textColor: [50, 50, 50], fontSize: 9 },
         bodyStyles: { fontSize: 9 },
         columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 40, halign: 'right' },
            2: { cellWidth: 40, halign: 'right' }
         },
         margin: { left: 14, right: 14 }
      });

      // @ts-ignore
      finalY = doc.lastAutoTable.finalY + 15;

      // 5. Detailed Transactions Table
      doc.setFontSize(12);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Detalle de Transacciones", 14, finalY);

      const tableRows = filteredSales.map(sale => [
         sale.id,
         new Date(sale.created_at).toLocaleDateString() + ' ' + new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
         sale.customer_name || 'Consumidor Final',
         sale.payment_method_snapshot,
         `$${sale.total_amount.toFixed(2)}`,
         sale.status
      ]);

      autoTable(doc, {
         startY: finalY + 5,
         head: [['Ticket ID', 'Fecha', 'Cliente', 'Detalle Pagos', 'Total', 'Estado']],
         body: tableRows,
         theme: 'striped',
         headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8 },
         bodyStyles: { fontSize: 8 },
         columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 30 },
            2: { cellWidth: 40 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
            5: { cellWidth: 20, halign: 'center' }
         },
         margin: { left: 14, right: 14 }
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
         doc.setPage(i);
         doc.setFontSize(8);
         doc.setTextColor(150);
         doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
      }

      doc.save(`Reporte_Ventas_${new Date().toISOString().split('T')[0]}.pdf`);
   };

   const handleUpdateCustomer = async () => {
      if (!selectedSale) return;
      const cust = customers.find(c => c.id === editCustomerId);

      // If no customer selected (maybe clearing it?), or just keeping name if not found? 
      // The requirement is to change customer. 
      // If cust found, user ID + Name. If not, maybe just ID? 
      // Let's assume user picks from dropdown corresponding to `customers`.

      if (cust) {
         const success = await salesService.updateCustomer(selectedSale.id, cust.id, cust.full_name);
         if (success) {
            alert("Cliente actualizado correctamente");
            setIsEditing(false);
            loadData(); // Reload to reflect changes
            setSelectedSale(null); // Close modal
         } else {
            alert("Error al actualizar");
         }
      }
   };

   const handleDeleteSale = async () => {
      if (!selectedSale) return;
      if (window.confirm("¿Está seguro de eliminar esta venta? Esto revertirá el stock de los productos.")) {
         const success = await salesService.deleteSale(selectedSale.id);
         if (success) {
            alert("Venta eliminada y stock revertido.");
            loadData();
            setSelectedSale(null);
         } else {
            alert("Error al eliminar venta.");
         }
      }
   };

   const handleSendWhatsApp = () => {
      if (!selectedSale) return;

      let message = `Hola *${selectedSale.customer_name || 'Cliente'}*, gracias por tu compra en Tienda Anechka.\n\n`;
      message += `*Detalle de Venta #${selectedSale.id}*\n`;
      message += `Fecha: ${new Date(selectedSale.created_at).toLocaleString()}\n\n`;

      saleDetails.forEach(d => {
         const productName = getProductName(d.product_id);
         message += `• ${d.quantity} x ${productName} - $${d.subtotal.toFixed(2)}\n`;
      });

      message += `\n*Total Pagado: $${selectedSale.total_amount.toFixed(2)}*`;
      message += `\n\n¡Esperamos verte pronto!`;

      const encoded = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
   };

   const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;

   const availableMethods = useMemo(() => {
      const methods = new Set<string>();
      allSales.forEach(s => {
         const parts = s.payment_method_snapshot.split(', ');
         parts.forEach(p => {
            const name = p.split(':')[0]?.trim();
            if (name) methods.add(name);
         });
      });
      return Array.from(methods).sort();
   }, [allSales]);

   return (
      <div className="space-y-6 animate-fade-in-up">
         <header className="flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div>
               <h2 className="text-3xl font-bold text-gray-800">Historial de Ventas</h2>
               <p className="text-gray-500">Auditoría de transacciones y análisis financiero.</p>
            </div>

            <button
               onClick={handleExportPDF}
               className="bg-brand-primary hover:bg-brand-secondary text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-brand-primary/20 transition-all flex items-center gap-2 transform active:scale-95"
            >
               <Icons.Printer /> Generar Reporte PDF
            </button>
         </header>

         {/* --- FILTER BAR --- */}
         <GlassCard className="p-4 bg-white/60">
            <div className="flex flex-col lg:flex-row gap-4 items-end">
               <div className="flex gap-2 w-full lg:w-auto">
                  <div className="flex-1">
                     <label className="block text-xs font-bold text-gray-500 mb-1">Desde</label>
                     <div className="relative">
                        <input
                           type="date"
                           value={dateRange.start}
                           onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                           className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm text-gray-600"
                        />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Calendar /></div>
                     </div>
                  </div>
                  <div className="flex-1">
                     <label className="block text-xs font-bold text-gray-500 mb-1">Hasta</label>
                     <div className="relative">
                        <input
                           type="date"
                           value={dateRange.end}
                           onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                           className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm text-gray-600"
                        />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Calendar /></div>
                     </div>
                  </div>
               </div>

               <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Cliente</label>
                  <div className="relative">
                     <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={searchCustomer}
                        onChange={e => setSearchCustomer(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                     />
                     <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></div>
                  </div>
               </div>

               <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Método de Pago</label>
                  <div className="relative">
                     <select
                        value={searchMethod}
                        onChange={e => setSearchMethod(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none text-sm appearance-none text-gray-600"
                     >
                        <option value="">Todos</option>
                        {availableMethods.map(m => (
                           <option key={m} value={m}>{m}</option>
                        ))}
                     </select>
                     <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Filter /></div>
                  </div>
               </div>

               {(dateRange.start || dateRange.end || searchCustomer || searchMethod) && (
                  <button
                     onClick={clearFilters}
                     className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors flex items-center gap-2 mb-[1px]"
                  >
                     <Icons.X /> Limpiar
                  </button>
               )}
            </div>
         </GlassCard>

         {/* --- ANALYTICS SCORECARDS --- */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlassCard className="flex flex-col justify-center relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
               </div>
               <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ventas (Selección)</span>
               <div className="text-4xl font-black text-brand-primary mb-1 relative z-10">
                  ${stats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
               </div>
               <div className="flex gap-4 text-xs text-gray-600 mt-2 relative z-10">
                  <span><strong>{stats.count}</strong> Tickets</span>
                  <span><strong>${stats.avgTicket.toFixed(2)}</strong> Promedio</span>
               </div>
            </GlassCard>

            <GlassCard className="flex flex-col">
               <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Ventas por Método</span>
               <div className="flex-1 space-y-2 overflow-y-auto max-h-32 pr-2 scrollbar-thin">
                  {Object.entries(stats.byMethod).map(([method, amount]) => (
                     <div key={method} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 font-medium truncate max-w-[120px]" title={method}>{method}</span>
                        <div className="flex items-center gap-2">
                           <div className="h-2 bg-gray-200 rounded-full w-16 overflow-hidden">
                              <div
                                 className="h-full bg-brand-accent"
                                 style={{ width: `${stats.totalSales > 0 ? (amount / stats.totalSales) * 100 : 0}%` }}
                              />
                           </div>
                           <span className="font-bold text-gray-900 w-16 text-right">${amount.toFixed(0)}</span>
                        </div>
                     </div>
                  ))}
                  {Object.keys(stats.byMethod).length === 0 && <p className="text-xs text-gray-400 italic">No hay datos para esta selección.</p>}
               </div>
            </GlassCard>

            <GlassCard className="flex flex-col">
               <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Mejores Clientes</span>
               <div className="space-y-3">
                  {stats.topCustomers.map((cust, idx) => (
                     <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-1 last:border-0">
                        <div className="flex items-center gap-2">
                           <span className={`
                           w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white
                           ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : 'bg-orange-400'}
                        `}>
                              {idx + 1}
                           </span>
                           <span className="font-medium text-gray-800 truncate max-w-[100px]">{cust.name}</span>
                        </div>
                        <div className="text-right">
                           <span className="block font-bold text-green-600">${cust.total.toFixed(0)}</span>
                           <span className="block text-[10px] text-gray-400">{cust.count} compras</span>
                        </div>
                     </div>
                  ))}
                  {stats.topCustomers.length === 0 && <p className="text-xs text-gray-400 italic">No hay datos.</p>}
               </div>
            </GlassCard>
         </div>

         {/* --- SALES TABLE --- */}
         <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-white/50 text-gray-500 font-semibold border-b border-gray-200">
                     <tr>
                        <th className="py-3 px-4 w-28">Ticket ID</th>
                        {/* Increased Date Column */}
                        <th className="py-3 px-4 w-32">Fecha</th>
                        {/* Increased Customer Column Width */}
                        <th className="py-3 px-4 min-w-[200px]">Cliente</th>
                        {/* Increased Payment Column Width */}
                        <th className="py-3 px-4 min-w-[250px]">Métodos de Pago</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                     {filteredSales.length === 0 ? (
                        <tr><td colSpan={7} className="py-12 text-center text-gray-400">No se encontraron ventas con los filtros actuales.</td></tr>
                     ) : (
                        filteredSales.map(sale => (
                           <tr key={sale.id} className="hover:bg-white/40 transition-colors group">
                              <td className="py-3 px-4 font-mono text-gray-600 font-bold text-xs">{sale.id}</td>
                              <td className="py-3 px-4">
                                 <div className="flex flex-col">
                                    <span className="font-bold text-gray-700 text-xs">
                                       {new Date(sale.created_at).toLocaleDateString()}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                       {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                 </div>
                              </td>
                              <td className="py-3 px-4 font-medium text-gray-800 break-words whitespace-normal">{sale.customer_name}</td>
                              <td className="py-3 px-4">
                                 <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200 inline-block whitespace-normal">
                                    {sale.payment_method_snapshot}
                                 </span>
                              </td>
                              <td className="py-3 px-4 text-right font-black text-gray-800">${sale.total_amount.toFixed(2)}</td>
                              <td className="py-3 px-4 text-center">
                                 <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase">
                                    {sale.status === 'COMPLETED' ? 'Completado' : sale.status}
                                 </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                 <button
                                    onClick={() => handleViewDetails(sale)}
                                    className="text-brand-primary hover:text-brand-secondary p-1 font-bold text-xs border border-brand-primary/30 rounded px-2 hover:bg-brand-primary/10 transition-colors"
                                 >
                                    Ver Detalle
                                 </button>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </GlassCard>

         {/* --- DETAIL MODAL --- */}
         {selectedSale && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedSale(null)}>
               <GlassCard className="w-full max-w-lg bg-white border-white shadow-2xl flex flex-col max-h-[90vh]" onClick={(e: any) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                     <div>
                        <h3 className="text-xl font-bold text-gray-800">Detalle de Venta</h3>
                        <p className="text-xs text-gray-500 font-mono">{selectedSale.id} • {new Date(selectedSale.created_at).toLocaleString()}</p>
                     </div>
                     <button onClick={() => setSelectedSale(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                  </div>

                  <div className="flex-1 overflow-y-auto mb-4 pr-1">
                     <table className="w-full text-sm">
                        <thead className="text-gray-500 text-xs uppercase border-b border-gray-100">
                           <tr>
                              <th className="text-left py-2">Producto</th>
                              <th className="text-center py-2">Cant.</th>
                              <th className="text-right py-2">P. Unit</th>
                              <th className="text-right py-2">Total</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                           {saleDetails.map(detail => (
                              <tr key={detail.id}>
                                 <td className="py-3 font-medium text-gray-800">{getProductName(detail.product_id)}</td>
                                 <td className="py-3 text-center text-gray-600">{detail.quantity}</td>
                                 <td className="py-3 text-right text-gray-600">${detail.unit_price.toFixed(2)}</td>
                                 <td className="py-3 text-right font-bold text-gray-800">${detail.subtotal.toFixed(2)}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  <div className="border-t border-gray-100 pt-4 bg-gray-50 -m-6 mt-0 p-6 rounded-b-2xl">
                     <div className="flex justify-between items-center text-sm mb-3">
                        <span className="text-gray-500">Cliente</span>
                        {isEditing ? (
                           <div className="flex gap-2">
                              <select
                                 value={editCustomerId}
                                 onChange={e => setEditCustomerId(e.target.value)}
                                 className="border rounded px-2 py-1 text-xs"
                              >
                                 <option value="">Seleccionar Cliente</option>
                                 {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.full_name}</option>
                                 ))}
                              </select>
                              <button onClick={handleUpdateCustomer} className="text-green-600 font-bold text-xs">Guardar</button>
                              <button onClick={() => setIsEditing(false)} className="text-red-400 text-xs">Cancelar</button>
                           </div>
                        ) : (
                           <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-800">{selectedSale.customer_name || 'Consumidor Final'}</span>
                              <button
                                 onClick={() => {
                                    setIsEditing(true);
                                    // Try to find current customer ID or matching name
                                    const existing = customers.find(c => c.full_name === selectedSale.customer_name);
                                    setEditCustomerId(selectedSale.customer_id || existing?.id || '');
                                 }}
                                 className="text-blue-500 hover:text-blue-700"
                                 title="Editar Cliente"
                              >
                                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                              </button>
                           </div>
                        )}
                     </div>
                     <div className="flex justify-between items-center text-sm mb-4">
                        <span className="text-gray-500">Pagos</span>
                        <span className="font-medium text-gray-800 text-right">{selectedSale.payment_method_snapshot}</span>
                     </div>
                     <div className="flex justify-between items-center text-xl font-black text-brand-primary pt-2 border-t border-gray-200 mb-4">
                        <span>Total Pagado</span>
                        <span>${selectedSale.total_amount.toFixed(2)}</span>
                     </div>

                     <div className="flex gap-2 mb-2">
                        <button
                           onClick={handleSendWhatsApp}
                           className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                        >
                           <Icons.WhatsApp /> Enviar Detalle por WhatsApp
                        </button>
                     </div>

                     <button
                        onClick={handleDeleteSale}
                        className="w-full text-red-500 border border-red-200 hover:bg-red-50 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                     >
                        <Icons.X /> Eliminar Venta y Revertir Stock
                     </button>
                  </div>
               </GlassCard>
            </div>
         )}
      </div>
   );
};
