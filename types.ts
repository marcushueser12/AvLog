
export interface PageTotals {
  totalTime?: string;
  day?: string;
  night?: string;
  crossCountry?: string;
  pic?: string;
  sic?: string;
  dualReceived?: string;
  dualGiven?: string;
  instrument?: string;
  simulatedInstrument?: string;
  approaches?: string;
  landingsDay?: string;
  landingsNight?: string;
}

/**
 * Bounding box coordinates normalized to [0, 1] range
 * Format: [ymin, xmin, ymax, xmax]
 * For pair mode: imageIndex indicates which image (0 = left, 1 = right)
 */
export interface BoundingBox {
  coordinates: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  imageIndex?: number; // For pair mode: 0 = left image, 1 = right image. For single mode: undefined or 0
}

/**
 * Map of field names to their bounding boxes on the image
 */
export type FieldBoundingBoxes = Partial<Record<keyof LogbookEntry, BoundingBox>>;

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
  fieldBoundingBoxes?: FieldBoundingBoxes; // Bounding boxes for each field on the image
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
  imageRotations?: number[]; // Rotation in degrees for each image (e.g., [0, 0] or [90, -90]). Defaults to [0, 0]
  pageNumber?: number; // Page number for this extraction (starting at 1)
  isVerified?: boolean; // Whether this scan has been verified
}

export type AppTab = 'dashboard' | 'tutorial' | 'permanent-log' | 'aircraft' | 'stats';

export type AppStatus = 'idle' | 'dashboard' | 'reviewing';
