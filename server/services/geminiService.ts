import { GoogleGenAI, Type } from "@google/genai";
import type { LogbookEntry, PageTotals } from "../../types.js";
import { reconcileFlightTimes, reconcileIFRData, sortEntriesByRowOrder } from "../../utils/logbookUtils.js";
import sharp from 'sharp';
import pRetry from 'p-retry';

// Initialize Gemini AI client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Enhanced preprocessing: Grayscale + Contrast Boost + Unsharp Mask simulation.
 * Server-side version using sharp for image processing.
 */
export const preprocessImage = async (base64Str: string): Promise<{ data: string; clarity: number }> => {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Str.includes(',') ? base64Str.split(',')[1] : base64Str;
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Process image with sharp
    const processedBuffer = await sharp(imageBuffer)
      .greyscale()
      .normalize() // Enhance contrast
      .modulate({
        brightness: 1.1,
        saturation: 0
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Convert back to base64
    const processedBase64 = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;

    // Calculate clarity score (simplified - based on image stats)
    const stats = await sharp(imageBuffer).stats();
    const avgBrightness = stats.channels[0]?.mean || 128;
    const clarity = Math.min(100, Math.max(0, 100 - Math.abs(avgBrightness - 128)));

    return { data: processedBase64, clarity };
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (msg.includes('heif') || msg.includes('HEIF') || msg.includes('HEIC') || msg.includes('compression format')) {
      throw new Error('HEIC/HEIF format is not supported. Please use JPG or PNG. On iPhone, go to Settings > Camera > Formats and choose "Most Compatible" to save as JPEG.');
    }
    console.error('Image preprocessing error:', error);
    throw new Error('Image could not be processed. Please use JPG or PNG format.');
  }
};

const LOGBOOK_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    rowChecksum: { type: Type.INTEGER, description: "The total number of rows detected across the image pair." },
    entries: {
      type: Type.ARRAY,
      description: "List of all flight entries detected on the pages.",
      items: {
        type: Type.OBJECT,
        properties: {
          rowAnchor: { type: Type.STRING, description: "The printed line number (e.g. 1, 2, 3) seen in the margin." },
          reconciliationConfidence: { type: Type.STRING, enum: ["high", "low"], description: "Confidence that the left and right page fragments for this row truly belong together." },
          date: { type: Type.STRING },
          aircraftId: { type: Type.STRING },
          aircraftType: { type: Type.STRING, description: "Type code from logbook (e.g. C172, SR22). Optional; some logbooks omit this." },
          aircraftModel: { type: Type.STRING, description: "Model from logbook (e.g. 172S). Optional; often same as aircraftType." },
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          comments: { type: Type.STRING },
          totalTime: { type: Type.STRING },
          day: { type: Type.STRING },
          night: { type: Type.STRING },
          crossCountry: { type: Type.STRING },
          pic: { type: Type.STRING },
          solo: { type: Type.STRING, description: "Solo flight time (time flown without an instructor)" },
          sic: { type: Type.STRING },
          dualReceived: { type: Type.STRING },
          dualGiven: { type: Type.STRING },
          instrument: { type: Type.STRING },
          simulatedInstrument: { type: Type.STRING },
          approaches: { type: Type.STRING },
          landingsDay: { type: Type.STRING },
          landingsNight: { type: Type.STRING },
          groundReceived: { type: Type.STRING, description: "Ground instruction received (training time)" },
          groundGiven: { type: Type.STRING, description: "Ground instruction given (as instructor)" },
          uncertainFields: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["rowAnchor", "reconciliationConfidence", "date", "aircraftId", "totalTime", "uncertainFields"]
      }
    },
    pageTotals: {
      type: Type.OBJECT,
      properties: {
        totalTime: { type: Type.STRING }
      }
    }
  },
  required: ["rowChecksum", "entries", "pageTotals"]
};

