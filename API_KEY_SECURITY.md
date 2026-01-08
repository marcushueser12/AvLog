# Keeping Your API Key Secret

## ✅ Your API Key is Safe!

**Important:** Your API key is NEVER stored in your code or GitHub repository. Here's how it works:

## How It Works

### 1. Local Development (Your Computer)
- API key is stored in `.env` file
- `.env` is in `.gitignore` - **never committed to GitHub**
- Only you have access to it locally

### 2. Production Deployment (Railway/Vercel)
- API key is set in the **platform dashboard** (Railway/Vercel)
- It's stored as an **environment variable** on their servers
- **Never** stored in your code or GitHub

## Setting API Keys in Deployment Platforms

### Railway (Backend)

1. Go to Railway dashboard → Your Service
2. Click **"Variables"** tab
3. Click **"New Variable"**
4. Add:
   ```
   Name: GEMINI_API_KEY
   Value: your_actual_api_key_here
   ```
5. Click **"Add"**
6. ✅ Done! Railway stores it securely on their servers

**The API key is:**
- ✅ Encrypted on Railway's servers
- ✅ Only accessible to your deployed app
- ✅ Never visible in your GitHub code
- ✅ Never exposed to frontend/browsers

### Vercel (Frontend)

Vercel doesn't need your Gemini API key - only the backend does!

You only need to set:
```
VITE_API_URL = https://your-railway-backend.up.railway.app
```

## Security Best Practices

### ✅ DO:
- ✅ Set API keys in platform dashboards (Railway/Vercel)
- ✅ Use `.env` file locally (already in `.gitignore`)
- ✅ Use `env.example` as a template (no real keys)
- ✅ Rotate API keys if accidentally exposed

### ❌ DON'T:
- ❌ Never commit `.env` files to GitHub
- ❌ Never hardcode API keys in your code
- ❌ Never share API keys in screenshots/docs
- ❌ Never commit `env.example` with real keys

## What's in Your Repository?

### Safe to Commit:
- ✅ `env.example` - Template file (no real keys)
- ✅ `server/index.ts` - Code that reads from `process.env.GEMINI_API_KEY`
- ✅ All your application code

### Never Committed:
- ❌ `.env` - Your actual API key (in `.gitignore`)
- ❌ `.env.local` - Local overrides (in `.gitignore`)
- ❌ Any file with real API keys

## How Your Code Reads the API Key

### Backend (server/index.ts):
```typescript
// This reads from environment variables
const apiKey = process.env.GEMINI_API_KEY;
// Railway/Vercel inject this at runtime
// It's never in your code!
```

### Frontend:
```typescript
// Frontend only knows the backend URL
const API_URL = import.meta.env.VITE_API_URL;
// Frontend NEVER sees the Gemini API key
```

## Verification Checklist

Before deploying, verify:

- [ ] `.env` is in `.gitignore` ✅ (Already done)
- [ ] No API keys in any committed files
- [ ] `env.example` has placeholder values only
- [ ] Ready to set API key in Railway dashboard

## If You Accidentally Commit an API Key

**If this happens:**

1. **Immediately rotate your API key** in Google AI Studio
2. Remove the key from your code
3. Use `git filter-branch` or BFG Repo-Cleaner to remove from git history
4. Force push (if you're the only contributor)
5. Set new key in Railway dashboard

**Prevention:** Always check `git status` before committing to ensure `.env` isn't included.

## Summary

🔒 **Your API key security:**
- ✅ Local: Stored in `.env` (not in git)
- ✅ Production: Stored in Railway dashboard (not in code)
- ✅ Frontend: Never sees the API key
- ✅ GitHub: No API keys in repository

**You're all set!** Your API key will be secure when you deploy.
