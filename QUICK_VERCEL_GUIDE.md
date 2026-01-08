# Quick Vercel Deployment Guide

## Recommended: Frontend on Vercel + Backend on Railway

This is the **fastest and easiest** way to deploy your app.

### Step 1: Deploy Backend to Railway (5 minutes)

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add environment variables:
   - `GEMINI_API_KEY` = your API key
   - `NODE_ENV` = `production`
5. Railway will auto-deploy. Copy your app URL (e.g., `https://your-app.up.railway.app`)

### Step 2: Deploy Frontend to Vercel (3 minutes)

**Option A: Via Vercel Dashboard (Easiest)**

1. Go to [vercel.com](https://vercel.com) and sign up/login with GitHub
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build:client`
   - **Output Directory**: `dist`
   - **Root Directory**: `/` (leave as default)
5. Click "Deploy"

**Option B: Via CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow the prompts, then deploy to production
vercel --prod
```

### Step 3: Configure Environment Variables

1. In Vercel dashboard → Your Project → Settings → Environment Variables
2. Add: `VITE_API_URL` = Your Railway backend URL (e.g., `https://your-app.up.railway.app`)
3. Redeploy (Vercel will auto-redeploy when you add env vars)

### Step 4: Update Backend CORS

1. In Railway dashboard → Your Service → Variables
2. Add: `ALLOWED_ORIGINS` = Your Vercel URL (e.g., `https://your-app.vercel.app`)
3. Railway will auto-redeploy

### Done! 🎉

Your app should now be live:
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-app.up.railway.app`

---

## Troubleshooting

**CORS errors?**
- Make sure `ALLOWED_ORIGINS` in Railway includes your Vercel URL
- Include both production and preview URLs if needed

**API not working?**
- Check `VITE_API_URL` is set in Vercel
- Verify backend is running (check Railway logs)
- Test backend directly: `https://your-backend.up.railway.app/health`

**Build failing?**
- Check Vercel build logs
- Make sure all dependencies are in `package.json`
- Verify TypeScript compiles: `npm run build:client`

---

## Alternative: Deploy Backend to Render

If you prefer Render over Railway:

1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect your GitHub repo
4. Configure:
   - **Build Command**: `npm run build:server`
   - **Start Command**: `node dist/server/index.js`
5. Add environment variables (same as Railway)
6. Deploy

Then follow Step 2-4 above, using your Render URL instead of Railway.
