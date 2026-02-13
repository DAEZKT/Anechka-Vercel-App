/**
 * Utility functions for date handling with proper timezone support
 * 
 * IMPORTANT CONCEPTS:
 * 1. Business Dates (invoices, reports): Use DATE type in DB, store as YYYY-MM-DD in local timezone
 * 2. Timestamps (audit, chronological order): Use TIMESTAMPTZ in DB, store with full ISO string
 * 
 * TIMEZONE ISSUE:
 * - toISOString() converts to UTC, which can shift dates backwards in negative timezones
 * - Example: 2026-02-13 01:00 GMT-6 → 2026-02-13T07:00:00Z (UTC) → splits to "2026-02-13" ✓
 * - Example: 2026-02-13 23:00 GMT-6 → 2026-02-14T05:00:00Z (UTC) → splits to "2026-02-14" ✗
 * 
 * SOLUTION: Use local date components instead of UTC conversion
 */

/**
 * Get current date in YYYY-MM-DD format using LOCAL timezone
 * Use this for business dates (invoices, expense dates, report filters)
 * 
 * @returns {string} Date string in YYYY-MM-DD format (e.g., "2026-02-13")
 */
export const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get current timestamp in ISO format with timezone
 * Use this for audit trails and chronological ordering
 * 
 * @returns {string} ISO timestamp (e.g., "2026-02-13T02:11:44.123Z")
 */
export const getTimestamp = (): string => {
    return new Date().toISOString();
};

/**
 * Convert a Date object or ISO string to local YYYY-MM-DD format
 * Useful for displaying dates from the database
 * 
 * @param {Date | string} date - Date object or ISO string
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const toLocalDateString = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return getLocalDateString(d);
};

/**
 * Extract the date part directly from an ISO string (YYYY-MM-DD)
 * Use this for fields stored as DATE (Business Dates) where timezone conversion is unwanted
 * 
 * @param {string} dateString - ISO string or YYYY-MM-DD string
 * @returns {string} Date string (YYYY-MM-DD)
 */
export const getBusinessDateString = (dateString: string): string => {
    if (!dateString) return '';
    return dateString.substring(0, 10);
};

/**
 * Check if two dates are the same day (ignoring time)
 * 
 * @param {Date | string} date1 - First date
 * @param {Date | string} date2 - Second date
 * @returns {boolean} True if same day in local timezone
 */
export const isSameDay = (date1: Date | string, date2: Date | string): boolean => {
    return toLocalDateString(date1) === toLocalDateString(date2);
};

/**
 * Get date range for filtering (start and end of day in local timezone)
 * 
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {{ start: Date, end: Date }} Start and end of day
 */
export const getDateRange = (dateString: string): { start: Date; end: Date } => {
    const [year, month, day] = dateString.split('-').map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    return { start, end };
};

/**
 * Format date for display (e.g., "13 de febrero de 2026")
 * 
 * @param {Date | string} date - Date to format
 * @param {string} locale - Locale for formatting (default: 'es-ES')
 * @returns {string} Formatted date string
 */
export const formatDateForDisplay = (
    date: Date | string,
    locale: string = 'es-ES'
): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

/**
 * Get month and year for filtering
 * 
 * @param {Date} date - Date object (default: current date)
 * @returns {{ month: number, year: number }} Month (0-11) and year
 */
export const getMonthYear = (date: Date = new Date()): { month: number; year: number } => {
    return {
        month: date.getMonth(),
        year: date.getFullYear()
    };
};

/**
 * Check if a date is within a specific month
 * 
 * @param {Date | string} date - Date to check
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @returns {boolean} True if date is in the specified month
 */
export const isInMonth = (date: Date | string, month: number, year: number): boolean => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.getMonth() === month && d.getFullYear() === year;
};

/**
 * Format number as currency
 * 
 * @param {number} amount - Amount to format
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount: number, locale: string = 'en-US'): string => {
    return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
