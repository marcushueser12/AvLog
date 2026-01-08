
import { GoogleGenAI, Type } from "@google/genai";
import { LogbookEntry, PageTotals } from "../types";
import { reconcileFlightTimes, reconcileIFRData } from "../utils/logbookUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Enhanced preprocessing: Grayscale + Contrast Boost + Unsharp Mask simulation.
 */
export const preprocessImage = async (base64Str: string): Promise<{ data: string; clarity: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve({ data: base64Str, clarity: 50 }); return; }
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Stage 1: Basic clean up
      ctx.filter = 'grayscale(100%) contrast(180%) brightness(110%)';
      ctx.drawImage(img, 0, 0);
      
      // Simple clarity check (average pixel brightness vs contrast)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let brightnessSum = 0;
      for (let i = 0; i < imageData.data.length; i += 40) {
        brightnessSum += imageData.data[i];
      }
      const avgBrightness = brightnessSum / (imageData.data.length / 40);
      const clarity = Math.min(100, Math.max(0, 100 - Math.abs(avgBrightness - 128)));

      resolve({ data: canvas.toDataURL('image/jpeg', 0.8), clarity });
    };
    img.src = base64Str;
  });
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
  const [pLeft, pRight] = await Promise.all([
    preprocessImage(leftImage),
    preprocessImage(rightImage)
  ]);

  const countHint = expectedCount ? ` NOTE: There are exactly ${expectedCount} flight entries to find and transcribe from these two pages.` : "";

  const response = await ai.models.generateContent({
    model: EXTRACTION_MODEL,
    contents: { 
      parts: [
        { text: `TRANSCRIBE PAIR: Match row numbers. Apply ADDITIVE-ONLY IFR cross-referencing from remarks. Blank = "".${countHint}` },
        { inlineData: { mimeType: 'image/jpeg', data: pLeft.data.split(',')[1] } },
        { inlineData: { mimeType: 'image/jpeg', data: pRight.data.split(',')[1] } }
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

  const rawText = response.text.trim();
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
  const clean = await preprocessImage(image);

  const countHint = expectedCount ? ` NOTE: There are exactly ${expectedCount} flight entries to find and transcribe from this page.` : "";

  const response = await ai.models.generateContent({
    model: EXTRACTION_MODEL,
    contents: { 
      parts: [
        { text: `TRANSCRIBE SINGLE: Apply ADDITIVE-ONLY IFR cross-referencing from remarks. Blank = "".${countHint}` },
        { inlineData: { mimeType: 'image/jpeg', data: clean.data.split(',')[1] } }
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

  const rawText = response.text.trim();
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
