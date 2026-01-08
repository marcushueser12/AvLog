# Deploying to Vercel

This guide covers deploying your SkyScan Logbook application to Vercel. Since you have a full-stack app with an Express backend, there are two main approaches:

## Option 1: Frontend on Vercel + Backend on Railway/Render (Recommended)

This is the **easiest and most reliable** approach. Deploy the frontend to Vercel and the backend to a service that supports long-running Node.js processes.

### Step 1: Deploy Backend to Railway (Recommended)

1. **Sign up for Railway**: Go to [railway.app](https://railway.app) and sign up with GitHub

2. **Create a new project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure the service**:
   - Railway will auto-detect it's a Node.js app
   - Add environment variables:
     - `GEMINI_API_KEY` - Your Gemini API key
     - `NODE_ENV=production`
     - `PORT` - Railway will set this automatically
     - `ALLOWED_ORIGINS` - Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)

4. **Update build settings**:
   - Build Command: `npm run build:server`
   - Start Command: `node dist/server/index.js`
   - Root Directory: `/` (root)

5. **Deploy**: Railway will automatically deploy. Note the URL (e.g., `https://your-app.up.railway.app`)

### Step 2: Deploy Frontend to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Create a `.vercelignore` file** (optional, to exclude backend files):
   ```
   server/
   tsconfig.server.json
   Dockerfile
   docker-compose.yml
   ```

4. **Deploy from command line**:
   ```bash
   vercel
   ```
   
   Or deploy via GitHub:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: Vite
     - **Build Command**: `npm run build:client`
     - **Output Directory**: `dist`
     - **Install Command**: `npm install`

5. **Set environment variables in Vercel**:
   - Go to your project settings → Environment Variables
   - Add: `VITE_API_URL` = Your Railway backend URL (e.g., `https://your-app.up.railway.app`)

6. **Redeploy** after adding environment variables

### Step 3: Update Backend CORS

Update your Railway backend's `ALLOWED_ORIGINS` to include your Vercel URL:
```
https://your-app.vercel.app,https://your-app-git-main.vercel.app
```

---

## Option 2: Everything on Vercel (Serverless Functions)

This approach converts your Express routes to Vercel serverless functions. **Note**: This requires some restructuring.

### Step 1: Create Vercel Serverless Functions

Create `api/` directory structure:

```
api/
  preprocess-image.ts
  extract-pair.ts
  extract-single.ts
  health.ts
```

### Step 2: Convert Express Routes

Each route becomes a serverless function. Example for `api/extract-single.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractLogbookEntriesSingle } from '../../server/services/geminiService';
import { validateBase64Image, validateExpectedCount } from '../../server/middleware/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply validation
  const validationErrors = [];
  if (!req.body.image) {
    validationErrors.push('image is required');
  }
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: validationErrors });
  }

  try {
    const result = await extractLogbookEntriesSingle(
      req.body.image,
      req.body.expectedCount
    );
    res.json(result);
  } catch (error: any) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: error.message || 'Extraction failed' });
  }
}
```

### Step 3: Update vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ]
}
```

### Step 4: Deploy to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Set environment variables**:
   - `GEMINI_API_KEY` - Your Gemini API key
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS` - Your Vercel domain

---

## Option 3: Simple Vercel Frontend Only (Current Setup)

If you want to deploy **just the frontend** to Vercel right now (backend deployed elsewhere):

### Quick Deploy Steps:

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login**:
   ```bash
   vercel login
   ```

3. **Create `.vercelignore`**:
   ```
   server/
   tsconfig.server.json
   Dockerfile
   docker-compose.yml
   ```

4. **Deploy**:
   ```bash
   vercel
   ```

5. **Set environment variable**:
   - In Vercel dashboard → Settings → Environment Variables
   - Add: `VITE_API_URL` = Your backend URL

6. **Redeploy**:
   ```bash
   vercel --prod
   ```

---

## Recommended: Option 1 (Frontend Vercel + Backend Railway)

This is the **best approach** because:
- ✅ No code changes needed
- ✅ Full Express.js support
- ✅ Better for long-running processes
- ✅ Easier to debug
- ✅ More reliable for image processing

### Quick Start Commands:

```bash
# 1. Deploy backend to Railway (via GitHub)
# Just connect your repo on railway.app

# 2. Deploy frontend to Vercel
npm i -g vercel
vercel login
vercel

# 3. Set VITE_API_URL in Vercel dashboard
# 4. Redeploy
vercel --prod
```

---

## Environment Variables Summary

### Vercel (Frontend):
- `VITE_API_URL` - Your backend URL (Railway, Render, etc.)

### Railway/Render (Backend):
- `GEMINI_API_KEY` - Your Gemini API key
- `NODE_ENV=production`
- `ALLOWED_ORIGINS` - Your Vercel frontend URL(s)
- `PORT` - Usually auto-set by platform

---

## Troubleshooting

### CORS Errors
- Make sure `ALLOWED_ORIGINS` in backend includes your Vercel URL
- Include both `https://your-app.vercel.app` and preview URLs

### API Not Found
- Check `VITE_API_URL` is set correctly in Vercel
- Verify backend is deployed and accessible
- Check backend logs for errors

### Build Failures
- Make sure all dependencies are in `package.json`
- Check build logs in Vercel dashboard
- Verify TypeScript compilation succeeds

---

## Next Steps

1. Choose your deployment approach (Option 1 recommended)
2. Deploy backend first (Railway/Render)
3. Deploy frontend to Vercel
4. Configure environment variables
5. Test the deployment

For more help, check the main [DEPLOYMENT.md](./DEPLOYMENT.md) file.
