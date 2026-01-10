import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

/**
 * General API rate limiter - applies to all API routes
 * Allows 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
});

/**
 * Helmet configuration for security headers
 * Customized to work with the app's needs
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for Vite in dev
      imgSrc: ["'self'", "data:", "blob:"], // Allow data URLs and blobs for images
      connectSrc: ["'self'"], // API connections
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
});

/**
 * CORS configuration
 * More restrictive in production
 */
export const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : false)
    : true, // Allow all origins in development
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'OPTIONS'],
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
 */
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
    };

    // Only log errors and slow requests in production
    if (process.env.NODE_ENV === 'production') {
      if (res.statusCode >= 400 || duration > 5000) {
        console.warn('Security/Performance Alert:', logData);
      }
    } else {
      console.log('Request:', logData);
    }
  });

  next();
};
