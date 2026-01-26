import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractLogbookEntriesFromPair, extractLogbookEntriesSingle, preprocessImage, GeminiRetryableError } from './services/geminiService.js';
import {
  generalLimiter,
  imageProcessingLimiter,
  extractionLimiter,
  helmetConfig,
  corsOptions,
  validateBase64Image,
  validateExpectedCount,
  securityLogger,
} from './middleware/security.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust proxy for accurate IP addresses (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// CORS must be applied FIRST, before any other middleware
app.use(cors(corsOptions));

// Security middleware - apply globally
app.use(helmetConfig);
app.use(securityLogger);

// Handle OPTIONS requests explicitly (preflight)
app.options('*', cors(corsOptions));

// Body parsing with size limits
// Note: Webhook route uses raw body, so we need to exclude it from JSON parsing
app.use((req, res, next) => {
  if (req.path === '/api/payments/webhook') {
    // Skip JSON parsing for webhook - it needs raw body
    next();
  } else {
    express.json({ limit: '50mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../dist');
  app.use(express.static(frontendPath, {
    maxAge: '1d', // Cache static assets for 1 day
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Ensure proper MIME types for JavaScript modules (critical for Safari)
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
      // Ensure proper MIME types for CSS
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
      // Ensure proper MIME types for HTML
      if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      }
      // CORS headers for static assets (important for Safari)
      // Note: Using * is safe for static assets (no credentials sent)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      // Important for Safari - prevent caching issues
      if (filePath.includes('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
}

// Health check endpoint (no rate limiting for monitoring)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.ALLOWED_ORIGINS || 'NOT SET',
  });
});

// Apply general rate limiting to all API routes
// OPTIONS requests are automatically skipped by the rate limiter's skip function
app.use('/api', generalLimiter);

// Preprocess image endpoint - image processing rate limiter
app.post(
  '/api/preprocess-image',
  imageProcessingLimiter,
  validateBase64Image,
  async (req, res) => {
    try {
      const { base64Image } = req.body;
      
      if (!base64Image) {
        return res.status(400).json({ error: 'base64Image is required' });
      }

      const result = await preprocessImage(base64Image);
      res.json(result);
    } catch (error: any) {
      console.error('Preprocess error:', error);
      res.status(500).json({ error: error.message || 'Image preprocessing failed' });
    }
  }
);

// Extract entries from pair of images - extraction rate limiter
app.post(
  '/api/extract-pair',
  extractionLimiter,
  validateBase64Image,
  validateExpectedCount,
  async (req, res) => {
    try {
      const { leftImage, rightImage, expectedCount } = req.body;
      
      if (!leftImage || !rightImage) {
        return res.status(400).json({ error: 'Both leftImage and rightImage are required' });
      }

      const result = await extractLogbookEntriesFromPair(
        leftImage,
        rightImage,
        expectedCount
      );
      
      res.json(result);
    } catch (error: any) {
      console.error('Extraction error:', error);
      
      // Check if this is a retryable Gemini API error (503, 429)
      if (error instanceof GeminiRetryableError || error.name === 'GeminiRetryableError') {
        const statusCode = error.statusCode || 503;
        return res.status(statusCode).json({ 
          error: 'Server busy, retrying...',
          message: error.message || 'Gemini API is temporarily unavailable'
        });
      }
      
      // Check for 503/429 status codes in error
      const statusCode = error?.statusCode || error?.status || error?.code;
      if (statusCode === 503 || statusCode === 429) {
        return res.status(503).json({ 
          error: 'Server busy, retrying...',
          message: error.message || 'Service temporarily unavailable'
        });
      }
      
      // Other errors return 500
      res.status(500).json({ error: error.message || 'Extraction failed' });
    }
  }
);

// Extract entries from single image - extraction rate limiter
app.post(
  '/api/extract-single',
  extractionLimiter,
  validateBase64Image,
  validateExpectedCount,
  async (req, res) => {
    try {
      const { image, expectedCount } = req.body;
      
      if (!image) {
        return res.status(400).json({ error: 'image is required' });
      }

      const result = await extractLogbookEntriesSingle(image, expectedCount);
      
      res.json(result);
    } catch (error: any) {
      console.error('Extraction error:', error);
      
      // Check if this is a retryable Gemini API error (503, 429)
      if (error instanceof GeminiRetryableError || error.name === 'GeminiRetryableError') {
        const statusCode = error.statusCode || 503;
        return res.status(statusCode).json({ 
          error: 'Server busy, retrying...',
          message: error.message || 'Gemini API is temporarily unavailable'
        });
      }
      
      // Check for 503/429 status codes in error
      const statusCode = error?.statusCode || error?.status || error?.code;
      if (statusCode === 503 || statusCode === 429) {
        return res.status(503).json({ 
          error: 'Server busy, retrying...',
          message: error.message || 'Service temporarily unavailable'
        });
      }
      
      // Other errors return 500
      res.status(500).json({ error: error.message || 'Extraction failed' });
    }
  }
);

// Import new routes
import adminRoutes from './routes/admin.js';
import verifiedRoutes from './routes/verified.js';
import paymentRoutes from './routes/payments.js';
import aircraftRoutes from './routes/aircraft.js';
import { adminLimiter, webhookLimiter, authenticatedLimiter } from './middleware/security.js';

// Admin routes (protected by secret token + rate limiting)
app.use('/api/admin', adminLimiter, adminRoutes);

// Verified entries routes (protected by auth token + rate limiting)
app.use('/api/verified', authenticatedLimiter, verifiedRoutes);

// Payment routes (checkout session requires auth, webhook is public with rate limiting)
app.use('/api/payments', paymentRoutes);

// Aircraft profiles routes (protected by auth token + rate limiting)
app.use('/api', authenticatedLimiter, aircraftRoutes);

// Serve frontend for all non-API routes (SPA routing)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes or asset requests
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const indexPath = path.join(__dirname, '../../dist/index.html');
    // Set proper headers for HTML response (important for Safari)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(indexPath);
  });
}

// Error handling middleware - sanitize error messages to prevent information disclosure
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log full error details server-side (sanitized)
  const sanitizedError = {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  };
  console.error('Unhandled error:', sanitizedError);
  
  // Don't expose internal error details to clients
  res.status(500).json({ 
    error: 'Internal server error',
    // Only include error details in development
    ...(process.env.NODE_ENV === 'development' && { 
      details: err.message,
      path: req.path 
    })
  });
});

// Listen on 0.0.0.0 to accept connections from any interface (required for Railway)
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`Frontend served from: ${path.join(__dirname, '../../dist')}`);
    console.log(`CORS Allowed Origins: ${process.env.ALLOWED_ORIGINS || 'NOT SET - CORS will block all requests!'}`);
  }
  console.log('Security features enabled: Rate limiting, Helmet, Input validation');
});
