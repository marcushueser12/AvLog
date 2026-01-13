import { GoogleGenAI, Type } from "@google/genai";
import type { LogbookEntry, PageTotals } from "../../types.js";
import { reconcileFlightTimes, reconcileIFRData } from "../../utils/logbookUtils.js";
import sharp from 'sharp';

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
  } catch (error) {
    console.error('Image preprocessing error:', error);
    // Return original if processing fails
    return { data: base64Str, clarity: 50 };
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
          aircraftType: { type: Type.STRING },
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          comments: { type: Type.STRING },
          totalTime: { type: Type.STRING },
          day: { type: Type.STRING },
          night: { type: Type.STRING },
          crossCountry: { type: Type.STRING },
          pic: { type: Type.STRING },
          sic: { type: Type.STRING },
          dualReceived: { type: Type.STRING },
          dualGiven: { type: Type.STRING },
          instrument: { type: Type.STRING },
          simulatedInstrument: { type: Type.STRING },
          approaches: { type: Type.STRING },
          landingsDay: { type: Type.STRING },
          landingsNight: { type: Type.STRING },
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
  
  2. COMMENT/REMARK CROSS-REFERENCE (CRITICAL RULE: ADDITIVE ONLY):
     - Read the "Comments" or "Remarks" section.
     - If Remarks suggest HIGHER values than the columns (e.g. Remarks say "3x ILS" but column has "2"), update column to the HIGHER value.
     - If Remarks suggest LOWER values (e.g. Remarks say "1 approach" but column has "2"), RETAIN the column's original "2".
     - REASONING FROM REMARKS MUST NEVER REDUCE THE TRANSCRIPTION OF DEDICATED IFR COLUMNS. 
     - Columns always represent the "Minimum Found".
  
  STRICT RECONCILIATION PROTOCOL:
  1. ANCHORING: Use printed line numbers (1, 2, 3...) at margins.
  2. ZERO-INFERENCE: Blank paper = "". 
  3. ARTIFACT REJECTION: Ignore ink bleeding.
  4. CHECKSUM: Count entries first.
  5. FORMAT: Produce a single compact JSON object.
`;

const EXTRACTION_MODEL = 'gemini-3-flash-preview';
const MAX_OUTPUT_TOKENS = 64000;
const FLASH_THINKING_BUDGET = 0; 

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

  const response = await ai.models.generateContent({
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

  const rawText = response.text?.trim() || "";
  try {
    const parsed = JSON.parse(rawText || '{"entries": [], "rowChecksum": 0, "pageTotals": {}}');
    return {
      entries: (parsed.entries || []).map((r: any, i: number) => {
        let entry = {
          ...r, 
          id: `s-${Date.now()}-${i}`, 
          route: r.route || "", 
          comments: r.comments || "",
          uncertainFields: r.uncertainFields || []
        };
        
        // Apply website-side reconciliation
        entry = { ...entry, ...reconcileFlightTimes(entry) } as any;
        entry = { ...entry, ...reconcileIFRData(entry) } as any;
        
        return entry;
      }),
      pageTotals: parsed.pageTotals || {}
    };
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

  const response = await ai.models.generateContent({
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

  const rawText = response.text?.trim() || "";
  try {
    const parsed = JSON.parse(rawText || '{"entries": [], "rowChecksum": 0, "pageTotals": {}}');
    return {
      entries: (parsed.entries || []).map((r: any, i: number) => {
        let entry = {
          ...r, 
          id: `p-${Date.now()}-${i}`, 
          route: r.route || "", 
          comments: r.comments || "",
          uncertainFields: r.uncertainFields || []
        };
        
        // Apply website-side reconciliation
        entry = { ...entry, ...reconcileFlightTimes(entry) } as any;
        entry = { ...entry, ...reconcileIFRData(entry) } as any;
        
        return entry;
      }),
      pageTotals: parsed.pageTotals || {}
    };
  } catch (e) {
    console.error("Failed to parse AI response as JSON. Raw output length:", rawText.length);
    throw new Error(`Extraction failed: The AI response was incomplete or malformed. (Len: ${rawText.length})`);
  }
};
