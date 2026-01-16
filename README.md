<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# LogExtract Logbook - Aviation Logbook Digitizer

An AI-powered application for digitizing aviation logbooks using Google's Gemini API. The application extracts flight entries from scanned logbook pages with high accuracy.

## Architecture

This application now features a **full-stack architecture**:
- **Frontend**: React + Vite (client-side UI)
- **Backend**: Express.js server (handles Gemini API calls securely)
- **API**: RESTful endpoints for image processing and extraction

## Quick Start

### Prerequisites
- Node.js 20+ and npm
- Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

3. **Run the application:**
   ```bash
   npm run dev
   ```
   This starts both frontend (port 3000) and backend (port 3001) servers.

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/health

## Production Deployment

### Quick Deploy (Recommended): Vercel + Railway

**Fastest way to get your app live:**

1. **Backend on Railway** (5 min): [railway.app](https://railway.app) → Deploy from GitHub
2. **Frontend on Vercel** (3 min): [vercel.com](https://vercel.com) → Import from GitHub

📖 **Full step-by-step guide:** [DEPLOY_VERCEL_RAILWAY.md](./DEPLOY_VERCEL_RAILWAY.md)

### Other Deployment Options

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Docker deployment
- Other platform guides (Render, Heroku, etc.)
- Environment configuration
- Troubleshooting

## Key Features

- **Dual Mode Scanning**: Single page or spread pair extraction
- **AI-Powered OCR**: Uses Gemini 3 Flash for accurate transcription
- **IFR Data Focus**: Special handling for instrument flight time and approaches
- **Verification Workflow**: Review and verify extracted entries before permanent storage
- **ForeFlight Export**: Generate CSV files compatible with ForeFlight import

## API Endpoints

- `GET /health` - Health check
- `POST /api/preprocess-image` - Image preprocessing
- `POST /api/extract-pair` - Extract from two-page spread
- `POST /api/extract-single` - Extract from single page

## Security

- Gemini API key is now **server-side only** (never exposed to clients)
- All API calls go through the backend
- Environment variables for sensitive configuration

## Development Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:client` - Start only frontend
- `npm run dev:server` - Start only backend
- `npm run build` - Build both frontend and backend for production
- `npm start` - Start production server

## License

Private project - All rights reserved.
