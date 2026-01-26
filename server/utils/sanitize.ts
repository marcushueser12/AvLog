/**
 * Input sanitization utilities following OWASP best practices
 */

/**
 * Sanitize string input to prevent XSS attacks
 * Removes HTML tags and dangerous characters
 */
export const sanitizeString = (input: string | null | undefined, maxLength: number = 10000): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Trim whitespace
  let sanitized = input.trim();
  
  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
};

/**
 * Sanitize text input for database storage (allows newlines, removes HTML)
 */
export const sanitizeText = (input: string | null | undefined, maxLength: number = 10000): string => {
  if (!input || typeof input !== 'string') return '';
  
  let sanitized = input.trim();
  
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  return sanitized;
};

/**
 * Sanitize email address
 */
export const sanitizeEmail = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') return '';
  
  const sanitized = input.trim().toLowerCase();
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  // Enforce max length
  if (sanitized.length > 255) {
    return '';
  }
  
  return sanitized;
};

/**
 * Sanitize URL parameter (for IDs, etc.)
 */
export const sanitizeId = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Only allow alphanumeric, hyphens, and underscores
  const sanitized = input.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Enforce max length
  if (sanitized.length > 255) {
    return '';
  }
  
  return sanitized;
};

/**
 * Sanitize numeric input
 */
export const sanitizeNumber = (input: any, min: number = -Infinity, max: number = Infinity): number | null => {
  if (input === null || input === undefined || input === '') return null;
  
  const num = typeof input === 'number' ? input : parseFloat(String(input));
  
  if (isNaN(num)) return null;
  
  if (num < min || num > max) return null;
  
  return num;
};

/**
 * Sanitize integer input
 */
export const sanitizeInteger = (input: any, min: number = -Infinity, max: number = Infinity): number | null => {
  if (input === null || input === undefined || input === '') return null;
  
  const num = typeof input === 'number' ? Math.floor(input) : parseInt(String(input), 10);
  
  if (isNaN(num)) return null;
  
  if (num < min || num > max) return null;
  
  return num;
};

/**
 * Sanitize boolean input
 */
export const sanitizeBoolean = (input: any): boolean => {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    const lower = input.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  if (typeof input === 'number') return input !== 0;
  return false;
};

/**
 * Sanitize date string (YYYY-MM-DD or MM/DD/YYYY)
 */
export const sanitizeDate = (input: string | null | undefined): string | null => {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  
  // YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return trimmed;
    }
  }
  
  // MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split('/').map(Number);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  
  return null;
};

/**
 * Sanitize array of strings
 */
export const sanitizeStringArray = (input: any, maxLength: number = 100, maxItems: number = 100): string[] => {
  if (!Array.isArray(input)) return [];
  
  const sanitized: string[] = [];
  
  for (let i = 0; i < Math.min(input.length, maxItems); i++) {
    const item = input[i];
    if (typeof item === 'string') {
      const sanitizedItem = sanitizeString(item, maxLength);
      if (sanitizedItem) {
        sanitized.push(sanitizedItem);
      }
    }
  }
  
  return sanitized;
};

/**
 * Remove sensitive data from objects for logging
 */
export const sanitizeForLogging = (obj: any, sensitiveKeys: string[] = ['password', 'token', 'secret', 'key', 'apiKey', 'authorization']): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item, sensitiveKeys));
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value, sensitiveKeys);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};