const SYSTEM_INSTRUCTION = `
  IDENTITY: Forensic Aviation Logbook Digitizer.
  MISSION: 1:1 Literal Transcription augmented by Remark Cross-Referencing.
  
  SPECIAL FOCUS: IFR CATEGORIES (Actual, Simulated, Approaches)
  1. IFR DATA: These columns are high-priority.
     - "Actual Inst" and "Simulated Inst" are usually decimals.
     - "Approaches" may contain digits or tally marks (e.g., "||" = "2").
  
  2. CRITICAL: INSTRUMENT TIME vs APPROACHES ARE INDEPENDENT
     - "Actual Instrument" time and "Simulated Instrument" time are TIME VALUES (hours/minutes).
     - "Approaches" is a COUNT of instrument approaches performed (numeric count).
     - DO NOT infer approaches from instrument time. Having instrument time does NOT mean approaches were performed.
     - DO NOT infer instrument time from approaches. Having approaches does NOT mean instrument time was logged.
     - Extract each field independently from its dedicated column only.
     - Only extract approaches from the "Approaches" column or remarks, never from instrument time values.
  
  3. COMMENT/REMARK CROSS-REFERENCE (CRITICAL RULE: ADDITIVE ONLY):
     - Read the "Comments" or "Remarks" section.
     - If Remarks suggest HIGHER values than the columns (e.g. Remarks say "3x ILS" but column has "2"), update column to the HIGHER value.
     - If Remarks suggest LOWER values (e.g. Remarks say "1 approach" but column has "2"), RETAIN the column's original "2".
     - REASONING FROM REMARKS MUST NEVER REDUCE THE TRANSCRIPTION OF DEDICATED IFR COLUMNS. 
     - Columns always represent the "Minimum Found".
  
  4. FLIGHT INSTRUCTOR TIME (DUAL GIVEN):
     - If any column, time entry, or remark mentions "as flight instructor", "flight instructor", "CFI", "instructor", or similar instructor-related terminology, that time should be recorded in the "Dual Given" field.
     - Time logged "as flight instructor" or with instructor notation is dual instruction given to a student, not dual instruction received.
     - Extract the time value and place it in the "dualGiven" field, not "dualReceived".
     - This applies to any time column (Total Time, PIC, etc.) that has instructor notation or mentions.
  
  STRICT RECONCILIATION PROTOCOL:
  1. ANCHORING: Use printed line numbers (1, 2, 3...) at margins.
  2. ZERO-INFERENCE: Blank paper = "". 
  3. ARTIFACT REJECTION: Ignore ink bleeding.
  4. CHECKSUM: Count entries first.
  5. FORMAT: Produce a single compact JSON object.
  6. ROW ORDER: Output entries in strict rowAnchor numeric order (1, 2, 3...). Do not mix rows.
  7. AIRCRAFT: Extract aircraftType when present (e.g. C172, SR22). Some logbooks omit type and make—leave blank if not visible.
  8. HOURS/TENTHS: Some logbooks write "1/5" for 1.5 hrs (hours + tenths). The slash is a decimal separator, not concatenation. Output "1.5", not "15".
`;

const EXTRACTION_MODEL = 'gemini-3-flash-preview';
const MAX_OUTPUT_TOKENS = 64000;
const FLASH_THINKING_BUDGET = 0;

/**
 * Custom error class for Gemini API errors that should be retried
 */
export class GeminiRetryableError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'GeminiRetryableError';
    this.statusCode = statusCode;
  }
}

/**
 * Check if an error is a retryable Gemini API error (503, 429)
 */
const isRetryableError = (error: any): boolean => {
  // Check for status code in error object
  const statusCode = error?.statusCode || error?.status || error?.code;
  if (statusCode === 503 || statusCode === 429) {
    return true;
  }
  
  // Check error message for common retryable patterns
  const message = (error?.message || '').toLowerCase();
  if (message.includes('503') || message.includes('429') ||
      message.includes('overloaded') || message.includes('rate limit') ||
      message.includes('resource_exhausted') || message.includes('unavailable') ||
      message.includes('fetch failed') || message.includes('econnreset') ||
      message.includes('etimedout') || message.includes('enotfound') ||
      message.includes('network') || message.includes('socket hang up')) {
    return true;
  }
  if (error?.name === 'TypeError' && message.includes('fetch')) return true;
  return false;
};

/**
 * Retry wrapper with exponential backoff for Gemini API calls
 * Retries on 503 and 429 errors with exponential backoff (2s, 4s, 8s, ...)
 */
const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  return pRetry(fn, {
    retries: 4, // Max 4 retries (5 total attempts)
    minTimeout: 2000, // Initial delay: 2 seconds
    maxTimeout: 16000, // Max delay: 16 seconds
    factor: 2, // Exponential factor: 2s, 4s, 8s, 16s
    shouldRetry: (error: any) => {
      // Only retry if it's a retryable error
      return isRetryableError(error);
    },
    onFailedAttempt: (error: any) => {
      const errorMessage = error?.message || error?.error?.message || String(error);
      console.warn(`Gemini API call failed (attempt ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber}):`, errorMessage);
    }
  });
}; 

