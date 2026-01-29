import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { sanitizeForLogging } from '../utils/sanitize.js';

/**
 * General API rate limiter - applies to all API routes
 * Allows 300 requests per 15 minutes per IP (increased for users with many pages)
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs (increased from 100)
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for preflight requests
});

/**
 * Strict rate limiter for image processing endpoints
 * These are more resource-intensive, so stricter limits
 * Allows 20 requests per 15 minutes per IP
 */
export const imageProcessingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 image processing requests per windowMs
  message: {
    error: 'Too many image processing requests. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, including successful ones
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for preflight requests
});

/**
 * Very strict rate limiter for extraction endpoints
 * These are the most resource-intensive (Gemini API calls)
 * Allows 10 requests per 15 minutes per IP
 */
export const extractionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 extraction requests per windowMs
  message: {
    error: 'Too many extraction requests. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for preflight requests
});

/**
 * Rate limiter for admin endpoints
 * Stricter limits for admin operations
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 admin requests per windowMs
  message: {
    error: 'Too many admin requests. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

/**
 * Rate limiter for webhook endpoints
 * Webhooks should be called by Stripe, not users
 * Very strict limits
 */
export const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Allow more webhook requests (Stripe may retry)
  message: {
    error: 'Too many webhook requests.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

/**
 * Rate limiter for authenticated API endpoints
 * Applied to routes that require authentication
 * Increased limit for users loading many pages
 */
export const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 authenticated requests per windowMs (increased from 200)
  message: {
    error: 'Too many requests. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

/**
 * Helmet configuration for security headers
 * Customized to work with the app's needs
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Allow inline styles and Google Fonts
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for Vite in dev and ES modules
      imgSrc: ["'self'", "data:", "blob:"], // Allow data URLs and blobs for images
      connectSrc: ["'self'"], // API connections
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"], // Allow Google Fonts
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility with Safari
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
  crossOriginOpenerPolicy: false, // Disable for Safari compatibility
});

/**
 * CORS configuration
 * Supports wildcard patterns for Vercel preview deployments (e.g., *.vercel.app)
 */
const parseAllowedOrigins = (): (string | RegExp)[] | boolean => {
  if (process.env.NODE_ENV !== 'production') {
    return true; // Allow all origins in development
  }

  if (!process.env.ALLOWED_ORIGINS) {
    return false;
  }

  const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o);
  const parsedOrigins: (string | RegExp)[] = [];

  for (const origin of origins) {
    if (origin.includes('*')) {
      // Strip protocol from wildcard pattern before converting to regex
      const withoutProtocol = origin.replace(/^https?:\/\//, '');
      // Convert wildcard pattern to regex
      // Escape special regex characters except *
      const pattern = withoutProtocol
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      parsedOrigins.push(new RegExp(`^https?://${pattern}$`));
    } else {
      parsedOrigins.push(origin);
    }
  }

  return parsedOrigins.length > 0 ? parsedOrigins : false;
};

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = parseAllowedOrigins();

    // No origin (same-origin request, e.g., from Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Development: allow all
    if (allowedOrigins === true) {
      return callback(null, true);
    }

    // Production: check against allowed origins
    if (Array.isArray(allowedOrigins)) {
      for (const allowed of allowedOrigins) {
        if (typeof allowed === 'string') {
          if (origin === allowed) {
            return callback(null, true);
          }
        } else if (allowed instanceof RegExp) {
          if (allowed.test(origin)) {
            return callback(null, true);
          }
        }
      }
    }

    callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With'],
  preflightContinue: false,
};

/**
 * Input validation middleware
 * Validates base64 image strings
 */
export const validateBase64Image = (req: Request, res: Response, next: NextFunction) => {
  const imageFields = ['base64Image', 'image', 'leftImage', 'rightImage'];
  const errors: string[] = [];

  for (const field of imageFields) {
    if (req.body[field]) {
      const value = req.body[field];
      
      // Check if it's a string
      if (typeof value !== 'string') {
        errors.push(`${field} must be a string`);
        continue;
      }

      // Check if it's a valid base64 data URL or base64 string
      const isDataUrl = value.startsWith('data:image/');
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(value.replace(/^data:image\/[^;]+;base64,/, ''));

      if (!isDataUrl && !isBase64) {
        errors.push(`${field} must be a valid base64 image string`);
        continue;
      }

      // Check size (max 50MB when decoded, but base64 is ~33% larger)
      const base64Data = isDataUrl ? value.split(',')[1] : value;
      const sizeInBytes = (base64Data.length * 3) / 4;
      const maxSize = 50 * 1024 * 1024; // 50MB

      if (sizeInBytes > maxSize) {
        errors.push(`${field} is too large. Maximum size is 50MB`);
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
};

/**
 * Validate expectedCount parameter
 */
export const validateExpectedCount = (req: Request, res: Response, next: NextFunction) => {
  if (req.body.expectedCount !== undefined) {
    const count = req.body.expectedCount;
    
    if (typeof count !== 'number' || count < 1 || count > 100) {
      return res.status(400).json({ 
        error: 'expectedCount must be a number between 1 and 100' 
      });
    }
  }

  next();
};

/**
 * Request logging middleware for security monitoring
 * Sanitizes sensitive data before logging
 */
// Track rate limit errors to avoid log spam
let rateLimitErrorCount = 0;
let lastRateLimitLogTime = 0;
const RATE_LIMIT_LOG_INTERVAL = 5000; // Only log rate limit errors every 5 seconds

export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request details (without sensitive data)
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket.remoteAddress,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      // Sanitize body and headers to prevent logging sensitive data
      // Exclude body for image processing endpoints to prevent log bloat
      body: (req.path.includes('/extract') || req.path.includes('/image')) 
        ? '[IMAGE_PROCESSING_REQUEST]' 
        : (req.body ? sanitizeForLogging(req.body) : undefined),
      headers: req.headers ? sanitizeForLogging(req.headers) : undefined,
    };

    // Reduce logging for 429 errors to avoid Railway log rate limits
    if (res.statusCode === 429) {
      const now = Date.now();
      if (now - lastRateLimitLogTime > RATE_LIMIT_LOG_INTERVAL) {
        rateLimitErrorCount++;
        console.warn(`Rate limit (429) - ${rateLimitErrorCount} occurrences in last ${RATE_LIMIT_LOG_INTERVAL}ms`);
        lastRateLimitLogTime = now;
      }
      // Don't log full request details for 429 errors
      return;
    }

    // Only log errors and slow requests in production
    if (process.env.NODE_ENV === 'production') {
      if (res.statusCode >= 400) {
        // Log actual errors as warnings
        console.warn('Security/Performance Alert:', sanitizeForLogging(logData));
      } else if (duration > 10000) {
        // Log very slow requests (>10s) as info, not error
        console.log('Slow Request:', sanitizeForLogging(logData));
      }
      // Don't log successful fast requests in production
    } else {
      console.log('Request:', sanitizeForLogging(logData));
    }
  });

  next();
};
