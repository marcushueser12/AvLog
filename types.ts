
export interface PageTotals {
  totalTime?: string;
  instrument?: string;
  simulatedInstrument?: string;
  approaches?: string;
  pic?: string;
}

export interface LogbookEntry {
  id: string;
  scanId?: string; 
  date: string;
  aircraftId: string;
  aircraftType: string;
  from: string;
  to: string;
  route: string;
  totalTime: string;
  day: string;
  night: string;
  crossCountry: string;
  pic: string;
  sic: string;
  dualReceived: string;
  dualGiven: string;
  instrument: string;
  simulatedInstrument: string;
  approaches: string;
  landingsDay: string;
  landingsNight: string;
  comments: string;
  isVerified?: boolean;
  aiConfidence?: 'high' | 'low';
  reconciliationConfidence?: 'high' | 'low'; // Specifically for left/right page matching
  uncertainFields?: string[]; 
  validationError?: string;
  rowAnchor?: string; // The physical line number from the page
}

export type ScanMode = 'single' | 'spread';

export type ScanStatus = 'pending' | 'processing' | 'completed' | 'error' | 'verified';

export interface ScanDocument {
  id: string;
  images: string[]; 
  mode: ScanMode;
  status: ScanStatus;
  timestamp: number;
  error?: string;
  resultsCount?: number;
  extractedTotals?: PageTotals;
  clarityScore?: number; // 0-100 score of image contrast/sharpness
  expectedEntries?: number; // User-provided hint for the AI
}

export type AppTab = 'dashboard' | 'tutorial' | 'permanent-log' | 'aircraft' | 'stats';

export type AppStatus = 'idle' | 'dashboard' | 'reviewing';
