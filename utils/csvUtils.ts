
import { LogbookEntry } from "../types";
import { FOREFLIGHT_FLIGHT_HEADERS, FOREFLIGHT_AIRCRAFT_HEADERS } from "../constants";

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

export const generateForeFlightCSV = (entries: LogbookEntry[]): string => {
  const csvRows: string[] = [];

  // 1. Mandatory Header Row
  csvRows.push("ForeFlight Logbook Import ,This row is required for importing into ForeFlight. Do not delete or modify. ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,");
  csvRows.push(",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,");

  // 2. Aircraft Table Section (ForeFlight uses this to define aircraft profiles)
  csvRows.push("Aircraft Table,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,");
  // Sub-header for Aircraft Table (Data Types)
  csvRows.push("Text,Text,Text,YYYY,Text,Text,Text,Text,Text,Boolean,Boolean,Boolean,Boolean,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,");
  // Headers for Aircraft Table
  csvRows.push(FOREFLIGHT_AIRCRAFT_HEADERS.join(',') + ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,");
  
  // Extract unique aircraft IDs to populate aircraft table if possible
  const uniqueAircraft = Array.from(new Set(entries.map(e => e.aircraftId)));
  uniqueAircraft.forEach(id => {
    if (!id) return;
    const firstMatch = entries.find(e => e.aircraftId === id);
    const row = [
        escapeCSV(id), 
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
    csvRows.push(row.join(',') + ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,");
  });

  // Space between tables
  csvRows.push(",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,");
  csvRows.push(",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,");

  // 3. Flights Table Section
  csvRows.push("Flights Table,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,");
  
  // Data Types for Flights Table (ForeFlight uses these to parse values)
  // We provide a row that tells ForeFlight which columns are Decimals, Text, etc.
  const flightDataTypes = FOREFLIGHT_FLIGHT_HEADERS.map(h => {
    if (["Date"].includes(h)) return "Date";
    if (["TotalTime", "PIC", "SIC", "Night", "CrossCountry", "Instrument", "SimulatedInstrument", "DualGiven", "DualReceived", "Day", "SimulatedFlight"].includes(h)) return "Decimal";
    if (["DayTakeoffs", "DayLandingsFullStop", "NightTakeoffs", "NightLandingsFullStop", "AllLandings", "Approaches", "Holds"].includes(h)) return "Number";
    return "Text";
  });
  csvRows.push(flightDataTypes.join(','));
  
  // Official Column Headers for Flights Table
  csvRows.push(FOREFLIGHT_FLIGHT_HEADERS.join(','));

  // The Data Rows
  entries.forEach(entry => {
    // Map existing LogbookEntry to the 71 columns of the Flights Table
    const row = FOREFLIGHT_FLIGHT_HEADERS.map(header => {
      switch (header) {
        case "Date": return entry.date;
        case "AircraftID": return escapeCSV(entry.aircraftId);
        case "From": return escapeCSV(entry.from);
        case "To": return escapeCSV(entry.to);
        case "Route": return escapeCSV(entry.route);
        case "TotalTime": return formatNumeric(entry.totalTime);
        case "PIC": return formatNumeric(entry.pic);
        case "SIC": return formatNumeric(entry.sic);
        case "Night": return formatNumeric(entry.night);
        case "Day": return formatNumeric(entry.day);
        case "CrossCountry": return formatNumeric(entry.crossCountry);
        case "ActualInstrument": return formatNumeric(entry.instrument);
        case "SimulatedInstrument": return formatNumeric(entry.simulatedInstrument);
        case "Approaches": return entry.approaches || "";
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
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
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
