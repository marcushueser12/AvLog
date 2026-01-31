
import type { LogbookEntry, AircraftProfile } from "../types.js";
import { FOREFLIGHT_FLIGHT_HEADERS, FOREFLIGHT_AIRCRAFT_HEADERS } from "../constants.js";

/**
 * Ensures a value is safe for a CSV cell by escaping quotes and wrapping in quotes if needed.
 */
const escapeCSV = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return "";
  const str = String(value).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Formats numeric values to exactly one decimal place if they are numbers.
 */
const formatNumeric = (value: string): string => {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toFixed(1);
};

/**
 * Creates a row with exactly 71 columns, padding with spaces (not empty strings) to match ForeFlight template
 */
const createRow = (values: string[]): string => {
  const padded = [...values];
  while (padded.length < 71) {
    padded.push(' '); // Use space, not empty string, to match template
  }
  return padded.slice(0, 71).join(',');
};

/**
 * Formats date to MM/DD/YYYY format required by ForeFlight
 * Handles various input formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, etc.
 */
const formatDateForForeFlight = (dateStr: string | undefined): string => {
  if (!dateStr || !dateStr.trim()) return "";
  
  const trimmed = dateStr.trim();
  
  // If already in MM/DD/YYYY format, return as-is
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const parts = trimmed.split('/');
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${month}/${day}/${year}`;
  }
  
  // If in YYYY-MM-DD format (database format), convert to MM/DD/YYYY
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    return `${month}/${day}/${year}`;
  }
  
  // If in DD/MM/YYYY or DD.MM.YYYY format, convert to MM/DD/YYYY
  if (/^\d{1,2}[\/\.]\d{1,2}[\/\.]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[\/\.]/);
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${month}/${day}/${year}`;
  }
  
  // If in MM/DD format (no year), try to infer year or return as-is
  if (/^\d{1,2}\/\d{1,2}$/.test(trimmed)) {
    return trimmed; // ForeFlight might handle this, or user needs to fix
  }
  
  // If we can't parse it, return as-is (might cause ForeFlight to reject, but better than empty)
  return trimmed;
};

