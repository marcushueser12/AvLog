# Deployment Checklist - Vercel + Railway

Use this checklist to ensure you don't miss any steps when deploying.

## Pre-Deployment

- [ ] Code is pushed to GitHub repository
- [ ] You have a Gemini API key ready
- [ ] You have GitHub accounts for both Vercel and Railway

## Railway Backend Setup

- [ ] Signed up for Railway (railway.app)
- [ ] Created new project from GitHub repo
- [ ] Service auto-detected or configured manually
- [ ] Build Command set: `npm run build:server`
- [ ] Start Command set: `node dist/server/index.js`
- [ ] Added environment variable: `GEMINI_API_KEY`
- [ ] Added environment variable: `NODE_ENV=production`
- [ ] Generated Railway domain
- [ ] Backend deployed successfully
- [ ] Tested health endpoint: `/health` returns OK
- [ ] **Copied Railway URL** (e.g., `https://xxx.up.railway.app`)

## Vercel Frontend Setup

- [ ] Signed up for Vercel (vercel.com)
- [ ] Imported project from GitHub
- [ ] Framework detected as Vite (or set manually)
- [ ] Build Command: `npm run build:client`
- [ ] Output Directory: `dist`
- [ ] Added environment variable: `VITE_API_URL` = Railway URL
- [ ] Frontend deployed successfully
- [ ] **Copied Vercel URL** (e.g., `https://xxx.vercel.app`)

## Connect Frontend & Backend

- [ ] Added `ALLOWED_ORIGINS` to Railway = Vercel URL
- [ ] Railway redeployed after adding CORS
- [ ] Tested frontend can call backend API
- [ ] No CORS errors in browser console
- [ ] Can upload images
- [ ] Can process scans
- [ ] Can export CSV

## Final Verification

- [ ] Frontend loads correctly
- [ ] Backend health check works
- [ ] Full workflow tested (upload → scan → verify → export)
- [ ] No errors in browser console
- [ ] No errors in Railway logs
- [ ] No errors in Vercel build logs

## Optional Enhancements

- [ ] Set up custom domain (Vercel)
- [ ] Set up custom domain (Railway)
- [ ] Added preview URL to `ALLOWED_ORIGINS` (for PR previews)
- [ ] Set up monitoring/alerts
- [ ] Configured auto-deploy settings

## Your Deployment URLs

**Frontend (Vercel):**
```
https://_____________________.vercel.app
```

**Backend (Railway):**
```
https://_____________________.up.railway.app
```

**Health Check:**
```
https://_____________________.up.railway.app/health
```

---

## Quick Commands Reference

### Test Backend Locally:
```bash
npm run dev:server
# Should start on http://localhost:3001
```

### Test Frontend Locally:
```bash
npm run dev:client
# Should start on http://localhost:3000
```

### Build Locally (to test):
```bash
npm run build
```

### Check Environment Variables:
```bash
# Railway: Dashboard → Variables tab
# Vercel: Dashboard → Settings → Environment Variables
```

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| CORS errors | Check `ALLOWED_ORIGINS` includes Vercel URL |
| API not found | Verify `VITE_API_URL` is set in Vercel |
| Build fails | Check build logs, verify dependencies |
| Backend won't start | Check Railway logs, verify `GEMINI_API_KEY` |
| Images not processing | Check Railway logs for Gemini API errors |

---

**Ready to deploy?** Follow the detailed guide in `DEPLOY_VERCEL_RAILWAY.md`
