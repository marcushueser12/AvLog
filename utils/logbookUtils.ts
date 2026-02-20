
import type { LogbookEntry } from "../types.js";

/**
 * Normalize aircraft ID - adds "N" prefix if not present and converts to uppercase
 * Examples: "123AB" -> "N123AB", "n123ab" -> "N123AB", "N123AB" -> "N123AB"
 * @param aircraftId - The aircraft ID to normalize
 * @param internationalMode - If true, skip adding "N" prefix (for international registrations)
 */
export const normalizeAircraftId = (aircraftId: string, internationalMode: boolean = false): string => {
  if (!aircraftId || typeof aircraftId !== 'string') return aircraftId;
  
  const trimmed = aircraftId.trim().toUpperCase();
  if (!trimmed) return trimmed;
  
  // If international mode is enabled, just return uppercase without adding "N"
  if (internationalMode) {
    return trimmed;
  }
  
  // If it doesn't start with "N", add it (USA mode)
  if (!trimmed.startsWith('N')) {
    return `N${trimmed}`;
  }
  
  return trimmed;
};

/**
 * Normalize date separators - converts any separator (., *, -, etc.) to "/"
 * Examples: "8.5" -> "8/5", "12.10" -> "12/10", "12*10" -> "12/10"
 */
export const normalizeDateSeparator = (dateStr: string): string => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  
  // If date already has "/" separator, return as-is
  if (dateStr.includes('/')) return dateStr;
  
  // Replace common non-slash separators with "/"
  // Handles: ., *, -, space, etc.
  return dateStr.replace(/[.*\s\-]/g, '/');
};

/**
 * Convert date from DD/MM format to MM/DD format
 * Examples: "25/12" -> "12/25", "01/05" -> "05/01"
 * Also handles YYYY: "25/12/2023" -> "12/25/2023"
 */
export const convertDDMMtoMMDD = (dateStr: string): string => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  
  // Process dates with "/" separator
  const parts = dateStr.trim().split('/');
  if (parts.length < 2 || parts.length > 3) return dateStr;
  
  const [first, second, third] = parts;
  
  // If first two parts are not numeric, don't convert
  if (!/^\d+$/.test(first) || !/^\d+$/.test(second)) return dateStr;
  
  // Swap the first two parts: DD/MM or DD/MM/YYYY -> MM/DD or MM/DD/YYYY
  if (parts.length === 3 && third) {
    return `${second}/${first}/${third}`;
  }
  return `${second}/${first}`;
};

/**
 * Convert date from YYYY-MM-DD (database format) to MM/DD/YYYY (display format)
 * Example: "2023-12-25" -> "12/25/2023"
 */
export const formatDateForDisplay = (dateStr: string | null | undefined): string => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
  
  // If already in MM/DD/YYYY format, return as-is
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) return dateStr;
  
  // If in YYYY-MM-DD format (database format), convert to MM/DD/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }
  
  // Try to parse as Date and format
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${month}/${day}/${year}`;
    }
  } catch {
    // If parsing fails, return original
  }
  
  return dateStr;
};

/**
 * Convert date from MM/DD/YYYY (display format) to YYYY-MM-DD (database format)
 * Example: "12/25/2023" -> "2023-12-25"
 */
export const formatDateForDatabase = (dateStr: string | null | undefined): string | null => {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') return null;
  
  const trimmed = dateStr.trim();
  
  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  
  // Parse MM/DD/YYYY format
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    if (/^\d+$/.test(month) && /^\d+$/.test(day) && /^\d+$/.test(year)) {
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      const yearNum = parseInt(year, 10);
      
      // Basic validation
      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum >= 1900 && yearNum <= 2100) {
        return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      }
    }
  }
  
  // Try to parse as Date and format
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // If parsing fails, return null
  }
  
  return null;
};

/**
 * Adjust the year for a date string (MM/DD/YYYY format)
 * Example: adjustYearForDate("12/25/2023", 2024) -> "12/25/2024"
 * Also handles dates without year: "12/25" -> "12/25/2024"
 */
export const adjustYearForDate = (dateStr: string, newYear: number): string => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  
  const trimmed = dateStr.trim();
  const parts = trimmed.split('/');
  
  // If already has year (MM/DD/YYYY), replace it
  if (parts.length === 3) {
    const [month, day] = parts;
    return `${month}/${day}/${newYear}`;
  }
  
  // If no year (MM/DD), add year
  if (parts.length === 2) {
    const [month, day] = parts;
    return `${month}/${day}/${newYear}`;
  }
  
  // If format doesn't match, try to parse and reformat
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${month}/${day}/${newYear}`;
    }
  } catch {
    // If parsing fails, return original
  }
  
  return dateStr;
};

