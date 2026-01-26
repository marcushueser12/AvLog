import { Request, Response, NextFunction } from 'express';
import {
  sanitizeString,
  sanitizeText,
  sanitizeEmail,
  sanitizeId,
  sanitizeNumber,
  sanitizeInteger,
  sanitizeBoolean,
  sanitizeDate,
  sanitizeStringArray,
} from '../utils/sanitize.js';

/**
 * Validate and sanitize request body
 */
export const validateAndSanitizeBody = (schema: Record<string, any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: string[] = [];
      const sanitized: any = {};

      for (const [field, rules] of Object.entries(schema)) {
        const value = req.body[field];
        const isRequired = rules.required !== false;
        const isPresent = value !== undefined && value !== null && value !== '';

        // Check required fields
        if (isRequired && !isPresent) {
          errors.push(`${field} is required`);
          continue;
        }

        // Skip validation if field is optional and not present
        if (!isRequired && !isPresent) {
          sanitized[field] = rules.default !== undefined ? rules.default : null;
          continue;
        }

        // Type-specific sanitization
        let sanitizedValue: any = value;

        switch (rules.type) {
          case 'string':
            sanitizedValue = sanitizeString(value, rules.maxLength || 10000);
            if (isRequired && !sanitizedValue) {
              errors.push(`${field} cannot be empty`);
            }
            break;

          case 'text':
            sanitizedValue = sanitizeText(value, rules.maxLength || 10000);
            if (isRequired && !sanitizedValue) {
              errors.push(`${field} cannot be empty`);
            }
            break;

          case 'email':
            sanitizedValue = sanitizeEmail(value);
            if (isRequired && !sanitizedValue) {
              errors.push(`${field} must be a valid email address`);
            }
            break;

          case 'id':
            sanitizedValue = sanitizeId(value);
            if (isRequired && !sanitizedValue) {
              errors.push(`${field} must be a valid ID`);
            }
            break;

          case 'number':
            sanitizedValue = sanitizeNumber(value, rules.min, rules.max);
            if (isRequired && sanitizedValue === null) {
              errors.push(`${field} must be a valid number${rules.min !== undefined || rules.max !== undefined ? ` between ${rules.min || '-∞'} and ${rules.max || '∞'}` : ''}`);
            }
            break;

          case 'integer':
            sanitizedValue = sanitizeInteger(value, rules.min, rules.max);
            if (isRequired && sanitizedValue === null) {
              errors.push(`${field} must be a valid integer${rules.min !== undefined || rules.max !== undefined ? ` between ${rules.min || '-∞'} and ${rules.max || '∞'}` : ''}`);
            }
            break;

          case 'boolean':
            sanitizedValue = sanitizeBoolean(value);
            break;

          case 'date':
            sanitizedValue = sanitizeDate(value);
            if (isRequired && !sanitizedValue) {
              errors.push(`${field} must be a valid date (YYYY-MM-DD or MM/DD/YYYY)`);
            }
            break;

          case 'array':
            if (!Array.isArray(value)) {
              errors.push(`${field} must be an array`);
            } else {
              sanitizedValue = sanitizeStringArray(value, rules.maxLength || 100, rules.maxItems || 100);
            }
            break;

          default:
            sanitizedValue = value;
        }

        // Custom validation
        if (rules.validate && typeof rules.validate === 'function') {
          const validationResult = rules.validate(sanitizedValue);
          if (validationResult !== true) {
            errors.push(validationResult || `${field} validation failed`);
          }
        }

        sanitized[field] = sanitizedValue;
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      }

      // Replace body with sanitized values
      req.body = { ...req.body, ...sanitized };
      next();
    } catch (error: any) {
      console.error('Validation error:', error);
      return res.status(400).json({
        error: 'Validation error',
        message: error.message || 'Invalid request data',
      });
    }
  };
};

/**
 * Validate and sanitize URL parameters
 */
export const validateParams = (schema: Record<string, 'string' | 'id' | 'integer'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: string[] = [];
      const sanitized: any = {};

      for (const [param, type] of Object.entries(schema)) {
        const value = req.params[param];

        if (!value) {
          errors.push(`Missing required parameter: ${param}`);
          continue;
        }

        switch (type) {
          case 'id':
            sanitized[param] = sanitizeId(value);
            if (!sanitized[param]) {
              errors.push(`Invalid parameter: ${param}`);
            }
            break;

          case 'integer':
            const num = sanitizeInteger(value);
            if (num === null) {
              errors.push(`Invalid parameter: ${param} must be an integer`);
            } else {
              sanitized[param] = num;
            }
            break;

          case 'string':
          default:
            sanitized[param] = sanitizeString(value, 255);
            if (!sanitized[param]) {
              errors.push(`Invalid parameter: ${param}`);
            }
            break;
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: 'Invalid parameters',
          details: errors,
        });
      }

      req.params = { ...req.params, ...sanitized };
      next();
    } catch (error: any) {
      console.error('Parameter validation error:', error);
      return res.status(400).json({
        error: 'Parameter validation error',
        message: error.message || 'Invalid parameters',
      });
    }
  };
};

/**
 * Validate and sanitize query parameters
 */
export const validateQuery = (schema: Record<string, any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const sanitized: any = {};

      for (const [param, rules] of Object.entries(schema)) {
        const value = req.query[param];

        if (value === undefined || value === null) {
          if (rules.required) {
            return res.status(400).json({
              error: `Missing required query parameter: ${param}`,
            });
          }
          sanitized[param] = rules.default;
          continue;
        }

        switch (rules.type) {
          case 'string':
            sanitized[param] = sanitizeString(String(value), rules.maxLength || 255);
            break;

          case 'integer':
            sanitized[param] = sanitizeInteger(value);
            break;

          case 'number':
            sanitized[param] = sanitizeNumber(value);
            break;

          case 'boolean':
            sanitized[param] = sanitizeBoolean(value);
            break;

          default:
            sanitized[param] = value;
        }
      }

      req.query = { ...req.query, ...sanitized };
      next();
    } catch (error: any) {
      console.error('Query validation error:', error);
      return res.status(400).json({
        error: 'Query validation error',
        message: error.message || 'Invalid query parameters',
      });
    }
  };
};
