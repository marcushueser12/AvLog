# Deployment Guide

This guide explains how to deploy the SkyScan Logbook application with its new backend architecture.

## Architecture Overview

The application now consists of:
- **Frontend**: React app built with Vite
- **Backend**: Express.js server that handles Gemini API calls
- **API**: RESTful endpoints for image processing and logbook extraction

## Prerequisites

- Node.js 20+ and npm
- Gemini API key from Google AI Studio
- (Optional) Docker and Docker Compose for containerized deployment

## Environment Variables

Create a `.env` file in the root directory:

```env
# Required: Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Backend API URL (for frontend)
# In development, defaults to http://localhost:3001
# In production, set to your deployed backend URL
VITE_API_URL=http://localhost:3001

# Optional: Server Port
PORT=3001

# Environment (development, production)
NODE_ENV=production

# Allowed Origins for CORS (production only)
# Comma-separated list of allowed origins
# Example: https://yourdomain.com,https://www.yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

3. **Run development servers:**
   ```bash
   npm run dev
   ```
   This starts both the frontend (port 3000) and backend (port 3001) concurrently.

   Or run them separately:
   ```bash
   # Terminal 1: Backend
   npm run dev:server
   
   # Terminal 2: Frontend
   npm run dev:client
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

## Production Build

1. **Build the application:**
   ```bash
   npm run build
   ```
   This builds both frontend and backend.

2. **Start the production server:**
   ```bash
   npm start
   ```
   The server will serve both the API and the frontend on port 3001 (or the PORT specified in .env).

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

2. **Build and run:**
   ```bash
   docker-compose up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

### Using Docker directly

1. **Build the image:**
   ```bash
   docker build -t skyscan-logbook .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     -p 3001:3001 \
     -e GEMINI_API_KEY=your_api_key_here \
     --name skyscan-logbook \
     skyscan-logbook
   ```

## Platform-Specific Deployment

### Vercel / Netlify (Frontend) + Railway / Render (Backend)

For serverless platforms, you'll need to deploy frontend and backend separately:

1. **Backend Deployment (Railway/Render):**
   - Set `GEMINI_API_KEY` environment variable
   - Set `NODE_ENV=production`
   - Deploy the `server/` directory
   - Note: You may need to adjust the build process for these platforms

2. **Frontend Deployment:**
   - Set `VITE_API_URL` to your deployed backend URL
   - Build and deploy the frontend

### Heroku

1. **Create a Procfile:**
   ```
   web: node dist/server/index.js
   ```

2. **Deploy:**
   ```bash
   heroku create your-app-name
   heroku config:set GEMINI_API_KEY=your_api_key
   git push heroku main
   ```

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /api/preprocess-image` - Preprocess an image
  - Body: `{ base64Image: string }`
- `POST /api/extract-pair` - Extract entries from a pair of images
  - Body: `{ leftImage: string, rightImage: string, expectedCount?: number }`
- `POST /api/extract-single` - Extract entries from a single image
  - Body: `{ image: string, expectedCount?: number }`

## Security Features

The application includes comprehensive security features:

### Rate Limiting
- **General API**: 100 requests per 15 minutes per IP
- **Image Processing**: 20 requests per 15 minutes per IP
- **Extraction Endpoints**: 10 requests per 15 minutes per IP (most resource-intensive)

Rate limits are applied per IP address and reset after the time window expires. Rate limit information is included in response headers.

### Security Headers (Helmet)
- Content Security Policy (CSP) configured for the application
- XSS protection enabled
- MIME type sniffing prevention
- Clickjacking protection
- Other security headers automatically configured

### Input Validation
- Base64 image validation (format and size checks)
- Maximum image size: 50MB
- Expected count validation (1-100 range)
- Request body size limits

### CORS Configuration
- Configurable allowed origins via `ALLOWED_ORIGINS` environment variable
- In production, specify exact origins for security
- In development, all origins allowed by default

### Security Monitoring
- Request logging for security events
- Slow request detection (>5 seconds)
- Error logging with IP tracking
- Production-ready security alerts

### Security Best Practices
- **Never commit your `.env` file** - it contains sensitive API keys
- The Gemini API key is server-side only, protecting it from client exposure
- Use HTTPS in production to protect API communications
- Set `NODE_ENV=production` in production environments
- Configure `ALLOWED_ORIGINS` to restrict CORS in production
- Consider using a reverse proxy (nginx, Cloudflare) for additional protection
- Monitor rate limit violations for potential abuse

## Troubleshooting

### Backend won't start
- Check that `GEMINI_API_KEY` is set in your `.env` file
- Verify port 3001 is not already in use
- Check server logs for specific error messages

### Frontend can't connect to backend
- Verify `VITE_API_URL` matches your backend URL
- Check CORS settings if deploying to different domains
- Ensure backend is running and accessible

### Image processing fails
- Verify your Gemini API key is valid and has quota
- Check that images are properly base64 encoded
- Review server logs for detailed error messages

### Rate limiting errors
- If you see "Too many requests" errors, you've hit the rate limit
- Wait 15 minutes for the limit to reset, or adjust limits in `server/middleware/security.ts`
- Rate limits are per IP address
- Check rate limit headers in API responses: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

### CORS errors
- Ensure `ALLOWED_ORIGINS` is set correctly in production
- Include the full protocol (https://) in allowed origins
- For development, leave `ALLOWED_ORIGINS` unset to allow all origins

## Support

For issues or questions, check the server logs and ensure all environment variables are properly configured.