export const extractLogbookEntriesFromPair = async (leftImage: string, rightImage: string, expectedCount?: number): Promise<any> => {
  const ai = getGeminiClient();
  
  const [pLeft, pRight] = await Promise.all([
    preprocessImage(leftImage),
    preprocessImage(rightImage)
  ]);

  const countHint = expectedCount ? ` NOTE: There are exactly ${expectedCount} flight entries to find and transcribe from these two pages.` : "";

  // Extract base64 data from data URL
  const leftBase64 = pLeft.data.includes(',') ? pLeft.data.split(',')[1] : pLeft.data;
  const rightBase64 = pRight.data.includes(',') ? pRight.data.split(',')[1] : pRight.data;

  // Wrap API call with retry logic
  const response = await withRetry(async () => {
    try {
      return await ai.models.generateContent({
        model: EXTRACTION_MODEL,
        contents: { 
          parts: [
            { text: `TRANSCRIBE PAIR: Match row numbers. Apply ADDITIVE-ONLY IFR cross-referencing from remarks. Blank = "".${countHint}` },
            { inlineData: { mimeType: 'image/jpeg', data: leftBase64 } },
            { inlineData: { mimeType: 'image/jpeg', data: rightBase64 } }
          ] 
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: LOGBOOK_RESPONSE_SCHEMA as any,
          temperature: 0,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingBudget: FLASH_THINKING_BUDGET }
        }
      });
    } catch (error: any) {
      // Check if this is a retryable error
      if (isRetryableError(error)) {
        const statusCode = error?.statusCode || error?.status || error?.code || 503;
        throw new GeminiRetryableError(error.message || 'Gemini API is temporarily unavailable', statusCode);
      }
      // Non-retryable errors are rethrown immediately
      throw error;
    }
  });

  const rawText = response.text?.trim() || "";
  try {
    const parsed = JSON.parse(rawText || '{"entries": [], "rowChecksum": 0, "pageTotals": {}}');
    let mapped = (parsed.entries || []).map((r: any, i: number) => {
      let entry = {
        ...r,
        aircraftModel: r.aircraftModel || r.aircraftType || "",
        id: `s-${Date.now()}-${i}`,
        route: r.route || "",
        comments: r.comments || "",
        solo: r.solo || "",
        groundReceived: r.groundReceived || "",
        groundGiven: r.groundGiven || "",
        uncertainFields: r.uncertainFields || []
      };

      // Apply website-side reconciliation
      entry = { ...entry, ...reconcileFlightTimes(entry) } as any;
      entry = { ...entry, ...reconcileIFRData(entry) } as any;

      return entry;
    });
    mapped = sortEntriesByRowOrder(mapped);
    return { entries: mapped, pageTotals: parsed.pageTotals || {} };
  } catch (e) {
    console.error("Failed to parse AI response as JSON. Raw output length:", rawText.length);
    throw new Error(`Extraction failed: The AI response was incomplete or malformed. (Len: ${rawText.length})`);
  }
};

export const extractLogbookEntriesSingle = async (image: string, expectedCount?: number): Promise<any> => {
  const ai = getGeminiClient();
  
  const clean = await preprocessImage(image);

  const countHint = expectedCount ? ` NOTE: There are exactly ${expectedCount} flight entries to find and transcribe from this page.` : "";

  // Extract base64 data from data URL
  const imageBase64 = clean.data.includes(',') ? clean.data.split(',')[1] : clean.data;

  // Wrap API call with retry logic
  const response = await withRetry(async () => {
    try {
      return await ai.models.generateContent({
        model: EXTRACTION_MODEL,
        contents: { 
          parts: [
            { text: `TRANSCRIBE SINGLE: Apply ADDITIVE-ONLY IFR cross-referencing from remarks. Blank = "".${countHint}` },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
          ] 
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: LOGBOOK_RESPONSE_SCHEMA as any,
          temperature: 0,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingBudget: FLASH_THINKING_BUDGET }
        }
      });
    } catch (error: any) {
      // Check if this is a retryable error
      if (isRetryableError(error)) {
        const statusCode = error?.statusCode || error?.status || error?.code || 503;
        throw new GeminiRetryableError(error.message || 'Gemini API is temporarily unavailable', statusCode);
      }
      // Non-retryable errors are rethrown immediately
      throw error;
    }
  });

  const rawText = response.text?.trim() || "";
  try {
    const parsed = JSON.parse(rawText || '{"entries": [], "rowChecksum": 0, "pageTotals": {}}');
    let mapped = (parsed.entries || []).map((r: any, i: number) => {
      let entry = {
        ...r,
        aircraftModel: r.aircraftModel || r.aircraftType || "",
        id: `p-${Date.now()}-${i}`,
        route: r.route || "",
        comments: r.comments || "",
        solo: r.solo || "",
        groundReceived: r.groundReceived || "",
        groundGiven: r.groundGiven || "",
        uncertainFields: r.uncertainFields || []
      };

      // Apply website-side reconciliation
      entry = { ...entry, ...reconcileFlightTimes(entry) } as any;
      entry = { ...entry, ...reconcileIFRData(entry) } as any;

      return entry;
    });
    mapped = sortEntriesByRowOrder(mapped);
    return { entries: mapped, pageTotals: parsed.pageTotals || {} };
  } catch (e) {
    console.error("Failed to parse AI response as JSON. Raw output length:", rawText.length);
    throw new Error(`Extraction failed: The AI response was incomplete or malformed. (Len: ${rawText.length})`);
  }
};