/**
 * Reconciles day/night/total time based on the rule: 
 * Total Time = Day + Night
 * If night is blank/zero, day = totalTime.
 */
export const reconcileFlightTimes = (entry: Partial<LogbookEntry>): Partial<LogbookEntry> => {
  const total = parseFloat(entry.totalTime || "0") || 0;
  const night = parseFloat(entry.night || "0") || 0;
  
  // Rule: If no night time, total time is equal to day time
  if (night === 0) {
    return {
      ...entry,
      day: total > 0 ? total.toFixed(1) : entry.day
    };
  }

  // Rule: Night plus Day should equal Total Time
  const calculatedDay = Math.max(0, total - night);
  
  return {
    ...entry,
    day: calculatedDay.toFixed(1)
  };
};

/**
 * Reconciles IFR data (Actual, Simulated, Approaches) based on logic and comment keywords.
 */
export const reconcileIFRData = (entry: Partial<LogbookEntry>): Partial<LogbookEntry> => {
  const total = parseFloat(entry.totalTime || "0") || 0;
  const actual = parseFloat(entry.instrument || "0") || 0;
  const simulated = parseFloat(entry.simulatedInstrument || "0") || 0;
  const approaches = parseInt(entry.approaches || "0") || 0;
  const comments = (entry.comments || "").toLowerCase();

  const updates: Partial<LogbookEntry> = {
    uncertainFields: [...(entry.uncertainFields || [])]
  };

  // Rule 1: Logic Check (Actual + Simulated <= Total Time)
  // Instead of automatically reducing (which the user wants to avoid), we just flag it.
  if (actual + simulated > total && total > 0) {
    if (!updates.uncertainFields?.includes('instrument')) updates.uncertainFields?.push('instrument');
    if (!updates.uncertainFields?.includes('simulatedInstrument')) updates.uncertainFields?.push('simulatedInstrument');
    // We do NOT scale down here automatically anymore per user request that logic should not reduce values.
  }

  // Rule 2: Keyword detection in comments to validate IFR data
  const hasIFRKeywords = /imc|clouds|actual|ils|rnav|vor|approach|hood|foggles|simulated/.test(comments);
  
  // If comments suggest IFR but columns are empty, flag for review
  if (hasIFRKeywords && actual === 0 && simulated === 0 && approaches === 0) {
    if (!updates.uncertainFields?.includes('instrument')) updates.uncertainFields?.push('instrument');
    if (!updates.uncertainFields?.includes('simulatedInstrument')) updates.uncertainFields?.push('simulatedInstrument');
    if (!updates.uncertainFields?.includes('approaches')) updates.uncertainFields?.push('approaches');
  }

  // Rule 3: Approach logic
  if (approaches > 0 && actual === 0 && simulated === 0) {
     // Having approaches usually requires instrument time recorded
     if (!updates.uncertainFields?.includes('instrument')) updates.uncertainFields?.push('instrument');
  }

  return updates;
};

/**
 * Parse rowAnchor as numeric for sorting. Returns a number for comparison; null/empty = Infinity (sort last).
 */
export const parseRowAnchor = (rowAnchor: string | null | undefined): number => {
  if (!rowAnchor || typeof rowAnchor !== 'string') return Infinity;
  const n = parseInt(rowAnchor.trim(), 10);
  return isNaN(n) ? Infinity : n;
};

/**
 * Sort entries by rowAnchor (numeric order 1, 2, 3...) then by date. Ensures rows display in physical page order.
 */
export const sortEntriesByRowOrder = <T extends { rowAnchor?: string; date?: string }>(entries: T[], parseDateFn?: (d: string) => number): T[] => {
  const getDate = parseDateFn || ((d: string) => {
    if (!d) return 0;
    const parts = d.split('/');
    if (parts.length === 3) {
      const [m, day, y] = parts;
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(day)).getTime();
    }
    return new Date(d).getTime() || 0;
  });
  return [...entries].sort((a, b) => {
    const ra = parseRowAnchor(a.rowAnchor);
    const rb = parseRowAnchor(b.rowAnchor);
    if (ra !== rb) return ra - rb;
    return getDate(a.date || '') - getDate(b.date || '');
  });
};

/**
 * Validates if the row's time math is consistent.
 */
export const isTimeConsistent = (entry: LogbookEntry): boolean => {
  const total = Math.round((parseFloat(entry.totalTime) || 0) * 10);
  const night = Math.round((parseFloat(entry.night) || 0) * 10);
  const day = Math.round((parseFloat(entry.day) || 0) * 10);
  
  const ifrTotal = Math.round(((parseFloat(entry.instrument) || 0) + (parseFloat(entry.simulatedInstrument) || 0)) * 10);
  
  return total === (night + day) && ifrTotal <= total;
};
