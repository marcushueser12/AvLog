
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

/**
 * Approach detail for ForeFlight import
 * Format: #;type;runway;airport;comments
 */
export interface ApproachDetail {
  number?: string; // Approach number (#)
  type?: string; // Approach type (ILS, RNAV, VOR, etc.)
  runway?: string; // Runway identifier
  airport?: string; // Airport identifier
  comments?: string; // Additional comments
}

export interface LogbookEntry {
  id: string;
  scanId?: string; 
  date: string;
  aircraftId: string;
  aircraftType: string;
  aircraftModel?: string; // Model from logbook (e.g. 172S). Often same as aircraftType.
  from: string;
  to: string;
  route: string;
  totalTime: string;
  day: string;
  night: string;
  crossCountry: string;
  pic: string;
  solo: string;
  sic: string;
  dualReceived: string;
  dualGiven: string;
  instrument: string;
  simulatedInstrument: string;
  approaches: string;
  landingsDay: string;
  landingsNight: string;
  groundReceived: string;
  groundGiven: string;
  comments: string;
  isVerified?: boolean;
  aiConfidence?: 'high' | 'low';
  reconciliationConfidence?: 'high' | 'low'; // Specifically for left/right page matching
  uncertainFields?: string[]; 
  validationError?: string;
  rowAnchor?: string; // The physical line number from the page
  fieldBoundingBoxes?: FieldBoundingBoxes; // Bounding boxes for each field on the image
  approachDetails?: ApproachDetail[]; // Array of approach details (max 6) for ForeFlight import
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
  creditApproved?: boolean; // If true, user approved results and 1 credit was deducted; enables editing
  sourceCloudUploadIds?: string[]; // UUIDs from cloud_uploads when scan was imported from cloud
}

export interface CloudUpload {
  id: string;
  user_id: string;
  storage_path: string;
  status: 'pending' | 'processed';
  created_at: string;
  /** When set, rows with the same id form a spread pair for import on desktop. */
  upload_group_id?: string | null;
}

export interface AircraftProfile {
  id: string;
  userId: string;
  aircraftId: string; // Tail number/registration (e.g., "N123AB")
  equipmentType: string; // Full equipment description
  typeCode: string; // ICAO type code (e.g., "C172", "SR22")
  year: string; // Year (YYYY format)
  make: string; // Manufacturer (e.g., "Cessna")
  model: string; // Model name (e.g., "172S")
  gearType: string; // "Fixed", "Retractable", etc.
  engineType: string; // "Single", "Twin", "Turbo", etc.
  categoryClass: string; // "Airplane/Single Engine Land", etc.
  complex: boolean; // Complex aircraft
  highPerformance: boolean; // High performance
  pressurized: boolean; // Pressurized
  taa: boolean; // Technically Advanced Aircraft
  createdAt?: string;
  updatedAt?: string;
}

export type AppTab = 'dashboard' | 'tutorial' | 'permanent-log' | 'aircraft' | 'reviews';

export type AppStatus = 'idle' | 'dashboard' | 'reviewing';
