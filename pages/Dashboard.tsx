
import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { productService, customerService, salesService, expenseService } from '../services/supabaseService';
import { Product, SaleHeader, Expense, User } from '../types';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface DashboardProps {
  user?: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [financials, setFinancials] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    margin: 0
  });
  const [weeklyData, setWeeklyData] = useState<{day: string, income: number, expense: number}[]>([]);
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<{name: string, qty: number, total: number}[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [products, sales, expenses, allSaleDetails] = await Promise.all([
        productService.getAll(),
        salesService.getSalesHistory(),
        expenseService.getAll(),
        salesService.getAllDetails()
      ]);

      // 1. Calculate Financials (Global)
      const revenue = sales.reduce((sum, s) => sum + s.total_amount, 0);
      const outcome = expenses.reduce((sum, e) => sum + e.total, 0);
      const profit = revenue - outcome;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      setFinancials({
        totalRevenue: revenue,
        totalExpenses: outcome,
        netProfit: profit,
        margin
      });

      // 2. Process Weekly Data (Strict Calendar Week: Mon -> Sun)
      const getStartOfWeek = (d: Date) => {
         const date = new Date(d);
         const day = date.getDay(); // 0 (Sun) to 6 (Sat)
         const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
         const monday = new Date(date.setDate(diff));
         monday.setHours(0,0,0,0);
         return monday;
      };

      const startOfWeek = getStartOfWeek(new Date());
      const weekDays = [];
      
      // Generate the 7 days of the CURRENT week
      for(let i=0; i<7; i++) {
         const d = new Date(startOfWeek);
         d.setDate(startOfWeek.getDate() + i);
         weekDays.push(d);
      }

      const daysLabels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']; // JS getDay index mapping

      const currentWeekData = weekDays.map((dateObj) => {
         const dateStr = dateObj.toDateString(); // "Mon Feb 10 2024" standardizes comparison
         
         const daySales = sales
            .filter(s => new Date(s.created_at).toDateString() === dateStr)
            .reduce((sum, s) => sum + s.total_amount, 0);
         
         const dayExpenses = expenses
            .filter(e => new Date(e.date).toDateString() === dateStr)
            .reduce((sum, e) => sum + e.total, 0);

         // Map JS Day (0=Sun) to Spanish Label
         return { 
             day: daysLabels[dateObj.getDay()], 
             income: daySales, 
             expense: dayExpenses 
         };
      });
      
      setWeeklyData(currentWeekData);

      // 3. Stock Alerts
      const lowStock = products.filter(p => p.stock_level <= p.min_stock);
      setLowStockItems(lowStock.sort((a,b) => a.stock_level - b.stock_level).slice(0, 4));

      // 4. Top Selling Products (REAL CALCULATION)
      const productSalesMap: Record<string, { qty: number, total: number }> = {};
      
      allSaleDetails.forEach(detail => {
         if (!productSalesMap[detail.product_id]) {
            productSalesMap[detail.product_id] = { qty: 0, total: 0 };
         }
         productSalesMap[detail.product_id].qty += detail.quantity;
         productSalesMap[detail.product_id].total += detail.subtotal;
      });

      const bestSellers = Object.entries(productSalesMap)
         .map(([prodId, stats]) => {
            const prod = products.find(p => p.id === prodId);
            return {
               name: prod ? prod.name : 'Desconocido',
               qty: stats.qty,
               total: stats.total
            };
         })
         .sort((a, b) => b.total - a.total) // Sort by Revenue
         .slice(0, 3);
      
      setTopProducts(bestSellers);

    } catch (error) {
      console.error("Error loading dashboard", error);
    } finally {
      setLoading(false);
    }
  };

  const generateExecutiveReport = () => {
    const doc = new jsPDF();
    const violet = [139, 92, 246]; // #8b5cf6
    const darkText = [31, 41, 55]; // #1f2937
    const lightText = [107, 114, 128]; // #6b7280

    // --- HEADER ---
    // Brand Bar
    doc.setFillColor(violet[0], violet[1], violet[2]);
    doc.rect(0, 0, 210, 5, 'F');

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text("Reporte Ejecutivo", 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.setFont("helvetica", "normal");
    doc.text("Tienda Anechka - POS & ERP System", 14, 31);
    
    // Meta Info (Right aligned)
    const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Fecha de Corte: ${today}`, 196, 25, { align: 'right' });
    doc.text(`Generado por: ${user?.full_name || 'Sistema'}`, 196, 31, { align: 'right' });

    // --- EXECUTIVE SUMMARY (KPI CARDS SIMULATION) ---
    doc.setFontSize(14);
    doc.setTextColor(violet[0], violet[1], violet[2]);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen Financiero Global", 14, 45);

    // Helper to draw KPI Card
    const drawCard = (x: number, title: string, value: string, sub: string, color: [number, number, number]) => {
        doc.setFillColor(249, 250, 251); // Gray-50 background
        doc.setDrawColor(229, 231, 235); // Border
        doc.roundedRect(x, 50, 42, 30, 3, 3, 'FD');
        
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(title.toUpperCase(), x + 4, 58); // Title
        
        doc.setFontSize(12);
        doc.setTextColor(darkText[0], darkText[1], darkText[2]);
        doc.setFont("helvetica", "bold");
        doc.text(value, x + 4, 68); // Value

        doc.setFontSize(7);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(sub, x + 4, 76); // Subtitle/Trend
    };

    drawCard(14, "Utilidad Neta", `$${financials.netProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}`, financials.netProfit >= 0 ? "Rentable" : "Atencion", financials.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68]);
    drawCard(62, "Ingresos", `$${financials.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}`, "Ventas Brutas", [59, 130, 246]);
    drawCard(110, "Egresos", `$${financials.totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}`, "Gastos + Compras", [245, 158, 11]);
    drawCard(158, "Margen", `${financials.margin.toFixed(1)}%`, "Retorno s/Venta", [139, 92, 246]);

    // --- WEEKLY CASH FLOW TABLE ---
    doc.setFontSize(14);
    doc.setTextColor(violet[0], violet[1], violet[2]);
    doc.text("Flujo de Caja Semanal", 14, 95);

    const tableData = weeklyData.map(d => [
       d.day,
       `$${d.income.toFixed(2)}`,
       `$${d.expense.toFixed(2)}`,
       `$${(d.income - d.expense).toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: 100,
        head: [['Dia', 'Ingresos', 'Egresos', 'Balance']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right', textColor: [22, 163, 74] }, // Green for Income
            2: { halign: 'right', textColor: [220, 38, 38] }, // Red for Expense
            3: { halign: 'right', fontStyle: 'bold' }
        },
        styles: { fontSize: 10 },
        margin: { left: 14, right: 14 }
    });

    // @ts-ignore
    let currentY = doc.lastAutoTable.finalY + 15;

    // --- RISKS & INSIGHTS ---
    doc.setFontSize(14);
    doc.setTextColor(violet[0], violet[1], violet[2]);
    doc.text("Alertas y Top Productos", 14, currentY);
    
    currentY += 10;

    // Split page in two columns logic
    // Left: Stock Alerts
    doc.setFontSize(12);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.setFont("helvetica", "bold");
    doc.text("Inventario Critico", 14, currentY);
    
    // Draw indicator box (Red) instead of emoji
    doc.setFillColor(239, 68, 68);
    doc.rect(54, currentY - 4, 4, 4, 'F'); 
    
    let alertY = currentY + 8;
    if (lowStockItems.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(16, 185, 129);
        doc.setFont("helvetica", "normal");
        doc.text("Niveles de stock saludables.", 14, alertY);
    } else {
        lowStockItems.forEach(item => {
            doc.setFontSize(9);
            doc.setTextColor(239, 68, 68); // Red Title
            doc.setFont("helvetica", "bold");
            doc.text(`- ${item.name}`, 14, alertY);
            
            doc.setTextColor(100);
            doc.setFont("helvetica", "normal");
            doc.text(`  (Stock: ${item.stock_level} / Min: ${item.min_stock})`, 14, alertY + 4);
            alertY += 10;
        });
    }

    // Right: Top Products
    doc.setFontSize(12);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.setFont("helvetica", "bold");
    doc.text("Top Ventas", 110, currentY);
    
    // Draw indicator box (Violet) instead of emoji
    doc.setFillColor(139, 92, 246);
    doc.rect(150, currentY - 4, 4, 4, 'F');

    let topY = currentY + 8;
    topProducts.forEach((prod, i) => {
        doc.setFontSize(9);
        doc.setTextColor(darkText[0], darkText[1], darkText[2]);
        doc.setFont("helvetica", "normal");
        doc.text(`${i + 1}. ${prod.name}`, 110, topY);
        
        doc.setTextColor(violet[0], violet[1], violet[2]);
        doc.setFont("helvetica", "bold");
        doc.text(`$${prod.total}`, 180, topY, { align: 'right' });
        
        doc.setFont("helvetica", "normal");
        topY += 7;
    });

    // --- FOOTER & SIGNATURE ---
    const footerY = 270;
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(14, footerY, 80, footerY); // Line for signature
    doc.line(116, footerY, 196, footerY); // Line for signature

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Firma Gerencia", 14, footerY + 5);
    doc.text("Firma Auditoria / Propietario", 116, footerY + 5);

    doc.save(`Reporte_Gerencial_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="mb-6 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-800 tracking-tight">{getTimeGreeting()}, {user?.full_name.split(' ')[0] || 'Gerencia'}.</h2>
          <p className="text-gray-500 font-medium">Visión global financiera y operativa.</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={generateExecutiveReport}
             disabled={loading}
             className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-gray-500/20 transition-all flex items-center gap-2 transform active:scale-95 text-sm"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
             Reporte Ejecutivo PDF
           </button>
        </div>
      </header>

      {/* --- FINANCIAL KPIS (SCORE CARDS) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Utilidad Neta (Est.)" 
          value={`$${financials.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          trend={financials.netProfit >= 0 ? "Rentable" : "Déficit"}
          icon="wallet"
          color={financials.netProfit >= 0 ? "green" : "orange"}
          isAlert={financials.netProfit < 0}
        />
        <KPICard 
          title="Ingresos Totales" 
          value={`$${financials.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          trend="Ventas Brutas"
          icon="dollar"
          color="blue"
        />
        <KPICard 
          title="Egresos Operativos" 
          value={`$${financials.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          trend="Gastos + Compras"
          icon="arrowDown"
          color="purple"
        />
        <KPICard 
          title="Margen Global" 
          value={`${financials.margin.toFixed(1)}%`} 
          trend="Retorno s/Ventas"
          icon="percent"
          color={financials.margin > 20 ? "green" : "orange"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* LEFT COLUMN: FINANCIAL CHART */}
        <div className="lg:col-span-2">
           <GlassCard className="h-full flex flex-col min-h-[320px]">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="font-bold text-lg text-gray-800">Flujo de Caja Semanal</h3>
                    <p className="text-xs text-gray-500">Comparativa Ingresos vs Egresos</p>
                 </div>
                 <div className="flex gap-2 text-[10px] font-bold">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-primary"></span> Ingreso</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> Gasto</span>
                 </div>
              </div>
              
              {/* DUAL BAR CHART */}
              <div className="flex-1 flex items-end justify-between gap-2 sm:gap-4 px-2 pb-2">
                 {weeklyData.map((d, i) => (
                    <DualChartBar 
                      key={i} 
                      label={d.day} 
                      income={d.income} 
                      expense={d.expense} 
                      maxVal={Math.max(...weeklyData.map(w => Math.max(w.income, w.expense)), 100)} // normalize
                    />
                 ))}
              </div>
           </GlassCard>
        </div>

        {/* RIGHT COLUMN: ALERTS & TOP PRODUCTS */}
        <div className="lg:col-span-1 space-y-4">
           
           {/* Top Products Mini Widget */}
           <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="font-bold text-gray-800">Top Productos</h3>
                 <span className="text-xs text-brand-primary font-bold">Más Vendidos</span>
              </div>
              <div className="space-y-3">
                 {topProducts.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                       <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-400 text-xs">#{idx+1}</span>
                          <span className="font-medium text-gray-700 truncate max-w-[120px]">{p.name}</span>
                       </div>
                       <span className="font-bold text-green-600">+${p.total.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                    </div>
                 ))}
                 {topProducts.length === 0 && <p className="text-xs text-gray-400 italic">No hay ventas registradas.</p>}
              </div>
           </GlassCard>

           {/* Alerts Widget */}
           <GlassCard className="bg-red-50/50 border-red-100">
              <div className="flex items-center gap-2 mb-3 text-red-700">
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                 <h3 className="font-bold text-md">Stock Crítico ({lowStockItems.length})</h3>
              </div>
              
              <div className="space-y-2">
                 {lowStockItems.length === 0 ? (
                   <div className="text-center py-4 text-green-600">
                      <p className="text-xs font-bold">¡Todo en orden!</p>
                   </div>
                 ) : (
                   lowStockItems.map(item => (
                     <div key={item.id} className="flex items-center justify-between p-2 bg-white/60 rounded-lg border border-red-100 shadow-sm">
                        <span className="text-xs font-bold text-gray-700 truncate max-w-[150px]">{item.name}</span>
                        <div className="text-right">
                           <span className="block text-xs font-black text-red-600">{item.stock_level} Unds</span>
                        </div>
                     </div>
                   ))
                 )}
              </div>
           </GlassCard>
        </div>
      </div>
    </div>
  );
};

// --- SUBCOMPONENTS ---

const KPICard = ({ title, value, trend, icon, color, isAlert }: any) => {
   const colors: any = {
      green: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
      blue: 'from-blue-500 to-indigo-600 shadow-blue-500/20',
      purple: 'from-violet-500 to-purple-600 shadow-purple-500/20',
      orange: 'from-orange-500 to-red-500 shadow-orange-500/20',
   };

   const iconMap: any = {
      dollar: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
      wallet: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>,
      arrowDown: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
      percent: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
      alert: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
   };

   return (
     <div className={`relative overflow-hidden rounded-2xl p-6 bg-white shadow-xl border border-white/50 group transition-all hover:-translate-y-1 ${isAlert ? 'ring-2 ring-red-400 ring-offset-2' : ''}`}>
        <div className="relative z-10">
           <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white mb-4 shadow-lg`}>
              {iconMap[icon]}
           </div>
           <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</p>
           <h3 className="text-2xl font-black text-gray-800">{value}</h3>
           <p className={`text-xs font-bold mt-2 ${isAlert ? 'text-red-500' : 'text-gray-400'}`}>{trend}</p>
        </div>
        {/* Decor */}
        <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-gradient-to-br ${colors[color]} opacity-10 group-hover:scale-110 transition-transform`}></div>
     </div>
   );
};

const DualChartBar = ({ label, income, expense, maxVal }: any) => {
   const incomePercent = maxVal > 0 ? (income / maxVal) * 100 : 0;
   const expensePercent = maxVal > 0 ? (expense / maxVal) * 100 : 0;

   return (
      <div className="flex flex-col items-center justify-end h-full gap-2 group w-full">
         <div className="relative w-full flex justify-center items-end h-full gap-1">
            {/* Expense Bar */}
            <div 
              className="w-3 bg-orange-300 rounded-t-sm hover:bg-orange-400 transition-all relative group/exp"
              style={{ height: `${expensePercent}%` }}
            >
               <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover/exp:opacity-100 transition-opacity z-20 pointer-events-none">
                  -${expense}
               </div>
            </div>
            
            {/* Income Bar */}
            <div 
              className="w-4 bg-brand-primary rounded-t-md shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary transition-all relative group/inc"
              style={{ height: `${incomePercent}%` }}
            >
               <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover/inc:opacity-100 transition-opacity z-20 pointer-events-none">
                  +${income}
               </div>
            </div>
         </div>
         <span className="text-[10px] font-bold text-gray-400 uppercase">{label}</span>
      </div>
   );
};
