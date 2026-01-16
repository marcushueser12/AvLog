
import type { LogbookEntry } from "../types.js";

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
 * Validates if the row's time math is consistent.
 */
export const isTimeConsistent = (entry: LogbookEntry): boolean => {
  const total = Math.round((parseFloat(entry.totalTime) || 0) * 10);
  const night = Math.round((parseFloat(entry.night) || 0) * 10);
  const day = Math.round((parseFloat(entry.day) || 0) * 10);
  
  const ifrTotal = Math.round(((parseFloat(entry.instrument) || 0) + (parseFloat(entry.simulatedInstrument) || 0)) * 10);
  
  return total === (night + day) && ifrTotal <= total;
};
