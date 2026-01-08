# Deploy to Vercel + Railway - Step by Step Guide

This guide will walk you through deploying your SkyScan Logbook app to Vercel (frontend) and Railway (backend).

## Prerequisites

- GitHub account with your code pushed to a repository
- Gemini API key from [Google AI Studio](https://aistudio.google.com/)
- About 15 minutes

---

## Part 1: Deploy Backend to Railway

### Step 1: Sign up for Railway

1. Go to [railway.app](https://railway.app)
2. Click **"Start a New Project"** or **"Login"**
3. Sign up/login with your **GitHub account** (recommended)

### Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub if prompted
4. Select your **AvLog repository**
5. Railway will start detecting your project

### Step 3: Configure Backend Service

Railway should auto-detect it's a Node.js app. If not:

1. Click on the service that was created
2. Go to **Settings** tab
3. Set the following:

   **Build Command:**
   ```
   npm run build:server
   ```

   **Start Command:**
   ```
   node dist/server/index.js
   ```

   **Root Directory:**
   ```
   / (leave as default)
   ```

### Step 4: Add Environment Variables

1. In your Railway service, go to **Variables** tab
2. Click **"New Variable"** and add these one by one:

   ```
   GEMINI_API_KEY = your_actual_gemini_api_key_here
   NODE_ENV = production
   PORT = (leave empty - Railway sets this automatically)
   ```

3. **Don't add ALLOWED_ORIGINS yet** - we'll add it after we get your Vercel URL

### Step 5: Deploy and Get Backend URL

1. Railway will automatically start deploying
2. Wait for deployment to complete (watch the logs)
3. Once deployed, go to **Settings** → **Networking**
4. Click **"Generate Domain"** (or use the auto-generated one)
5. **Copy your Railway URL** - it will look like:
   ```
   https://your-app-name.up.railway.app
   ```
6. Test it by visiting: `https://your-app-name.up.railway.app/health`
   - You should see: `{"status":"ok","timestamp":"...","environment":"production"}`

✅ **Backend is now live!** Keep this URL handy.

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Sign up for Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** or **"Login"**
3. Sign up/login with your **GitHub account** (recommended)

### Step 2: Import Your Project

1. Click **"Add New Project"** (or **"New Project"**)
2. Click **"Import Git Repository"**
3. Select your **AvLog repository**
4. Click **"Import"**

### Step 3: Configure Build Settings

Vercel should auto-detect Vite, but verify these settings:

1. **Framework Preset:** `Vite` (should be auto-detected)
2. **Root Directory:** `./` (leave as default)
3. **Build Command:** `npm run build:client`
4. **Output Directory:** `dist`
5. **Install Command:** `npm install`

### Step 4: Add Environment Variables

**Before deploying**, add your environment variable:

1. In the project configuration, scroll to **"Environment Variables"**
2. Click **"Add"** and add:
   ```
   Name: VITE_API_URL
   Value: https://your-app-name.up.railway.app
   ```
   (Use the Railway URL you copied earlier)

3. Make sure it's set for **Production, Preview, and Development**

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (usually 1-2 minutes)
3. Once deployed, Vercel will give you a URL like:
   ```
   https://your-app-name.vercel.app
   ```

✅ **Frontend is now live!**

---

## Part 3: Connect Frontend and Backend

### Step 1: Update Railway CORS Settings

1. Go back to **Railway** dashboard
2. Go to your service → **Variables** tab
3. Add a new variable:
   ```
   ALLOWED_ORIGINS = https://your-app-name.vercel.app
   ```
   (Use your actual Vercel URL)

4. Railway will automatically redeploy

### Step 2: Test the Connection

1. Visit your Vercel URL: `https://your-app-name.vercel.app`
2. Open browser DevTools (F12) → Console tab
3. Try uploading a logbook page
4. Check if API calls are working (no CORS errors)

### Step 3: Handle Preview Deployments (Optional but Recommended)

Vercel creates preview URLs for every PR. To allow these:

1. Go back to Railway → Variables
2. Update `ALLOWED_ORIGINS` to include wildcard:
   ```
   ALLOWED_ORIGINS = https://your-app-name.vercel.app,https://*.vercel.app
   ```
   (This allows all Vercel preview deployments)

---

## Part 4: Verify Everything Works

### Test Checklist

- [ ] Backend health check works: `https://your-railway-url/health`
- [ ] Frontend loads: `https://your-vercel-url`
- [ ] Can upload images
- [ ] Can process scans
- [ ] Can export CSV
- [ ] No CORS errors in browser console

### Common Issues

**CORS Errors:**
- Make sure `ALLOWED_ORIGINS` in Railway includes your Vercel URL
- Check for typos in the URL
- Make sure there are no trailing slashes

**API Not Found:**
- Verify `VITE_API_URL` is set correctly in Vercel
- Check that the Railway backend is running (check Railway logs)
- Test the Railway URL directly: `https://your-railway-url/health`

**Build Failures:**
- Check build logs in Vercel dashboard
- Make sure all dependencies are in `package.json`
- Verify TypeScript compiles: run `npm run build:client` locally

---

## Part 5: Custom Domain (Optional)

### Vercel Custom Domain

1. In Vercel dashboard → Your Project → Settings → Domains
2. Add your custom domain (e.g., `skyscan.com`)
3. Follow DNS setup instructions
4. Update `ALLOWED_ORIGINS` in Railway to include your custom domain

### Railway Custom Domain

1. In Railway → Settings → Networking
2. Add custom domain
3. Follow DNS setup instructions

---

## Environment Variables Summary

### Railway (Backend):
```
GEMINI_API_KEY = your_gemini_api_key
NODE_ENV = production
ALLOWED_ORIGINS = https://your-app.vercel.app,https://*.vercel.app
PORT = (auto-set by Railway)
```

### Vercel (Frontend):
```
VITE_API_URL = https://your-app.up.railway.app
```

---

## Updating Your App

### After Making Changes:

1. **Push to GitHub** - Both services auto-deploy on push
2. **Vercel** - Automatically deploys frontend changes
3. **Railway** - Automatically deploys backend changes
4. **No manual deployment needed!**

### Manual Redeploy:

**Vercel:**
- Dashboard → Deployments → Click "..." → Redeploy

**Railway:**
- Dashboard → Your Service → Deployments → Click "Redeploy"

---

## Monitoring & Logs

### View Logs:

**Vercel:**
- Dashboard → Your Project → Deployments → Click on a deployment → View logs

**Railway:**
- Dashboard → Your Service → Click "View Logs" or "Deployments" tab

### Check Status:

- **Vercel:** Dashboard shows deployment status
- **Railway:** Dashboard shows service status (green = running)

---

## Cost Estimate

### Free Tier (Should be enough to start):

**Vercel:**
- ✅ Free tier: 100GB bandwidth/month
- ✅ Unlimited deployments
- ✅ Perfect for your use case

**Railway:**
- ✅ $5 free credit/month
- ✅ Usually enough for low-medium traffic
- ⚠️ If you exceed, it's ~$5-10/month for small apps

### If You Need More:

- **Vercel Pro:** $20/month (if you need more bandwidth)
- **Railway:** Pay-as-you-go after free credit

---

## Quick Reference

### Your URLs:
- **Frontend:** `https://your-app.vercel.app`
- **Backend:** `https://your-app.up.railway.app`
- **Health Check:** `https://your-app.up.railway.app/health`

### Important Files:
- `.vercelignore` - Already created, excludes backend files from Vercel
- `vercel.json` - Vercel configuration (already set up)
- Railway auto-detects from your `package.json`

---

## Need Help?

1. **Check logs** in both Vercel and Railway dashboards
2. **Test backend directly** using the health endpoint
3. **Check browser console** for frontend errors
4. **Verify environment variables** are set correctly

---

## Next Steps

Once deployed:
1. ✅ Test the full workflow (upload → scan → export)
2. ✅ Share your Vercel URL with users
3. ✅ Monitor usage in both dashboards
4. ✅ Set up custom domain (optional)

**You're all set! 🎉**
