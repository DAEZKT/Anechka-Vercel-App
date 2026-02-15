import React, { useEffect, useState, useMemo } from 'react';
import { GlassCard } from '../components/GlassCard';
import { productService, salesService, expenseService } from '../services/supabaseService';
import { Product, SaleHeader, Expense, User, SaleDetail } from '../types';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
   BarChart,
   Bar,
   XAxis,
   YAxis,
   CartesianGrid,
   Tooltip,
   Legend,
   ResponsiveContainer,
   PieChart,
   Pie,
   Cell
} from 'recharts';

interface DashboardProps {
   user?: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
   const [loading, setLoading] = useState(true);
   const [products, setProducts] = useState<Product[]>([]);
   const [sales, setSales] = useState<SaleHeader[]>([]);
   const [expenses, setExpenses] = useState<Expense[]>([]);
   const [saleDetails, setSaleDetails] = useState<SaleDetail[]>([]);

   // Date Filter State
   const [dateRange, setDateRange] = useState(() => {
      // Initialize with Local Date Strings (YYYY-MM-DD)
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

      // Helper to get local YYYY-MM-DD
      const toLocalISO = (d: Date) => {
         const year = d.getFullYear();
         const month = String(d.getMonth() + 1).padStart(2, '0');
         const day = String(d.getDate()).padStart(2, '0');
         return `${year}-${month}-${day}`;
      };

      return {
         start: toLocalISO(firstDay),
         end: toLocalISO(now)
      };
   });

   useEffect(() => {
      loadBaseData();
   }, []);

   const loadBaseData = async () => {
      setLoading(true);
      try {
         const [prodData, salesData, expData, detailsData] = await Promise.all([
            productService.getAll(),
            salesService.getSalesHistory(),
            expenseService.getAll(),
            salesService.getAllDetails()
         ]);
         setProducts(prodData);
         setSales(salesData);
         setExpenses(expData);
         setSaleDetails(detailsData);
      } catch (error) {
         console.error("Error loading dashboard base data", error);
      } finally {
         setLoading(false);
      }
   };

   // --- MEMOIZED CALCULATIONS BASED ON DATE RANGE ---

