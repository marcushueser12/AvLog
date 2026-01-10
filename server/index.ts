import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractLogbookEntriesFromPair, extractLogbookEntriesSingle, preprocessImage } from './services/geminiService.js';
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
const PORT = process.env.PORT || 3001;

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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../dist');
  app.use(express.static(frontendPath));
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
      res.status(500).json({ error: error.message || 'Extraction failed' });
    }
  }
);

// Serve frontend for all non-API routes (SPA routing)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`Frontend served from: ${path.join(__dirname, '../../dist')}`);
    console.log(`CORS Allowed Origins: ${process.env.ALLOWED_ORIGINS || 'NOT SET - CORS will block all requests!'}`);
  }
  console.log('Security features enabled: Rate limiting, Helmet, Input validation');
});
