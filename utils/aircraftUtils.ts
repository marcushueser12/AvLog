/**
 * Infer aircraft manufacturer (make) from ICAO type code.
 * Examples: C172 -> Cessna, SR22 -> Cirrus, PA28 -> Piper
 */
const TYPE_CODE_TO_MAKE: Record<string, string> = {
  // Cessna
  C152: 'Cessna', C162: 'Cessna', C172: 'Cessna', C182: 'Cessna', C206: 'Cessna', C208: 'Cessna',
  C210: 'Cessna', C310: 'Cessna', C337: 'Cessna', C402: 'Cessna', C414: 'Cessna', C421: 'Cessna',
  C500: 'Cessna', C510: 'Cessna', C525: 'Cessna', C550: 'Cessna', C560: 'Cessna', C650: 'Cessna',
  C680: 'Cessna', C750: 'Cessna',
  // Cirrus
  SR20: 'Cirrus', SR22: 'Cirrus', SF50: 'Cirrus',
  // Piper
  PA18: 'Piper', PA28: 'Piper', PA32: 'Piper', PA34: 'Piper', PA44: 'Piper', PA46: 'Piper',
  // Beechcraft
  BE23: 'Beechcraft', BE24: 'Beechcraft', BE33: 'Beechcraft', BE35: 'Beechcraft', BE36: 'Beechcraft',
  BE55: 'Beechcraft', BE58: 'Beechcraft', BE76: 'Beechcraft', BE90: 'Beechcraft', BE99: 'Beechcraft',
  BE200: 'Beechcraft', BE300: 'Beechcraft', BE350: 'Beechcraft', BE400: 'Beechcraft',
  // Diamond
  DA20: 'Diamond', DA40: 'Diamond', DA42: 'Diamond', DA62: 'Diamond',
  // Mooney
  M20: 'Mooney', M20P: 'Mooney', M20R: 'Mooney', M20S: 'Mooney', M20T: 'Mooney', M20V: 'Mooney',
  // Robinson
  R22: 'Robinson', R44: 'Robinson', R66: 'Robinson',
  // Other common
  B206: 'Bell', B407: 'Bell', EC30: 'Airbus', EC35: 'Airbus',
  A169: 'Leonardo', A109: 'Leonardo', A119: 'Leonardo',
  GLID: 'Various', ASK21: 'Schleicher', DG1000: 'DG Flugzeugbau',
};

/**
 * Infer make from type code. Returns empty string if unknown.
 */
export const typeCodeToMake = (typeCode: string | null | undefined): string => {
  if (!typeCode || typeof typeCode !== 'string') return '';
  const code = typeCode.trim().toUpperCase();
  if (!code) return '';
  // Direct match
  if (TYPE_CODE_TO_MAKE[code]) return TYPE_CODE_TO_MAKE[code];
  // Prefix match (e.g. C172S -> C172)
  const prefix = code.replace(/[A-Z]$/, '');
  if (TYPE_CODE_TO_MAKE[prefix]) return TYPE_CODE_TO_MAKE[prefix];
  // C-prefix = Cessna (C172, C182, etc.)
  if (code.startsWith('C') && /^C\d/.test(code)) return 'Cessna';
  // PA-prefix = Piper
  if (code.startsWith('PA')) return 'Piper';
  // SR-prefix = Cirrus
  if (code.startsWith('SR')) return 'Cirrus';
  // BE-prefix = Beechcraft
  if (code.startsWith('BE')) return 'Beechcraft';
  // DA-prefix = Diamond
  if (code.startsWith('DA')) return 'Diamond';
  return '';
};