   const filteredData = useMemo(() => {
      const startStr = dateRange.start;
      const endStr = dateRange.end;

      const getLocalYMD = (dateInput: string | Date) => {
         if (!dateInput) return '';
         // If it's already YYYY-MM-DD string (common in expenses), return it directly to avoid TZ shifts
         if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return dateInput;
         }
         const d = new Date(dateInput);
         const year = d.getFullYear();
         const month = String(d.getMonth() + 1).padStart(2, '0');
         const day = String(d.getDate()).padStart(2, '0');
         return `${year}-${month}-${day}`;
      };

      const filteredSales = sales.filter(s => {
         const dateStr = getLocalYMD(s.created_at);
         return dateStr >= startStr && dateStr <= endStr;
      });

      const filteredExpenses = expenses.filter(e => {
         const dateStr = getLocalYMD(e.date);
         return dateStr >= startStr && dateStr <= endStr;
      });

      const salesIds = new Set(filteredSales.map(s => s.id));
      const filteredDetails = saleDetails.filter(d => salesIds.has(d.sale_id));

      return { sales: filteredSales, expenses: filteredExpenses, details: filteredDetails };
   }, [sales, expenses, saleDetails, dateRange]);

   const financials = useMemo(() => {
      const revenue = filteredData.sales.reduce((sum, s) => sum + s.total_amount, 0);
      const outcome = filteredData.expenses.reduce((sum, e) => sum + e.total, 0);
      const profit = revenue - outcome;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { revenue, outcome, profit, margin };
   }, [filteredData]);

   const dailyData = useMemo(() => {
      const dataMap = new Map<string, { date: string, income: number, expense: number }>();

      // Iterate through all days in range for continuous chart
      const start = new Date(dateRange.start + 'T00:00:00');
      const end = new Date(dateRange.end + 'T00:00:00'); // Time doesn't matter for iteration count

      // Safety check: if range is invalid or too huge, limit it?
      // Assuming standard usage.

      // Helper to format map keys as YYYY-MM-DD
      const toYMD = (d: Date) => {
         const year = d.getFullYear();
         const month = String(d.getMonth() + 1).padStart(2, '0');
         const day = String(d.getDate()).padStart(2, '0');
         return `${year}-${month}-${day}`;
      };

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
         const dateStr = toYMD(d);
         const displayDate = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
         dataMap.set(dateStr, { date: displayDate, income: 0, expense: 0 });
      }

      // If dataMap is empty (single day range), add the single day
      if (dataMap.size === 0) {
         const d = new Date(dateRange.start + 'T00:00:00');
         const dateStr = toYMD(d);
         const displayDate = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
         dataMap.set(dateStr, { date: displayDate, income: 0, expense: 0 });
      }

      filteredData.sales.forEach(s => {
         // Use getLocalYMD logic again or rely on map keys
         // s.created_at is UTC ISO usually. new Date() gives local.
         const d = new Date(s.created_at);
         const dateKey = toYMD(d);

         if (dataMap.has(dateKey)) {
            dataMap.get(dateKey)!.income += s.total_amount;
         }
      });

      filteredData.expenses.forEach(e => {
         // e.date might be YYYY-MM-DD string
         let dateKey = '';
         if (typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
            dateKey = e.date;
         } else {
            dateKey = toYMD(new Date(e.date));
         }

         if (dataMap.has(dateKey)) {
            dataMap.get(dateKey)!.expense += e.total;
         }
      });

      return Array.from(dataMap.values());
   }, [filteredData, dateRange]);

   const categoryData = useMemo(() => {
      const catMap: Record<string, number> = {};
      filteredData.details.forEach(d => {
         const product = products.find(p => p.id === d.product_id);
         const catName = product?.category_name || 'Sin Categoría';
         catMap[catName] = (catMap[catName] || 0) + d.subtotal;
      });

      return Object.entries(catMap)
         .map(([name, value]) => ({ name, value }))
         .sort((a, b) => b.value - a.value)
         .slice(0, 5); // Top 5
   }, [filteredData, products]);

   const cleanMethodName = (name: string) => {
      if (!name) return 'Desconocido';
      return name.includes('|') ? name.split('|')[1].trim() : name;
   };

   const paymentMethodData = useMemo(() => {
      const pmMap: Record<string, number> = {};
      filteredData.sales.forEach(s => {
         const raw = s.payment_method_name || 'Desconocido';
         const method = cleanMethodName(raw);
         pmMap[method] = (pmMap[method] || 0) + s.total_amount;
      });
      return Object.entries(pmMap)
         .map(([name, value]) => ({ name, value }))
         .sort((a, b) => b.value - a.value);
   }, [filteredData]);


   const topProducts = useMemo(() => {
      const prodMap: Record<string, { qty: number, total: number }> = {};
      filteredData.details.forEach(d => {
         if (!prodMap[d.product_id]) {
            prodMap[d.product_id] = { qty: 0, total: 0 };
         }
         prodMap[d.product_id].qty += d.quantity;
         prodMap[d.product_id].total += d.subtotal;
      });

      return Object.entries(prodMap)
         .map(([id, stats]) => {
            const product = products.find(p => p.id === id);
            return {
               name: product?.name || 'Desconocido',
               qty: stats.qty,
               total: stats.total
            };
         })
         .sort((a, b) => b.total - a.total)
         .slice(0, 5);
   }, [filteredData, products]);

   const lowStockItems = useMemo(() => {
      // Stock is current state, not historical. So we look at products directly.
      return products
         .filter(p => p.stock_level <= p.min_stock)
         .sort((a, b) => a.stock_level - b.stock_level)
         .slice(0, 5);
   }, [products]);


   // --- PDF GENERATION ---
   const generateExecutiveReport = () => {
      const doc = new jsPDF();
      const violet = [139, 92, 246];
      const darkText = [31, 41, 55];
      const lightText = [107, 114, 128];

      // --- HEADER ---
      doc.setFillColor(violet[0], violet[1], violet[2]);
      doc.rect(0, 0, 210, 5, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(darkText[0], darkText[1], darkText[2]);
      doc.text("Reporte Ejecutivo Empresarial", 14, 25);

      doc.setFontSize(10);
      doc.setTextColor(lightText[0], lightText[1], lightText[2]);
      doc.setFont("helvetica", "normal");
      doc.text("Tienda Anechka - POS & ERP System", 14, 31);
      doc.text(`Periodo Analizado: ${dateRange.start} al ${dateRange.end}`, 14, 36);

      const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Generado: ${today}`, 196, 25, { align: 'right' });
      doc.text(`Usuario: ${user?.full_name || 'Sistema'}`, 196, 31, { align: 'right' });

      // --- FINANCIAL SUMMARY ---
      let y = 45;
      doc.setFontSize(14);
      doc.setTextColor(violet[0], violet[1], violet[2]);
      doc.setFont("helvetica", "bold");
      doc.text("1. Resumen Financiero", 14, y);

      y += 10;
      // Draw simple KPI table
      autoTable(doc, {
         startY: y,
         head: [['Concepto', 'Monto', 'Indicador']],
         body: [
            ['Ingresos Totales (Ventas)', `$${financials.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, '100%'],
            ['Egresos Operativos', `$${financials.outcome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, `${(financials.revenue > 0 ? (financials.outcome / financials.revenue) * 100 : 0).toFixed(1)}%`],
            ['Utilidad Neta', `$${financials.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, `${financials.margin.toFixed(1)}%`],
         ],
         theme: 'grid',
         headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
         columnStyles: {
            1: { halign: 'right', fontStyle: 'bold' },
            2: { halign: 'center', fontSize: 8 }
         },
         styles: { fontSize: 10, cellPadding: 3 },
      });

      // @ts-ignore
      y = doc.lastAutoTable.finalY + 15;

      // --- CATEGORY ANALYSIS ---
      doc.setFontSize(14);
      doc.setTextColor(violet[0], violet[1], violet[2]);
      doc.text("2. Ventas por Categoría", 14, y);
      y += 5;

      autoTable(doc, {
         startY: y,
         head: [['Categoría', 'Venta Total', '% Participación']],
         body: categoryData.map(c => [
            c.name,
            `$${c.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            `${(financials.revenue > 0 ? (c.value / financials.revenue) * 100 : 0).toFixed(1)}%`
         ]),
         theme: 'striped',
         headStyles: { fillColor: [249, 250, 251], textColor: [55, 65, 81] },
         columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' } },
         styles: { fontSize: 9 }
      });

      // @ts-ignore
      y = doc.lastAutoTable.finalY + 15;

      // --- PAYMENT METHODS ---
      doc.setFontSize(14);
      doc.setTextColor(violet[0], violet[1], violet[2]);
      doc.text("3. Métodos de Pago", 14, y);
      y += 5;

      autoTable(doc, {
         startY: y,
         head: [['Método', 'Total Recaudado', '%']],
         body: paymentMethodData.map(p => [
            p.name,
            `$${p.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            `${(financials.revenue > 0 ? (p.value / financials.revenue) * 100 : 0).toFixed(1)}%`
         ]),
         theme: 'plain',
         headStyles: { fillColor: [255, 255, 255], textColor: [55, 65, 81], lineColor: [200, 200, 200], lineWidth: { bottom: 0.1 } },
         columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' } },
         styles: { fontSize: 9 }
      });

      // @ts-ignore
      y = doc.lastAutoTable.finalY + 15;

      // --- TOP PRODUCTS ---
      doc.setFontSize(14);
      doc.setTextColor(violet[0], violet[1], violet[2]);
      doc.text("4. Top 5 Productos", 14, y);
      y += 5;

      autoTable(doc, {
         startY: y,
         head: [['Producto', 'Unidades', 'Venta Total']],
         body: topProducts.map(p => [
            p.name,
            p.qty,
            `$${p.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
         ]),
         // ... styles
      });

      // Save
      doc.save(`Reporte_Ejecutivo_${dateRange.start}_${dateRange.end}.pdf`);
   };

   // COLORS for CHARTS
   const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6'];

   const getTimeGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Buenos días';
      if (hour < 18) return 'Buenas tardes';
      return 'Buenas noches';
   };

   return (
      <div className="space-y-6 animate-fade-in-up pb-10">
         {/* HEADER & FILTERS */}
         {/* HEADER & FILTERS */}
         <header className="flex flex-col xl:flex-row justify-between xl:items-end gap-6 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div>
               <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">{getTimeGreeting()}, {user?.full_name.split(' ')[0] || 'Gerencia'}.</h2>
               <p className="text-sm md:text-base text-gray-500 font-medium">Tablero de Control y Análisis Financiero.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
               <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative group w-full sm:w-auto">
                     <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-violet-500 transition-colors pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                     </div>
                     <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
                        className="w-full sm:w-auto pl-10 pr-4 py-2.5 bg-white border border-gray-200 hover:border-violet-300 rounded-xl text-sm font-bold text-gray-600 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm outline-none cursor-pointer appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                     />
                  </div>

                  <span className="text-gray-300 font-bold hidden sm:inline">➜</span>

                  <div className="relative group w-full sm:w-auto">
                     <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-violet-500 transition-colors pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                     </div>
                     <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
                        className="w-full sm:w-auto pl-10 pr-4 py-2.5 bg-white border border-gray-200 hover:border-violet-300 rounded-xl text-sm font-bold text-gray-600 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm outline-none cursor-pointer appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                     />
                  </div>
               </div>

               <button
                  onClick={generateExecutiveReport}
                  disabled={loading}
                  className="w-full sm:w-auto justify-center bg-violet-600 hover:bg-violet-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-violet-500/30 transition-all flex items-center gap-2 transform active:scale-95 text-sm"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                  Exportar PDF
               </button>
            </div>
         </header>

         {/* KPI GRID */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
               title="Utilidad Neta"
               value={`$${financials.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
               trend={financials.profit >= 0 ? "Rentable" : "Déficit"}
               icon="wallet"
               color={financials.profit >= 0 ? "green" : "red"}
               isAlert={financials.profit < 0}
            />
            <KPICard
               title="Ventas Totales"
               value={`$${financials.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
               trend={`${filteredData.sales.length} transacciones`}
               icon="dollar"
               color="blue"
            />
            <KPICard
               title="Gastos Operativos"
               value={`$${financials.outcome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
               trend={`${filteredData.expenses.length} registros`}
               icon="arrowDown"
               color="orange"
            />
            <KPICard
               title="Margen Periodo"
               value={`${financials.margin.toFixed(1)}%`}
               trend="Retorno s/Venta"
               icon="percent"
               color={financials.margin > 20 ? "purple" : "gray"}
            />
         </div>

         {/* CHARTS ROW 1 */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SALES TREND CHART */}
            <GlassCard className="lg:col-span-2 min-h-[350px] md:min-h-[400px] flex flex-col p-4 md:p-6">
               <h3 className="font-bold text-lg text-gray-800 mb-4">Tendencia de Ingresos vs Egresos</h3>
               <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} minTickGap={30} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                        <Tooltip
                           contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                           cursor={{ fill: '#F3F4F6' }}
                           formatter={(value: any) => [`$${value.toLocaleString()}`, undefined]}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar name="Ingresos" dataKey="income" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        <Bar name="Egresos" dataKey="expense" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={50} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </GlassCard>

            {/* CATEGORY DONUT CHART */}
            <GlassCard className="lg:col-span-1 min-h-[400px] flex flex-col p-6">
               <h3 className="font-bold text-lg text-gray-800 mb-4">Ventas por Categoría</h3>
               <div className="flex-1 w-full min-h-0 flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height={300}>
                     <PieChart>
                        <Pie
                           data={categoryData}
                           cx="50%"
                           cy="50%"
                           innerRadius={60}
                           outerRadius={80}
                           paddingAngle={5}
                           dataKey="value"
                        >
                           {categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => `$${value.toLocaleString()}`} />
                        <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                     </PieChart>
                  </ResponsiveContainer>
                  {categoryData.length === 0 && <p className="absolute text-gray-400 text-sm">Sin datos</p>}
               </div>
            </GlassCard>
         </div>

         {/* CHARTS ROW 2: DETAILS */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TOP PRODUCTS */}
            <GlassCard className="p-4 md:p-6">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg text-gray-800">Productos Estrella</h3>
                  <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-md">Top 5</span>
               </div>
               <div className="space-y-4">
                  {topProducts.map((p, idx) => (
                     <div key={idx} className="flex items-center justify-between group cursor-default hover:bg-gray-50/50 p-2 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                              {idx + 1}
                           </div>
                           <div>
                              <p className="font-bold text-gray-700 text-sm">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.qty} unidades vendidas</p>
                           </div>
                        </div>
                        <span className="font-bold text-gray-800 text-sm">${p.total.toLocaleString()}</span>
                     </div>
                  ))}
                  {topProducts.length === 0 && <p className="text-gray-400 italic text-sm text-center py-4">No hay ventas en este periodo</p>}
               </div>
            </GlassCard>

            {/* STOCK ALERTS (ALWAYS RELEVANT) */}
            <GlassCard className="p-4 md:p-6 bg-red-50/30 border-red-100/50">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg text-red-800">Alertas de Stock</h3>
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-md">Crítico</span>
               </div>
               <div className="space-y-3">
                  {lowStockItems.map((p, idx) => (
                     <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-red-100 shadow-sm">
                        <div className="flex-1 min-w-0 pr-4">
                           <p className="font-bold text-gray-700 text-sm truncate">{p.name}</p>
                           <p className="text-xs text-red-400 font-medium whitespace-nowrap">Stock Mínimo: {p.min_stock}</p>
                        </div>
                        <div className="text-right shrink-0">
                           <span className="block text-xl md:text-2xl font-black text-red-500 leading-none">{p.stock_level}</span>
                           <span className="text-[10px] text-gray-400 uppercase font-bold">Unidades</span>
                        </div>
                     </div>
                  ))}
                  {lowStockItems.length === 0 && (
                     <div className="text-center py-8">
                        <p className="text-green-600 font-bold">¡Inventario saludable!</p>
                        <p className="text-xs text-green-500">No hay productos bajo mínimo.</p>
                     </div>
                  )}
               </div>
            </GlassCard>
         </div>
      </div>
   );
};

// --- SUBCOMPONENTS ---

const KPICard = ({ title, value, trend, icon, color, isAlert }: any) => {
   const colors: any = {
      green: 'from-emerald-500 to-teal-600 shadow-emerald-500/20 text-emerald-600',
      blue: 'from-blue-500 to-indigo-600 shadow-blue-500/20 text-blue-600',
      purple: 'from-violet-500 to-purple-600 shadow-purple-500/20 text-violet-600',
      orange: 'from-orange-500 to-red-500 shadow-orange-500/20 text-orange-600',
      red: 'from-red-500 to-rose-600 shadow-red-500/20 text-red-600',
      gray: 'from-gray-500 to-gray-600 shadow-gray-500/20 text-gray-600',
   };

   const iconMap: any = {
      dollar: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
      wallet: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>,
      arrowDown: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>,
      percent: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="5" y1="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>,
   };

   return (
      <div className={`relative overflow-hidden rounded-2xl p-4 md:p-6 bg-white shadow-sm border border-gray-100 group transition-all hover:shadow-lg hover:-translate-y-1 ${isAlert ? 'ring-2 ring-red-400 ring-offset-2' : ''}`}>
         <div className="relative z-10 flex justify-between items-start">
            <div>
               <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{title}</p>
               <h3 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight">{value}</h3>
               <p className={`text-xs font-bold mt-2 flex items-center gap-1 ${colors[color].split(' ').pop()}`}>
                  {trend}
               </p>
            </div>
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color].split(' ').slice(0, 2).join(' ')} flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform`}>
               {iconMap[icon]}
            </div>
         </div>
      </div>
   );
};