export const generateForeFlightCSV = (entries: LogbookEntry[], aircraftProfiles: AircraftProfile[] = []): string => {
  const csvRows: string[] = [];

  // 1. Mandatory Header Row - must match template exactly
  csvRows.push(createRow([
    "ForeFlight Logbook Import ",
    "This row is required for importing into ForeFlight. Do not delete or modify. "
  ]));
  
  // 2. Empty row with spaces
  csvRows.push(createRow([]));

  // 3. Aircraft Table Section (ForeFlight uses this to define aircraft profiles)
  csvRows.push(createRow(["Aircraft Table"]));
  
  // 4. Sub-header for Aircraft Table (Data Types)
  csvRows.push(createRow([
    "Text", "Text", "Text", "YYYY", "Text", "Text", "Text", "Text", "Text", 
    "Boolean", "Boolean", "Boolean", "Boolean"
  ]));
  
  // 5. Headers for Aircraft Table
  csvRows.push(createRow(FOREFLIGHT_AIRCRAFT_HEADERS));
  
  // 6-11. Empty rows with spaces (6 empty rows as per template)
  for (let i = 0; i < 6; i++) {
    csvRows.push(createRow([]));
  }
  
  // 12. Aircraft data rows
  const uniqueAircraftIds = Array.from(new Set(entries.map(e => e.aircraftId).filter(id => id && id.trim())));
  
  uniqueAircraftIds.forEach(aircraftId => {
    // Try to find saved profile first
    const profile = aircraftProfiles.find(p => p.aircraftId === aircraftId);
    
    if (profile) {
      // Use saved profile data
      const row = [
        escapeCSV(profile.aircraftId),
        escapeCSV(profile.equipmentType || ''),
        escapeCSV(profile.typeCode || ''),
        escapeCSV(profile.year || ''),
        escapeCSV(profile.make || ''),
        escapeCSV(profile.model || ''),
        escapeCSV(profile.gearType || ''),
        escapeCSV(profile.engineType || ''),
        escapeCSV(profile.categoryClass || ''),
        profile.complex ? 'TRUE' : '',
        profile.highPerformance ? 'TRUE' : '',
        profile.pressurized ? 'TRUE' : '',
        profile.taa ? 'TRUE' : ''
      ];
      csvRows.push(createRow(row));
    } else {
      // Fall back to basic data from entries
      const firstMatch = entries.find(e => e.aircraftId === aircraftId);
      const row = [
        escapeCSV(aircraftId),
        "", // EquipmentType
        escapeCSV(firstMatch?.aircraftType || ""), // TypeCode
        "", // Year
        "", // Make
        "", // Model
        "", // GearType
        "", // EngineType
        "", // Category/Class
        "", // Complex
        "", // High Performance
        "", // Pressurized
        ""  // TAA
      ];
      csvRows.push(createRow(row));
    }
  });

  // 13. Flights Table Section
  csvRows.push(createRow(["Flights Table"]));
  
  // 14. Data Types for Flights Table (ForeFlight uses these to parse values)
  const flightDataTypes = FOREFLIGHT_FLIGHT_HEADERS.map(h => {
    if (["Date"].includes(h)) return "Date";
    if (["TotalTime", "PIC", "SIC", "Solo", "Night", "CrossCountry", "ActualInstrument", "SimulatedInstrument", "GroundTraining", "GroundTrainingGiven", "DualGiven", "DualReceived", "Day", "SimulatedFlight"].includes(h)) return "Decimal or HH:MM";
    if (["DayTakeoffs", "DayLandingsFullStop", "NightTakeoffs", "NightLandingsFullStop", "AllLandings", "Approaches", "Holds"].includes(h)) return "Number";
    if (["TimeOut", "TimeOff", "TimeOn", "TimeIn", "OnDuty", "OffDuty"].includes(h)) return "HH:MM";
    return "Text";
  });
  csvRows.push(createRow(flightDataTypes));
  
  // 15. Official Column Headers for Flights Table
  csvRows.push(createRow(FOREFLIGHT_FLIGHT_HEADERS));

  // 16+. The Data Rows
  entries.forEach(entry => {
    // Map existing LogbookEntry to the 71 columns of the Flights Table
    // Ensure we always return exactly 71 values (one per header)
    const row = FOREFLIGHT_FLIGHT_HEADERS.map(header => {
      switch (header) {
        case "Date": return formatDateForForeFlight(entry.date);
        case "AircraftID": return escapeCSV(entry.aircraftId);
        case "From": return escapeCSV(entry.from);
        case "To": return escapeCSV(entry.to);
        case "Route": return escapeCSV(entry.route);
        case "TotalTime": return formatNumeric(entry.totalTime);
        case "PIC": return formatNumeric(entry.pic);
        case "SIC": return formatNumeric(entry.sic);
        case "Solo": return formatNumeric(entry.solo);
        case "Night": return formatNumeric(entry.night);
        case "Day": return formatNumeric(entry.day);
        case "CrossCountry": return formatNumeric(entry.crossCountry);
        case "ActualInstrument": return formatNumeric(entry.instrument);
        case "SimulatedInstrument": return formatNumeric(entry.simulatedInstrument);
        case "GroundTraining": return formatNumeric(entry.groundReceived);
        case "GroundTrainingGiven": return formatNumeric(entry.groundGiven);
        case "Approaches": return entry.approaches || "";
        case "Approach1": {
          const approaches = entry.approachDetails || [];
          if (approaches.length > 0) {
            const ap = approaches[0];
            return escapeCSV(`${ap.number || ''};${ap.type || ''};${ap.runway || ''};${ap.airport || ''};${ap.comments || ''}`);
          }
          return "";
        }
        case "Approach2": {
          const approaches = entry.approachDetails || [];
          if (approaches.length > 1) {
            const ap = approaches[1];
            return escapeCSV(`${ap.number || ''};${ap.type || ''};${ap.runway || ''};${ap.airport || ''};${ap.comments || ''}`);
          }
          return "";
        }
        case "Approach3": {
          const approaches = entry.approachDetails || [];
          if (approaches.length > 2) {
            const ap = approaches[2];
            return escapeCSV(`${ap.number || ''};${ap.type || ''};${ap.runway || ''};${ap.airport || ''};${ap.comments || ''}`);
          }
          return "";
        }
        case "Approach4": {
          const approaches = entry.approachDetails || [];
          if (approaches.length > 3) {
            const ap = approaches[3];
            return escapeCSV(`${ap.number || ''};${ap.type || ''};${ap.runway || ''};${ap.airport || ''};${ap.comments || ''}`);
          }
          return "";
        }
        case "Approach5": {
          const approaches = entry.approachDetails || [];
          if (approaches.length > 4) {
            const ap = approaches[4];
            return escapeCSV(`${ap.number || ''};${ap.type || ''};${ap.runway || ''};${ap.airport || ''};${ap.comments || ''}`);
          }
          return "";
        }
        case "Approach6": {
          const approaches = entry.approachDetails || [];
          if (approaches.length > 5) {
            const ap = approaches[5];
            return escapeCSV(`${ap.number || ''};${ap.type || ''};${ap.runway || ''};${ap.airport || ''};${ap.comments || ''}`);
          }
          return "";
        }
        case "DayLandingsFullStop": return entry.landingsDay || "";
        case "NightLandingsFullStop": return entry.landingsNight || "";
        case "AllLandings": {
            const d = parseInt(entry.landingsDay || "0");
            const n = parseInt(entry.landingsNight || "0");
            return (d + n).toString();
        }
        case "DualGiven": return formatNumeric(entry.dualGiven);
        case "DualReceived": return formatNumeric(entry.dualReceived);
        case "PilotComments": return escapeCSV(entry.comments);
        default: return ""; // Everything else empty
      }
    });
    csvRows.push(createRow(row));
  });

  // Use Windows line endings (\r\n) to match ForeFlight template
  return csvRows.join('\r\n');
};

export const downloadCSV = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
