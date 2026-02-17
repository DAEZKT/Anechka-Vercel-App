
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { salesService, expenseService, userService, productService } from '../services/supabaseService';
import { SaleHeader, Expense, User, SaleDetail, Product, ExpensePayment, PaymentMethodType } from '../types';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getLocalDateString, toLocalDateString, getBusinessDateString, formatCurrency } from '../utils/dateUtils';

interface CashClosePageProps {
   user: User;
}

// --- ICONS ---
const Icons = {
   Wallet: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>,
   Bank: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="22" y2="22" /><line x1="6" x2="6" y1="18" y2="11" /><line x1="10" x2="10" y1="18" y2="11" /><line x1="14" x2="14" y1="18" y2="11" /><line x1="18" x2="18" y1="18" y2="11" /><polygon points="12 2 20 7 4 7" /></svg>,
   TrendUp: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
   TrendDown: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></svg>,
   Printer: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>,
   Scale: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg>
};

export const CashClosePage: React.FC<CashClosePageProps> = ({ user }) => {
   const [loading, setLoading] = useState(false);
   const [selectedDate, setSelectedDate] = useState(getLocalDateString());

   // Data State
   const [metrics, setMetrics] = useState({
      totalSales: 0,
      cashSales: 0, // Ingresos brutos en efectivo
      digitalSales: 0, // Bancos/POS
      cashExpenses: 0, // Salidas de caja fisica
      theoreticalCash: 0, // Lo que debe haber en el cajón (CashSales - CashExpenses)
      transferTotal: 0
   });

   const [methodBreakdown, setMethodBreakdown] = useState<Record<string, number>>({});
   const [categoryBreakdown, setCategoryBreakdown] = useState<Record<PaymentMethodType, number>>({
      CASH: 0,
      TRANSFER: 0,
      CARD: 0,
      OTHER: 0
   });
   const [transfersDetail, setTransfersDetail] = useState<{ method: string, type: PaymentMethodType, amount: number, ref: string }[]>([]);
   const [sellerPerformance, setSellerPerformance] = useState<{ name: string, amount: number, tickets: number }[]>([]);
   const [productVelocity, setProductVelocity] = useState<{ name: string, qty: number, total: number }[]>([]);

   // Lists for PDF
   const [sales, setSales] = useState<SaleHeader[]>([]);
   const [expensesList, setExpensesList] = useState<Expense[]>([]);
   const [expensePaymentsList, setExpensePaymentsList] = useState<ExpensePayment[]>([]);

   useEffect(() => {
      loadDailyData();
   }, [selectedDate]);

   const loadDailyData = async () => {
      setLoading(true);
      try {
         const [allSales, allExpenses, allUsers, allDetails, allProducts, allPayments] = await Promise.all([
            salesService.getSalesHistory(),
            expenseService.getAll(),
            userService.getAll(),
            salesService.getAllDetails(),
            productService.getAll(),
            expenseService.getAllPayments()
         ]);

         // 1. FILTER BY DATE (Local Date String Comparison)
         const dailySales = allSales.filter(s => {
            // Convert timestamp to YYYY-MM-DD using local timezone
            const saleDate = toLocalDateString(s.created_at);
            return saleDate === selectedDate && s.status === 'COMPLETED';
         });

         const dailyExpenses = allExpenses.filter(e => {
            // Normalize e.date using our utility to extract YYYY-MM-DD safely
            return getBusinessDateString(e.date) === selectedDate;
         });

         // 2. PROCESS SALES & PAYMENTS
         let totalRevenue = 0;
         let incomeCash = 0;
         let incomeDigital = 0;

         const methodsMap: Record<string, number> = {};
         const transfersList: any[] = [];
         const sellersMap: Record<string, { amount: number, tickets: number }> = {};

         // Category aggregation (CASH, TRANSFER, CARD, OTHER)
         const categoryTotals: Record<PaymentMethodType, number> = {
            CASH: 0,
            TRANSFER: 0,
            CARD: 0,
            OTHER: 0
         };

         dailySales.forEach(sale => {
            totalRevenue += sale.total_amount;

            // Sellers Logic
            const seller = allUsers.find(u => u.id === sale.user_id);
            const sellerName = seller ? seller.full_name : 'Desconocido';
            if (!sellersMap[sellerName]) sellersMap[sellerName] = { amount: 0, tickets: 0 };
            sellersMap[sellerName].amount += sale.total_amount;
            sellersMap[sellerName].tickets += 1;

            // Payment Parsing - NEW FORMAT: "TYPE|Method Name: $Amount, TYPE|Method Name: $Amount"
            const parts = sale.payment_method_snapshot.split(', ');
            parts.forEach(part => {
               if (part.includes(':')) {
                  let type: PaymentMethodType = 'OTHER';
                  let methodName = '';
                  let amountStr = '';

                  // Check if new format (TYPE|Name: $Amount)
                  if (part.includes('|')) {
                     const [typeAndName, amount] = part.split(': ');
                     const [typeStr, name] = typeAndName.split('|');
                     type = typeStr as PaymentMethodType;
                     methodName = name.trim();
                     amountStr = amount;
                  } else {
                     // Legacy format (Name: $Amount) - infer type from name
                     const [name, amount] = part.split(': ');
                     methodName = name.trim();
                     amountStr = amount;

                     // Heuristic type detection for legacy data
                     const lowerName = methodName.toLowerCase();
                     if (lowerName.includes('efectivo') || lowerName.includes('cash') || lowerName.includes('caja')) {
                        type = 'CASH';
                     } else if (lowerName.includes('transfer') || lowerName.includes('banco') || lowerName.includes('cuenta')) {
                        type = 'TRANSFER';
                     } else if (lowerName.includes('tarjeta') || lowerName.includes('card') || lowerName.includes('pos')) {
                        type = 'CARD';
                     } else {
                        type = 'OTHER';
                     }
                  }

                  // Parse amount
                  const cleanAmountStr = amountStr.replace(/[^0-9.-]+/g, "");
                  const amount = parseFloat(cleanAmountStr) || 0;

                  // Aggregate by Method Name
                  methodsMap[methodName] = (methodsMap[methodName] || 0) + amount;

                  // Aggregate by Category Type
                  categoryTotals[type] += amount;

                  // Classify for totals
                  if (type === 'CASH') {
                     incomeCash += amount;
                  } else {
                     incomeDigital += amount;

                     // Track all non-cash as transfers for detailed view
                     transfersList.push({
                        method: methodName,
                        type: type,
                        amount: amount,
                        ref: `Ticket #${sale.id.slice(-6)}`
                     });
                  }
               }
            });
         });

         // Filter Payments
         const dailyPayments = allPayments.filter(p => {
            const payDate = toLocalDateString(p.date);
            return payDate === selectedDate;
         });

         // 3. PROCESS EXPENSES (Cash vs Other)
         let outcomeCash = 0;

         console.log('🔍 Debugging Expenses:', {
            totalExpenses: allExpenses.length,
            dailyExpenses: dailyExpenses.length,
            dailyExpensesData: dailyExpenses,
            dailyPayments: dailyPayments.length
         });

         dailyExpenses.forEach(exp => {
            console.log('💰 Processing expense:', {
               supplier: exp.supplier,
               total: exp.total,
               payment_type: exp.payment_type,
               date: exp.date
            });

            // Assuming 'CONTADO' implies Cash Drawer outflow. 
            // 'CREDITO' doesn't affect cash flow today (unless paid, but that logic is in payments table)
            if (exp.payment_type === 'CONTADO') {
               outcomeCash += exp.total;
               console.log('✅ Added to outcomeCash:', exp.total);
            }
         });

         // Add Credit Payments to Outflow
         dailyPayments.forEach(pay => {
            outcomeCash += pay.amount;
            console.log('💳 Added payment to outflow:', pay.amount);
         });

         // 4. PROCESS TOP PRODUCTS
         const saleIds = dailySales.map(s => s.id);
         const dailyItems = allDetails.filter(d => saleIds.includes(d.sale_id));
         const prodStats: Record<string, { qty: number, total: number }> = {};

         dailyItems.forEach(item => {
            if (!prodStats[item.product_id]) prodStats[item.product_id] = { qty: 0, total: 0 };
            prodStats[item.product_id].qty += item.quantity;
            prodStats[item.product_id].total += item.subtotal;
         });

         const topItems = Object.entries(prodStats).map(([pid, stat]) => {
            const p = allProducts.find(prod => prod.id === pid);
            return {
               name: p ? p.name : 'Item Eliminado',
               qty: stat.qty,
               total: stat.total
            };
         }).sort((a, b) => b.total - a.total); // Sort by Revenue

         // UPDATE STATE
         setSales(dailySales);
         setExpensesList(dailyExpenses);
         setExpensePaymentsList(dailyPayments);

         setMetrics({
            totalSales: totalRevenue,
            cashSales: incomeCash,
            digitalSales: incomeDigital,
            cashExpenses: outcomeCash,
            theoreticalCash: incomeCash - outcomeCash, // The logic requested: In - Out = Current
            transferTotal: transfersList.reduce((acc, t) => acc + t.amount, 0)
         });

         setMethodBreakdown(methodsMap);
         setCategoryBreakdown(categoryTotals);
         setTransfersDetail(transfersList);
         setSellerPerformance(Object.entries(sellersMap).map(([name, val]) => ({ name, ...val })));
         setProductVelocity(topItems);

      } catch (e) {
         console.error("Error loading cash close data:", e);
      } finally {
         setLoading(false);
      }
   };

   // Explicit calculation for Balance Total based on user request
   const balanceTotal = metrics.theoreticalCash + metrics.digitalSales;

   const generateCloseReport = async () => {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;

      // COLORS
      const brandColor: [number, number, number] = [79, 70, 229]; // Indigo 600
      const secondaryColor: [number, number, number] = [107, 114, 128]; // Gray 500
      const accentColor: [number, number, number] = [16, 185, 129]; // Emerald 500
      const dangerColor: [number, number, number] = [239, 68, 68]; // Red 500

      // HELPER: Draw Card
      const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string, color: [number, number, number]) => {
         doc.setDrawColor(229, 231, 235);
         doc.setFillColor(255, 255, 255);
         doc.roundedRect(x, y, w, h, 3, 3, 'FD');

         // Title
         doc.setFontSize(7);
         doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
         doc.setFont('helvetica', 'bold');
         doc.text(title.toUpperCase(), x + 5, y + 8);

         // Value
         doc.setFontSize(12);
         doc.setTextColor(color[0], color[1], color[2]);
         doc.text(value, x + 5, y + 18);
      };

      // --- HERO HEADER ---
      doc.setFillColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.rect(0, 0, pageWidth, 35, 'F'); // Compact height

      // 1. Logo (White) - Top Left
      try {
         const logoUrl = "https://zznzarpbntmvymtfapwx.supabase.co/storage/v1/object/public/branding/Logo%20DAEZKT%20rectangular%20blanco.png";
         const img = new Image();
         img.crossOrigin = "Anonymous";
         img.src = logoUrl;
         await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
         });
         doc.addImage(img, 'PNG', margin, 8, 40, 13);
      } catch (error) {
         console.warn("Could not load logo for PDF", error);
      }

      // 2. Info - Top Right (Smaller)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(`GENERADO POR: ${user.full_name.toUpperCase()}`, pageWidth - margin, 12, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(`FECHA IMPRESIÓN: ${new Date().toLocaleString()}`, pageWidth - margin, 16, { align: 'right' });

      // 3. Title - Center (Aligned in same row)
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text("REPORTE DE CIERRE", pageWidth / 2, 14, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(224, 231, 255); // Lighter Indigo
      doc.text(`DAEZKT POS  •  ${selectedDate}`, pageWidth / 2, 19, { align: 'center' });

      let currentY = 45;

      // --- FINANCIAL HIGHLIGHTS ---
      // A Row of 3 Cards
      const cardWidth = (pageWidth - (margin * 2) - 10) / 3;

      // 1. Total Balance
      drawCard(margin, currentY, cardWidth, 25, "BALANCE TOTAL", `$${balanceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, brandColor);

      // 2. Cash In Hand
      drawCard(margin + cardWidth + 5, currentY, cardWidth, 25, "EFECTIVO EN CAJA", `$${metrics.theoreticalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, accentColor);

      // 3. Digital
      drawCard(margin + (cardWidth * 2) + 10, currentY, cardWidth, 25, "DIGITAL / BANCOS", `$${metrics.digitalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, [59, 130, 246]);

      currentY += 35;

      // --- RESUMEN OPERACIONES (TEXT) ---
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text("RESUMEN DE OPERACIONES", margin, currentY);

      doc.setLineWidth(0.5);
      doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.line(margin, currentY + 3, margin + 65, currentY + 3);

      currentY += 12;

      const summaryData = [
         ['(+) Ventas Totales', metrics.totalSales],
         ['(+) Ingresos Efectivo', metrics.cashSales],
         ['(-) Gastos Efectivo', metrics.cashExpenses],
         ['(=) Neto Efectivo', metrics.theoreticalCash]
      ];

      summaryData.forEach((row, i) => {
         const y = currentY + (i * 7);
         doc.setFontSize(9);
         doc.setTextColor(60, 60, 60);
         doc.setFont('helvetica', i === 3 ? 'bold' : 'normal'); // Bold total
         doc.text(row[0] as string, margin + 5, y);

         const val = row[1] as number;
         const valStr = `$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
         // Align right (manually for this small block)
         doc.text(valStr, pageWidth / 2, y, { align: 'right' });
      });

      // --- AUTO TABLES ---

      // Helper for common table style
      const tableHeadStyles = { fillColor: brandColor, textColor: 255, fontSize: 8, fontStyle: 'bold' as const };
      const tableStyles = { fontSize: 8, cellPadding: 3 };

      // 1. Resumen por Categoría (NEW)
      // Placed to the right of the text summary to save space? Or below? 
      // Let's put it below to keep flow simple.
      currentY += 35;

      doc.setFontSize(10);
      doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.text("RESUMEN POR CATEGORÍA", margin, currentY);
      currentY += 5;

      autoTable(doc, {
         startY: currentY,
         head: [['CATEGORÍA', 'TOTAL']],
         body: [
            ['EFECTIVO', `$${categoryBreakdown.CASH.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
            ['TRANSFERENCIAS', `$${categoryBreakdown.TRANSFER.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
            ['TARJETAS', `$${categoryBreakdown.CARD.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
            ['OTROS', `$${categoryBreakdown.OTHER.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
         ],
         theme: 'striped',
         headStyles: tableHeadStyles,
         styles: tableStyles,
         columnStyles: { 1: { halign: 'right' } },
         margin: { left: margin, right: margin }
      });
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 15;

      // 2. Auditoría Transferencias (NEW)
      doc.setFontSize(10);
      doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.text("AUDITORÍA DE TRANSFERENCIAS / DIGITAL", margin, currentY);
      currentY += 5;

      if (transfersDetail.length > 0) {
         autoTable(doc, {
            startY: currentY,
            head: [['REF / TIPO', 'MÉTODO', 'MONTO']],
            body: transfersDetail.map(t => [
               `${t.type} - ${t.ref}`,
               t.method,
               `$${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ]),
            theme: 'striped',
            headStyles: tableHeadStyles,
            styles: tableStyles,
            columnStyles: { 2: { halign: 'right' } },
            margin: { left: margin, right: margin }
         });
         // @ts-ignore
         currentY = doc.lastAutoTable.finalY + 15;
      } else {
         doc.setFontSize(9);
         doc.setTextColor(150);
         doc.text("No hubo transacciones digitales.", margin, currentY + 5);
         currentY += 15;
      }

      // 3. Top Productos (NEW)
      if (currentY > pageHeight - 60) { doc.addPage(); currentY = 20; }
      doc.setFontSize(10);
      doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.text("TOP PRODUCTOS VENDIDOS", margin, currentY);
      currentY += 5;

      autoTable(doc, {
         startY: currentY,
         head: [['PRODUCTO', 'CANT.', 'TOTAL']],
         body: productVelocity.slice(0, 10).map(p => [ // Top 10
            p.name,
            p.qty,
            `$${p.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
         ]),
         theme: 'striped',
         headStyles: tableHeadStyles,
         styles: tableStyles,
         columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
         margin: { left: margin, right: margin }
      });
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 15;


      // 4. Sales by Seller (Existing)
      if (currentY > pageHeight - 60) { doc.addPage(); currentY = 20; }

      doc.setFontSize(10);
      doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.text("DESEMPEÑO DE VENDEDORES", margin, currentY);
      currentY += 5;

      autoTable(doc, {
         startY: currentY,
         head: [['VENDEDOR', 'TICKETS', 'TOTAL VENDIDO']],
         body: sellerPerformance.map(s => [
            s.name.toUpperCase(),
            s.tickets,
            `$${s.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
         ]),
         theme: 'grid',
         headStyles: tableHeadStyles,
         styles: tableStyles,
         columnStyles: { 2: { halign: 'right' } },
         margin: { left: margin, right: margin }
      });

      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 15;

      // 5. Expenses (Existing)
      if (currentY > pageHeight - 60) { doc.addPage(); currentY = 20; }

      doc.setFontSize(10);
      doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
      doc.text("EGRESOS Y ABONOS (FONDO DE CAJA)", margin, currentY);
      currentY += 5;

      const expenseRows = [
         ...expensesList.filter(e => e.payment_type === 'CONTADO').map(e => [e.sub_account, e.supplier.substring(0, 20), `$${e.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]),
         ...expensePaymentsList.map(p => ['Pago Crédito', (p.note || 'Sin Nota'), `$${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`])
      ];

      if (expenseRows.length === 0) {
         doc.setFontSize(9);
         doc.setTextColor(150);
         doc.text("No se registraron egresos de caja.", margin, currentY + 5);
         currentY += 10;
      } else {
         autoTable(doc, {
            startY: currentY,
            head: [['CONCEPTO', 'DETALLE', 'MONTO']],
            body: expenseRows,
            theme: 'striped',
            headStyles: { fillColor: dangerColor, textColor: 255, fontSize: 8 },
            styles: tableStyles,
            columnStyles: { 2: { halign: 'right' } },
            margin: { left: margin, right: margin }
         });
         // @ts-ignore
         currentY = doc.lastAutoTable.finalY + 10;
      }

      // --- SIGNATURE FOOTER ---
      // Fix potential page overflow for signatures
      if (currentY > pageHeight - 40) { doc.addPage(); }
      const footerY = pageHeight - 30;

      doc.setDrawColor(200);
      doc.setLineWidth(0.5);

      // Line 1
      doc.line(margin + 10, footerY, margin + 70, footerY);
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text("FIRMA RESPONSABLE DE CAJA", margin + 40, footerY + 5, { align: 'center' });

      // Line 2
      doc.line(pageWidth - margin - 70, footerY, pageWidth - margin - 10, footerY);
      doc.text("FIRMA SUPERVISOR / AUDITOR", pageWidth - margin - 40, footerY + 5, { align: 'center' });

      // Brand Footer
      doc.setFillColor(245, 245, 245);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text("Documento generado automáticamente por DAEZKT POS.", margin, pageHeight - 5);
      doc.text(`${new Date().getFullYear()} © Todos los derechos reservados.`, pageWidth - margin, pageHeight - 5, { align: 'right' });

      doc.save(`Cierre_Total_${selectedDate}.pdf`);
   };

   return (
      <div className="space-y-6 animate-fade-in-up">
         {/* HEADER SECTION */}
         <header className="flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div>
               <h2 className="text-3xl font-black text-gray-800 tracking-tight">Cierre de Caja</h2>
               <p className="text-gray-500 font-medium">Conciliación diaria de ingresos y egresos.</p>
            </div>
            <div className="flex gap-3">
               <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-white/60 bg-white/40 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-brand-primary font-bold text-gray-700 shadow-sm"
               />
               <button
                  onClick={generateCloseReport}
                  disabled={loading}
                  className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-gray-500/30 transition-all flex items-center gap-2 transform active:scale-95"
               >
                  <Icons.Printer />
                  Imprimir PDF
               </button>
            </div>
         </header>

         {/* --- STAT CARDS (STRICT LOGIC: NET CASH + BANK = TOTAL) --- */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* 1. BALANCE TOTAL (Efectivo Neto + Bancos) */}
            <StatCard
               title="Balance Total (Neto)"
               value={`$${balanceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
               sub="Efectivo en Caja + Digital"
               icon={Icons.Scale}
               color="bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-violet-500/30"
               iconBg="bg-white/20"
            />

            {/* 2. EFECTIVO EN CAJA (Ventas Efec. - Gastos) */}
            <StatCard
               title="Efectivo en Caja"
               value={`$${metrics.theoreticalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
               sub="Ingresos Efec. - Gastos"
               icon={Icons.Wallet}
               color="bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/30"
               iconBg="bg-white/20"
            />

            {/* 3. DIGITAL (Unchanged) */}
            <StatCard
               title="Digital / Bancos"
               value={`$${metrics.digitalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
               sub="Tarjetas + Transferencias"
               icon={Icons.Bank}
               color="bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-blue-500/30"
               iconBg="bg-white/20"
            />

            {/* 4. SALIDAS (Unchanged) */}
            <StatCard
               title="Salidas de Caja"
               value={`$${metrics.cashExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
               sub="Gastos pagados Contado"
               icon={Icons.TrendDown}
               color="bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-500/30"
               iconBg="bg-white/20"
            />
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* LEFT COLUMN: BREAKDOWNS */}
            <div className="space-y-6">
               {/* Sales by Seller */}
               <GlassCard>
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                     <span className="w-1.5 h-6 bg-brand-primary rounded-full"></span>
                     Ventas por Vendedor
                  </h3>
                  {sellerPerformance.length === 0 ? (
                     <p className="text-gray-400 text-sm italic">Sin ventas registradas hoy.</p>
                  ) : (
                     <div className="space-y-3">
                        {sellerPerformance.map((seller, idx) => (
                           <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-white/40 border border-white/50 hover:bg-white/60 transition-colors">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white flex items-center justify-center font-bold text-xs shadow-md">
                                    {seller.name.charAt(0)}
                                 </div>
                                 <div>
                                    <p className="text-sm font-bold text-gray-800">{seller.name}</p>
                                    <p className="text-[10px] text-gray-500 font-medium">{seller.tickets} Tickets generados</p>
                                 </div>
                              </div>
                              <span className="font-mono font-bold text-brand-primary text-lg">${seller.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                           </div>
                        ))}
                     </div>
                  )}
               </GlassCard>

               {/* Category Breakdown (CASH, TRANSFER, CARD) */}
               <GlassCard className="bg-gradient-to-br from-violet-50/50 to-blue-50/50 border-violet-100">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                     <span className="w-1.5 h-6 bg-violet-500 rounded-full"></span>
                     Resumen por Categoría
                  </h3>
                  <div className="space-y-3">
                     {/* CASH */}
                     <div className="flex justify-between items-center p-3 rounded-xl bg-white/60 border border-green-200 shadow-sm">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center text-white">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>
                           </div>
                           <span className="text-sm font-bold text-gray-700">Efectivo</span>
                        </div>
                        <span className="font-mono font-bold text-green-700 text-lg">${categoryBreakdown.CASH.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                     </div>

                     {/* TRANSFER */}
                     <div className="flex justify-between items-center p-3 rounded-xl bg-white/60 border border-blue-200 shadow-sm">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="22" y2="22" /><line x1="6" x2="6" y1="18" y2="11" /><line x1="10" x2="10" y1="18" y2="11" /><line x1="14" x2="14" y1="18" y2="11" /><line x1="18" x2="18" y1="18" y2="11" /><polygon points="12 2 20 7 4 7" /></svg>
                           </div>
                           <span className="text-sm font-bold text-gray-700">Transferencias</span>
                        </div>
                        <span className="font-mono font-bold text-blue-700 text-lg">${categoryBreakdown.TRANSFER.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                     </div>

                     {/* CARD */}
                     <div className="flex justify-between items-center p-3 rounded-xl bg-white/60 border border-purple-200 shadow-sm">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center text-white">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                           </div>
                           <span className="text-sm font-bold text-gray-700">Tarjetas</span>
                        </div>
                        <span className="font-mono font-bold text-purple-700 text-lg">${categoryBreakdown.CARD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                     </div>

                     {/* OTHER (if > 0) */}
                     {categoryBreakdown.OTHER > 0 && (
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/60 border border-gray-200 shadow-sm">
                           <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gray-500 flex items-center justify-center text-white">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                              </div>
                              <span className="text-sm font-bold text-gray-700">Otros</span>
                           </div>
                           <span className="font-mono font-bold text-gray-700 text-lg">${categoryBreakdown.OTHER.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                     )}
                  </div>
               </GlassCard>

               {/* Payment Methods */}
               <GlassCard>
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                     <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                     Desglose de Métodos
                  </h3>
                  {Object.keys(methodBreakdown).length === 0 ? (
                     <p className="text-gray-400 text-sm italic">Sin cobros registrados.</p>
                  ) : (
                     <div className="space-y-2">
                        {Object.entries(methodBreakdown).map(([method, amount], idx) => (
                           <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2 last:border-0 px-2">
                              <span className="text-gray-600 font-medium flex items-center gap-2">
                                 {method.toLowerCase().includes('efectivo') ? '💵' : '💳'} {method}
                              </span>
                              <span className="font-bold text-gray-800">${formatCurrency(amount as number)}</span>
                           </div>
                        ))}
                     </div>
                  )}
               </GlassCard>
            </div>

            {/* RIGHT COLUMN: DETAILS */}
            <div className="space-y-6">
               {/* Transfer Details */}
               <GlassCard className="bg-blue-50/40 border-blue-100">
                  <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
                     Auditoría Transferencias
                  </h3>
                  {transfersDetail.length === 0 ? (
                     <div className="text-center py-4">
                        <p className="text-xs text-blue-400 font-medium italic">No hubo transferencias hoy.</p>
                     </div>
                  ) : (
                     <div className="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                        {transfersDetail.map((t, idx) => {
                           // Color coding by type
                           const typeColors = {
                              TRANSFER: 'bg-blue-100 text-blue-700 border-blue-200',
                              CARD: 'bg-purple-100 text-purple-700 border-purple-200',
                              OTHER: 'bg-gray-100 text-gray-700 border-gray-200',
                              CASH: 'bg-green-100 text-green-700 border-green-200'
                           };
                           const typeLabels = {
                              TRANSFER: 'Transferencia',
                              CARD: 'Tarjeta',
                              OTHER: 'Otro',
                              CASH: 'Efectivo'
                           };

                           return (
                              <div key={idx} className="flex justify-between items-center text-xs bg-white/80 p-3 rounded-lg border border-blue-100 shadow-sm">
                                 <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                       <span className="block font-bold text-blue-900">{t.method}</span>
                                       <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeColors[t.type]}`}>
                                          {typeLabels[t.type]}
                                       </span>
                                    </div>
                                    <span className="text-blue-500 font-mono bg-blue-50 px-1 rounded text-[10px]">{t.ref}</span>
                                 </div>
                                 <span className="font-bold text-blue-700 text-sm ml-2">+${t.amount.toFixed(2)}</span>
                              </div>
                           );
                        })}
                     </div>
                  )}
               </GlassCard>

               {/* Expenses List */}
               <GlassCard className="bg-rose-50/40 border-rose-100">
                  <h3 className="font-bold text-rose-800 mb-4 flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                     Egresos de Caja y Abonos
                  </h3>
                  {expensesList.filter(e => e.payment_type === 'CONTADO').length === 0 && expensePaymentsList.length === 0 ? (
                     <div className="text-center py-4">
                        <p className="text-xs text-rose-400 font-medium italic">No hubo salidas de efectivo.</p>
                     </div>
                  ) : (
                     <div className="space-y-2">
                        {expensesList.filter(e => e.payment_type === 'CONTADO').map((e, idx) => (
                           <div key={`exp-${idx}`} className="flex justify-between items-center text-xs bg-white/80 p-3 rounded-lg border border-rose-100 shadow-sm">
                              <div>
                                 <span className="block font-bold text-gray-800">{e.sub_account}</span>
                                 <span className="text-gray-500">{e.supplier}</span>
                              </div>
                              <span className="font-bold text-rose-600 text-sm">-${e.total.toFixed(2)}</span>
                           </div>
                        ))}
                        {expensePaymentsList.map((p, idx) => (
                           <div key={`pay-${idx}`} className="flex justify-between items-center text-xs bg-white/80 p-3 rounded-lg border border-rose-100 shadow-sm">
                              <div>
                                 <span className="block font-bold text-gray-800">Abono Crédito</span>
                                 <span className="text-gray-500">{p.note || 'Sin referencia'}</span>
                              </div>
                              <span className="font-bold text-rose-600 text-sm">-${p.amount.toFixed(2)}</span>
                           </div>
                        ))}
                     </div>
                  )}
               </GlassCard>

               {/* Product Velocity (Brief) */}
               <GlassCard>
                  <h3 className="font-bold text-gray-800 mb-3 text-sm">Top Items Vendidos Hoy</h3>
                  <div className="space-y-2">
                     {productVelocity.slice(0, 5).map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border-b border-gray-100 pb-2 last:border-0">
                           <div className="flex items-center gap-2">
                              <span className="bg-gray-100 text-gray-600 font-bold px-1.5 rounded">{p.qty}x</span>
                              <span className="truncate max-w-[150px] font-medium text-gray-700">{p.name}</span>
                           </div>
                           <span className="font-bold text-gray-900">${p.total.toFixed(2)}</span>
                        </div>
                     ))}
                     {productVelocity.length === 0 && <p className="text-gray-400 text-xs italic">Sin movimiento de inventario.</p>}
                  </div>
               </GlassCard>
            </div>
         </div>
      </div>
   );
};

// --- SUBCOMPONENT: Custom Identity Stat Card ---
const StatCard = ({ title, value, sub, color, icon: Icon, iconBg }: any) => (
   <div className={`relative overflow-hidden rounded-2xl p-6 shadow-lg transition-transform hover:-translate-y-1 ${color}`}>
      {/* Background Decor */}
      <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white rounded-full opacity-10 blur-2xl pointer-events-none"></div>

      <div className="relative z-10 flex justify-between items-start">
         <div>
            <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-3xl font-black tracking-tight">{value}</h3>
            {sub && (
               <div className="mt-2 inline-flex items-center bg-black/10 px-2 py-0.5 rounded text-[10px] font-bold backdrop-blur-sm">
                  {sub}
               </div>
            )}
         </div>
         <div className={`p-3 rounded-xl backdrop-blur-md shadow-inner ${iconBg}`}>
            <Icon />
         </div>
      </div>
   </div>
);
