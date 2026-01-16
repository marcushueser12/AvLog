# Supabase Integration Setup Guide

This guide will walk you through setting up Supabase authentication, database, and integrating it with your LogExtract application.

## Table of Contents

1. [Create Supabase Project](#1-create-supabase-project)
2. [Set Up Database Schema](#2-set-up-database-schema)
3. [Configure Environment Variables](#3-configure-environment-variables)
4. [Install Dependencies](#4-install-dependencies)
5. [Verify Installation](#5-verify-installation)
6. [Grant Credits to Users (Admin)](#6-grant-credits-to-users-admin)

---

## 1. Create Supabase Project

### Step 1.1: Sign Up/Login
1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign in"
3. Sign in with GitHub (recommended) or email

### Step 1.2: Create New Project
1. Click "New Project"
2. Fill in the details:
   - **Organization**: Create or select an organization
   - **Project Name**: `logextract` (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Start with Free tier
3. Click "Create new project"
4. Wait 2-3 minutes for project to initialize

### Step 1.3: Get API Keys
1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy these values (you'll need them later):
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) - **KEEP THIS SECRET!**

---

## 2. Set Up Database Schema

### Step 2.1: Open SQL Editor
1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"

### Step 2.2: Run Schema SQL
1. Open the file `supabase/schema.sql` in your project
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click "Run" (or press `Ctrl+Enter` / `Cmd+Enter`)

### Step 2.3: Verify Tables Created
1. Go to **Table Editor** in Supabase dashboard
2. You should see these tables:
   - `user_profiles`
   - `verified_scans`
   - `verified_entries`
   - `credit_transactions`

### Step 2.4: Verify RLS Policies
1. Click on any table (e.g., `user_profiles`)
2. Go to **Policies** tab
3. You should see RLS policies listed (e.g., "Users can view own profile")

---

## 3. Configure Environment Variables

### Step 3.1: Frontend Environment Variables

Create or update `.env` in your project root:

```bash
# Supabase Configuration (Frontend)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Backend API URL
VITE_API_URL=http://localhost:3001
```

### Step 3.2: Backend Environment Variables

Add to your `.env` file (or Railway/Vercel environment variables):

```bash
# Supabase Configuration (Backend)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Admin Secret Token (for granting credits)
# Generate a secure random token:
# On Mac/Linux: openssl rand -hex 32
# On Windows: Use online generator or PowerShell
ADMIN_SECRET_TOKEN=your-generated-secret-token-here

# Other existing variables
GEMINI_API_KEY=your-gemini-key
PORT=3001
NODE_ENV=development
```

### Step 3.3: Production Environment Variables

If deploying to Railway/Vercel:

**Railway (Backend):**
1. Go to your Railway project
2. Click on your backend service
3. Go to **Variables** tab
4. Add all the backend environment variables above

**Vercel (Frontend):**
1. Go to your Vercel project
2. Go to **Settings** → **Environment Variables**
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

---

## 4. Install Dependencies

Dependencies are already installed, but if you need to reinstall:

```bash
npm install @supabase/supabase-js
```

---

## 5. Verify Installation

### Step 5.1: Test Frontend Connection
1. Start your dev server: `npm run dev`
2. Open the app in your browser
3. You should see a "Sign In" button (if not logged in)
4. Click "Sign In" → "Sign Up"
5. Create a test account
6. Check Supabase dashboard → **Authentication** → **Users** to see the new user

### Step 5.2: Test Database
1. After signing up, go to Supabase dashboard → **Table Editor** → `user_profiles`
2. You should see a row with your user ID and 10 credits (default)

### Step 5.3: Test Backend
1. Start your backend: `npm run dev:server`
2. Verify the server starts without errors
3. Check the console for any Supabase connection warnings

---

## 6. Grant Credits to Users (Admin)

### Method 1: Using Admin API Endpoint (Recommended)

#### Step 6.1: Get Admin Token
Your admin token is stored in `ADMIN_SECRET_TOKEN` environment variable.

#### Step 6.2: Grant Credits via cURL

```bash
curl -X POST http://localhost:3001/api/admin/grant-credits \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_SECRET_TOKEN" \
  -d '{
    "userEmail": "user@example.com",
    "amount": 50,
    "reason": "Beta tester bonus"
  }'
```

**Production example:**
```bash
curl -X POST https://your-backend.railway.app/api/admin/grant-credits \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_SECRET_TOKEN" \
  -d '{
    "userEmail": "user@example.com",
    "amount": 50
  }'
```

#### Step 6.3: Verify Credits Granted
1. Check Supabase dashboard → **Table Editor** → `user_profiles`
2. Find the user and verify credits were updated
3. Check `credit_transactions` table to see the transaction log

### Method 2: Using Supabase Dashboard SQL Editor

1. Go to Supabase dashboard → **SQL Editor**
2. Run this SQL:

```sql
-- Grant 50 credits to a user by email
UPDATE user_profiles
SET credits = credits + 50
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- Log the transaction
INSERT INTO credit_transactions (user_id, amount, type, description)
SELECT id, 50, 'manual_grant', 'Granted via SQL Editor'
FROM auth.users
WHERE email = 'user@example.com';
```

### Method 3: Check User Credits (Admin API)

```bash
curl -X GET http://localhost:3001/api/admin/user-credits/user@example.com \
  -H "x-admin-token: YOUR_ADMIN_SECRET_TOKEN"
```

---

## Troubleshooting

### Error: "Supabase URL or Anon Key is missing"
- **Cause**: Environment variables not set
- **Fix**: Check `.env` file has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Note**: Frontend needs `VITE_` prefix, backend needs without prefix

### Error: "Row Level Security policy violation"
- **Cause**: User trying to access another user's data
- **Fix**: This is expected! RLS is working. Users can only see their own data.

### Error: "Admin functionality is not configured"
- **Cause**: `ADMIN_SECRET_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY` not set
- **Fix**: Add these to your backend `.env` file

### Users can't sign up
- **Check**: Supabase → **Authentication** → **Providers** → Email is enabled
- **Check**: Supabase → **Authentication** → **Settings** → Email confirmations (try disabling for testing)

### Verified entries not saving
- **Check**: Backend logs for errors
- **Check**: User is authenticated (has valid JWT token)
- **Check**: `verified_entries` table exists and has RLS policies

---

## Security Notes

1. **Never commit `.env` files** to git
2. **Never expose `SUPABASE_SERVICE_ROLE_KEY`** to frontend
3. **Never expose `ADMIN_SECRET_TOKEN`** publicly
4. **Keep `ADMIN_SECRET_TOKEN` secure** - only you should have it
5. **Service Role Key bypasses RLS** - only use on backend

---

## Next Steps

- [ ] Test user signup/login
- [ ] Test saving verified entries
- [ ] Test granting credits via admin API
- [ ] Deploy to production (Railway/Vercel)
- [ ] Set up production environment variables
- [ ] Test end-to-end flow in production

---

## API Endpoints Reference

### Admin Endpoints (Protected by `x-admin-token` header)

**Grant Credits:**
```http
POST /api/admin/grant-credits
Headers: x-admin-token: YOUR_SECRET_TOKEN
Body: { "userEmail": "user@example.com", "amount": 50, "reason": "Optional" }
```

**Get User Credits:**
```http
GET /api/admin/user-credits/:email
Headers: x-admin-token: YOUR_SECRET_TOKEN
```

### Verified Entries Endpoints (Protected by `Authorization: Bearer <token>` header)

**Save Verified Scan:**
```http
POST /api/verified/save-scan
Headers: Authorization: Bearer <jwt_token>
Body: { pageNumber, mode, entries[], ... }
```

**Get User's Verified Scans:**
```http
GET /api/verified/scans
Headers: Authorization: Bearer <jwt_token>
```

**Get Entries for Scan:**
```http
GET /api/verified/entries/:scanId
Headers: Authorization: Bearer <jwt_token>
```

---

## Support

If you encounter issues:
1. Check Supabase dashboard logs: **Logs** → **Postgres Logs**
2. Check backend console logs
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly
