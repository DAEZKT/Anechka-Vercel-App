# 📅 Guía de Manejo de Fechas y Zonas Horarias

## 🎓 Lección: El Problema de las Zonas Horarias

### ¿Por qué las fechas se guardaban incorrectamente?

Estabas en **GMT-6** (Centro América). Cuando usabas:

```javascript
new Date().toISOString().split('T')[0]
```

**El problema:**
1. `toISOString()` convierte la fecha a **UTC** (zona horaria 0)
2. Si son las 2:00 AM del 13 de febrero en tu zona (GMT-6):
   - En UTC son las 8:00 AM del 13 ✓ (funciona)
3. Pero si fueran las 11:00 PM del 13 en tu zona:
   - En UTC serían las 5:00 AM del **14** ✗ (¡cambia de día!)

### La Solución

Usar los componentes de fecha **locales** en lugar de UTC:

```javascript
const now = new Date();
const year = now.getFullYear();        // Año local
const month = String(now.getMonth() + 1).padStart(2, '0');  // Mes local
const day = String(now.getDate()).padStart(2, '0');         // Día local
const localDate = `${year}-${month}-${day}`;  // "2026-02-13"
```

## 📚 Mejores Prácticas

### 1. **Fechas de Negocio** (Facturas, Reportes, Filtros)

**Usar:** Solo la fecha sin hora → `DATE` en PostgreSQL

```typescript
import { getLocalDateString } from '../utils/dateUtils';

// Al crear un registro
const expense = {
  date: getLocalDateString(),  // "2026-02-13"
  supplier: "Walmart",
  total: 100
};

// Al filtrar por fecha
const dailyExpenses = allExpenses.filter(e => e.date === selectedDate);
```

**¿Por qué?**
- Las fechas de negocio son conceptuales (día de la factura)
- No importa la hora exacta, solo el día
- Evita problemas de zona horaria

### 2. **Marcatiempo** (Auditoría, Orden Cronológico)

**Usar:** Timestamp completo → `TIMESTAMPTZ` en PostgreSQL

```typescript
import { getTimestamp } from '../utils/dateUtils';

// Al crear un registro
const sale = {
  created_at: getTimestamp(),  // "2026-02-13T02:11:44.123Z"
  user_id: user.id,
  total: 500
};

// Al ordenar cronológicamente
const sortedSales = sales.sort((a, b) => 
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
);
```

**¿Por qué?**
- Necesitas saber la hora exacta del evento
- PostgreSQL maneja automáticamente las zonas horarias
- Útil para auditoría y trazabilidad

### 3. **Convertir Timestamps a Fechas Locales**

```typescript
import { toLocalDateString } from '../utils/dateUtils';

// Convertir timestamp de base de datos a fecha local
const saleDate = toLocalDateString(sale.created_at);  // "2026-02-13"

// Filtrar ventas del día
const dailySales = allSales.filter(s => 
  toLocalDateString(s.created_at) === selectedDate
);
```

## 🛠️ Funciones Utilitarias Disponibles

### En `utils/dateUtils.ts`:

| Función | Uso | Ejemplo |
|---------|-----|---------|
| `getLocalDateString()` | Obtener fecha actual local | `"2026-02-13"` |
| `getTimestamp()` | Obtener timestamp actual | `"2026-02-13T02:11:44.123Z"` |
| `toLocalDateString(date)` | Convertir cualquier fecha a YYYY-MM-DD local | `toLocalDateString(sale.created_at)` |
| `isSameDay(date1, date2)` | Comparar si dos fechas son el mismo día | `isSameDay(expense.date, today)` |
| `formatDateForDisplay(date)` | Formatear para mostrar al usuario | `"13 de febrero de 2026"` |
| `formatCurrency(amount)` | Formatear números como moneda | `"1,234.56"` |

## ✅ Checklist para Nuevas Funcionalidades

Cuando agregues nuevas funcionalidades con fechas:

- [ ] ¿Es una fecha de negocio o un timestamp?
- [ ] ¿Necesito filtrar por fecha? → Usa `toLocalDateString()`
- [ ] ¿Necesito ordenar cronológicamente? → Usa timestamps
- [ ] ¿Estoy guardando en la base de datos? → Usa `getLocalDateString()` para fechas
- [ ] ¿Estoy mostrando al usuario? → Usa `formatDateForDisplay()`

## 🔍 Debugging de Problemas de Fecha

Si ves fechas incorrectas:

1. **Verifica la zona horaria:**
   ```javascript
   console.log('Timezone offset:', new Date().getTimezoneOffset());
   // GMT-6 = 360 minutos
   ```

2. **Compara UTC vs Local:**
   ```javascript
   const now = new Date();
   console.log('UTC:', now.toISOString());
   console.log('Local:', getLocalDateString());
   ```

3. **Revisa el tipo de columna en PostgreSQL:**
   - `DATE` → Solo fecha, sin zona horaria ✓
   - `TIMESTAMP` → Fecha y hora, sin zona horaria
   - `TIMESTAMPTZ` → Fecha y hora con zona horaria ✓

## 📝 Ejemplos Prácticos

### Ejemplo 1: Registrar un Egreso

```typescript
const handleCreate = async () => {
  const expense = {
    date: getLocalDateString(),  // Fecha del día actual
    supplier: formData.supplier,
    total: parseFloat(formData.total),
    user_id: user.id
  };
  
  await expenseService.create(expense);
};
```

### Ejemplo 2: Filtrar Ventas del Día

```typescript
const loadDailyData = async () => {
  const allSales = await salesService.getAll();
  
  // Filtrar por fecha local
  const dailySales = allSales.filter(s => 
    toLocalDateString(s.created_at) === selectedDate
  );
};
```

### Ejemplo 3: Reporte Mensual

```typescript
import { isInMonth, getMonthYear } from '../utils/dateUtils';

const { month, year } = getMonthYear();

const monthlySales = allSales.filter(s => 
  isInMonth(s.created_at, month, year)
);
```

## 🎯 Resumen

**Regla de Oro:**
- **Fechas de negocio** → `getLocalDateString()` → `DATE` en DB
- **Timestamps de auditoría** → `getTimestamp()` → `TIMESTAMPTZ` en DB
- **Filtros y comparaciones** → `toLocalDateString()` para convertir

**Nunca uses:**
- ❌ `new Date().toISOString().split('T')[0]` → Puede cambiar de día
- ❌ Comparar timestamps directamente con fechas → Usa `toLocalDateString()`

**Siempre usa:**
- ✅ `getLocalDateString()` para fechas actuales
- ✅ `toLocalDateString()` para convertir timestamps
- ✅ Las funciones utilitarias en `utils/dateUtils.ts`

---

**Creado:** 13 de febrero de 2026  
**Autor:** Tu Mentor IA 🤖  
**Propósito:** Evitar problemas de zona horaria en tu aplicación
