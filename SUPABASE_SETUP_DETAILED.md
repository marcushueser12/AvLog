# Detailed Supabase Setup Guide - Step by Step

This is a comprehensive, detailed guide for setting up Supabase with your LogExtract application. Follow each step carefully.

---

## Prerequisites

✅ You have a Supabase account (connected to GitHub)  
✅ You're logged into Supabase dashboard  
✅ You have your LogExtract project open in your code editor  

---

## Step 1: Create a New Supabase Project

### 1.1 Navigate to Projects

1. Go to [https://supabase.com](https://supabase.com)
2. You should see the Supabase dashboard
3. Click **"New Project"** button (green button in the top right, or in the projects list)

### 1.2 Fill in Project Details

**Organization:**
- If you have an organization, select it from the dropdown
- If not, create a new one or use "Personal" (your account)

**Project Name:**
- Enter: `logextract` (or your preferred name)
- Example: `logextract-production` or `logextract-dev`

**Database Password:**
- Click **"Generate a password"** button
- **IMPORTANT:** Copy this password and save it somewhere safe (password manager, notes app, etc.)
- You'll need this if you ever connect directly to the database
- Example password format: `Your-Super-Secret-Password-123!`

**Region:**
- Choose the region closest to you or your users
- For North America: `US East (N. Virginia)` or `US West (Oregon)`
- For Europe: `EU West (Ireland)` or `EU Central (Frankfurt)`
- Click on the region dropdown to see all options

**Pricing Plan:**
- Select **"Free"** (for now - you can upgrade later)
- The free tier gives you:
  - 500MB database space
  - 1GB file storage
  - 2GB bandwidth
  - 50,000 monthly active users
  - Unlimited API requests

### 1.3 Create the Project

1. Review all the details
2. Click **"Create new project"** (green button at bottom)
3. **Wait 2-3 minutes** for the project to be created
   - You'll see a progress indicator
   - Don't close the tab while it's creating

### 1.4 Verify Project Created

Once complete, you should see:
- Your project dashboard
- Overview page with project stats
- Left sidebar with navigation menu

---

## Step 2: Get Your API Keys

### 2.1 Navigate to API Settings

1. In the left sidebar, click **"Settings"** (gear icon at the bottom)
2. Click **"API"** in the Settings submenu

### 2.2 Copy Project URL

1. Find the **"Project URL"** section (near the top)
2. It looks like: `https://xxxxxxxxxxxxx.supabase.co`
3. Click the **copy icon** (clipboard icon) next to it
4. **Paste it in a text file for now** - you'll need it soon

### 2.3 Copy Anon/Public Key

1. Scroll down to **"Project API keys"** section
2. Find the key labeled **"anon" "public"**
3. It starts with `eyJ...` (very long string)
4. Click the **eye icon** to reveal it (if hidden)
5. Click the **copy icon** next to it
6. **Paste it in your text file**

### 2.4 Copy Service Role Key (IMPORTANT - KEEP SECRET!)

1. Still in the **"Project API keys"** section
2. Find the key labeled **"service_role" "secret"**
3. It also starts with `eyJ...`
4. Click the **eye icon** to reveal it
5. Click the **copy icon** next to it
6. **⚠️ IMPORTANT:** This key bypasses all security rules
   - Never commit this to git
   - Never expose it to the frontend
   - Only use it in your backend/server code
   - Store it securely (environment variables)
7. **Paste it in your text file** (keep it separate from the anon key)

### 2.5 Save Your Keys Safely

You should now have three values:
- **Project URL**: `https://xxxxx.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

Keep these handy - you'll need them in Step 4.

---

## Step 3: Run the Database Schema

### 3.1 Open SQL Editor

1. In the left sidebar, click **"SQL Editor"** (database icon)
2. Click **"New query"** button (green button, top right)
3. You'll see a code editor window

### 3.2 Open Schema File

1. Open your LogExtract project in your code editor
2. Navigate to: `supabase/schema.sql`
3. Open the file
4. **Select all** (Ctrl+A / Cmd+A)
5. **Copy all** (Ctrl+C / Cmd+C)

### 3.3 Paste Schema in SQL Editor

1. Go back to Supabase dashboard (SQL Editor tab)
2. Click in the empty code editor
3. **Paste** the schema (Ctrl+V / Cmd+V)
4. You should see SQL code with CREATE TABLE statements, etc.

### 3.4 Run the Schema

1. Click **"Run"** button (green button at bottom right)
   - Or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)
2. Wait a few seconds for it to execute
3. You should see: **"Success. No rows returned"** or **"Success"** message
4. If you see errors, check the error message (common issues below)

### 3.5 Verify Tables Created

1. In the left sidebar, click **"Table Editor"** (table icon)
2. You should see these tables:
   - ✅ `user_profiles`
   - ✅ `verified_scans`
   - ✅ `verified_entries`
   - ✅ `credit_transactions`
3. If you see all four tables, the schema ran successfully!

### 3.6 Verify Row Level Security (RLS) Policies

1. Click on one of the tables (e.g., `user_profiles`)
2. Click the **"Policies"** tab (next to "Columns" and "Data")
3. You should see policies listed:
   - "Users can view own profile"
   - "Users can update own profile"
   - etc.
4. Check all four tables have policies

### 3.7 Optional: Support & Feature Requests Table

To enable the Support Request modal (Contact support / Feature requests from the landing page):

1. In SQL Editor, click **"New query"**
2. Open `supabase/migration_support_requests.sql` in your project
3. Copy its contents and paste into the SQL Editor
4. Click **"Run"**
5. Verify: Table Editor should show a new `support_requests` table

**If you see "404" or "Support requests temporarily unavailable" when submitting:** Run this migration.

**For admin responses:** Also run `supabase/migration_support_requests_admin_response.sql` to add the `admin_response` column (allows admins to reply to users).

### 3.8 Optional: Featured Reviews

To let admins manually select which reviews appear in the Featured Reviews section:

1. In SQL Editor, click **"New query"**
2. Open `supabase/migration_add_featured_reviews.sql` in your project
3. Copy its contents and paste into the SQL Editor
4. Click **"Run"**
5. Verify: The `reviews` table should have a new `featured` column

**Without this migration:** Featured Reviews will fall back to the top 3 highest-rated approved reviews.

---

## Step 4: Configure Environment Variables

### 4.1 Create/Update .env File

1. Open your LogExtract project in your code editor
2. In the root directory, check if `.env` exists
   - If it exists: open it
   - If not: create a new file named `.env` (no extension)
3. **Copy** the contents of `env.example` to `.env` (if `.env` is empty)

### 4.2 Add Supabase Frontend Variables

Add these to your `.env` file:

```bash
# Supabase Configuration (Frontend)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Replace:**
- `https://your-project-id.supabase.co` with your **Project URL** from Step 2.2
- `your-anon-key-here` with your **Anon Key** from Step 2.3

**Example:**
```bash
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NjY2NjY2NiwiZXhwIjoxOTYyMjQyNjY2fQ.abcdefghijklmnopqrstuvwxyz123456789
```

### 4.3 Add Supabase Backend Variables

Add these to your `.env` file (same file):

```bash
# Supabase Configuration (Backend)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Replace:**
- `https://your-project-id.supabase.co` with your **Project URL** (same as frontend)
- `your-anon-key-here` with your **Anon Key** (same as frontend)
- `your-service-role-key-here` with your **Service Role Key** from Step 2.4

**Example:**
```bash
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NjY2NjY2NiwiZXhwIjoxOTYyMjQyNjY2fQ.abcdefghijklmnopqrstuvwxyz123456789
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQ2NjY2NjY2LCJleHAiOjE5NjIyNDI2NjZ9.zyxwvutsrqponmlkjihgfedcba987654321
```

### 4.4 Generate Admin Secret Token

You need a secure random token for the admin credit-granting endpoint.

**On Mac/Linux:**
```bash
openssl rand -hex 32
```

**On Windows (PowerShell):**
```powershell
-join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})
```

**Or use an online generator:**
- Go to: https://www.random.org/strings/
- Set length to 64, allow hex characters
- Generate and copy

### 4.5 Add Admin Secret Token

Add this to your `.env` file:

```bash
# Admin Secret Token (for granting credits)
ADMIN_SECRET_TOKEN=your-generated-secret-token-here
```

**Replace** with your generated token from Step 4.4.

**Example:**
```bash
ADMIN_SECRET_TOKEN=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### 4.6 Verify .env File

Your `.env` file should now look something like this:

```bash
# Gemini API Key (required for backend)
GEMINI_API_KEY=your-gemini-api-key-here

# Backend API URL (optional - defaults to http://localhost:3001)
VITE_API_URL=http://localhost:3001

# Server Port (optional - defaults to 3001)
PORT=3001

# Environment (development, production)
NODE_ENV=development

# Allowed Origins for CORS (production only)
ALLOWED_ORIGINS=

# Supabase Configuration (Frontend)
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Configuration (Backend)
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Admin Secret Token (for granting credits)
ADMIN_SECRET_TOKEN=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### 4.7 Ensure .env is in .gitignore

1. Check if `.gitignore` exists in your project root
2. Open `.gitignore`
3. Make sure `.env` is listed (if not, add it)
4. This prevents committing secrets to git

---

## Step 5: Test the Integration

### 5.1 Start Your Development Server

1. Open terminal in your project directory
2. Run:
   ```bash
   npm run dev
   ```
3. Wait for both frontend and backend to start
4. You should see:
   ```
   VITE ready in XXX ms
   Server running on 0.0.0.0:3001
   ```

### 5.2 Open the Application

1. Open your browser
2. Go to: `http://localhost:3000`
3. You should see the LogExtract landing page

### 5.3 Test User Signup

1. Click **"Start Scanning"** or navigate to the app
2. You should see a **"Sign In to Save"** button in the header (if not logged in)
3. Click **"Sign In to Save"**
4. In the modal, click **"Don't have an account? Sign up"**
5. Enter:
   - **Email**: `test@example.com` (use a real email you can access)
   - **Password**: `TestPassword123!` (minimum 6 characters)
6. Click **"Create Account"**
7. You should see a success message or be logged in

### 5.4 Verify User Created in Supabase

1. Go back to Supabase dashboard
2. Click **"Authentication"** in the left sidebar
3. Click **"Users"** tab
4. You should see your test user listed with email `test@example.com`
5. Note the **User ID** (UUID) - you'll need this for testing

### 5.5 Verify User Profile Created

1. In Supabase dashboard, click **"Table Editor"**
2. Click on `user_profiles` table
3. Click **"Data"** tab (if not already selected)
4. You should see a row with:
   - `user_id`: matches the User ID from Step 5.4
   - `credits`: `10` (default starting credits)
   - `plan_type`: `free`
5. ✅ If you see this, the auto-create trigger worked!

### 5.6 Test Sign In

1. In your app, sign out (if logged in)
2. Click **"Sign In to Save"**
3. Enter your email and password
4. Click **"Sign In"**
5. You should be logged in and see your email in the header

---

## Step 6: Test Saving Verified Entries

### 6.1 Upload and Extract a Scan

1. While logged in, upload a logbook page (or test images)
2. Start extraction
3. Wait for extraction to complete

### 6.2 Verify a Scan

1. In the verification queue, find a completed scan
2. Click the **checkbox** to mark it as verified
3. You should see "Saving..." briefly
4. Then it should show as verified

### 6.3 Verify Data Saved in Supabase

1. Go to Supabase dashboard → **Table Editor**
2. Click on `verified_scans` table
3. Click **"Data"** tab
4. You should see a row with:
   - `user_id`: your user ID
   - `mode`: `single` or `spread`
   - `status`: `verified`
5. Click on `verified_entries` table
6. Click **"Data"** tab
7. You should see rows with logbook entry data:
   - `user_id`: your user ID
   - `scan_id`: matches the scan ID from `verified_scans`
   - `date`, `aircraft_id`, `total_time`, etc.
8. ✅ If you see data here, saving works!

---

## Step 7: Test Admin Credit Granting

### 7.1 Get Your Admin Token

1. Open your `.env` file
2. Copy the `ADMIN_SECRET_TOKEN` value

### 7.2 Grant Credits via API

Open terminal and run (replace values with yours):

**On Mac/Linux:**
```bash
curl -X POST http://localhost:3001/api/admin/grant-credits \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_SECRET_TOKEN_HERE" \
  -d '{
    "userEmail": "test@example.com",
    "amount": 50,
    "reason": "Beta tester bonus"
  }'
```

**On Windows (PowerShell):**
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/grant-credits" -Method Post -Headers @{"Content-Type"="application/json"; "x-admin-token"="YOUR_ADMIN_SECRET_TOKEN_HERE"} -Body '{"userEmail":"test@example.com","amount":50,"reason":"Beta tester bonus"}'
```

**Replace:**
- `YOUR_ADMIN_SECRET_TOKEN_HERE` with your actual token from `.env`
- `test@example.com` with the email you signed up with

### 7.3 Verify Credits Granted

1. You should see a JSON response:
   ```json
   {
     "success": true,
     "userEmail": "test@example.com",
     "previousBalance": 10,
     "creditsGranted": 50,
     "newBalance": 60,
     "message": "Successfully granted 50 credits to test@example.com"
   }
   ```

2. Verify in Supabase:
   - Go to **Table Editor** → `user_profiles`
   - Find your user's row
   - Check `credits` column - should be `60` (or whatever new balance is)

3. Check transaction log:
   - Go to **Table Editor** → `credit_transactions`
   - You should see a row with:
     - `amount`: `50`
     - `type`: `manual_grant`
     - `description`: `Beta tester bonus`

---

## Step 8: Troubleshooting

### Problem: "Supabase URL or Anon Key is missing"

**Solution:**
1. Check your `.env` file has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Make sure there are no extra spaces or quotes
3. Restart your dev server: `npm run dev`

### Problem: "User not found" when granting credits

**Solution:**
1. Make sure the user has signed up (check Authentication → Users)
2. Make sure you're using the correct email address
3. Check Supabase logs: **Logs** → **Postgres Logs**

### Problem: "Admin functionality is not configured"

**Solution:**
1. Check your `.env` file has `ADMIN_SECRET_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY`
2. Make sure backend server has access to these env vars
3. Restart your backend server

### Problem: Verified entries not saving

**Solution:**
1. Check browser console for errors
2. Check backend terminal for errors
3. Verify you're logged in (check header for email)
4. Check Supabase → **Logs** → **Postgres Logs** for database errors

### Problem: Can't sign up

**Solution:**
1. Check Supabase → **Authentication** → **Providers**
2. Make sure **Email** provider is enabled
3. For testing, you can disable email confirmations:
   - Go to **Authentication** → **Settings**
   - Under **Email Auth**, toggle **"Enable email confirmations"** OFF (for testing only)

### Problem: Schema errors when running SQL

**Common errors and fixes:**

**"relation already exists"**
- Tables already exist - this is OK, you can skip or drop them first

**"permission denied"**
- You need to run as a database superuser - contact Supabase support

**"extension does not exist"**
- Run this first:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```

---

## Step 9: Production Deployment

### 9.1 Add Environment Variables to Railway (Backend)

1. Go to your Railway project
2. Click on your backend service
3. Go to **Variables** tab
4. Add these variables:
   - `SUPABASE_URL` = (your project URL)
   - `SUPABASE_ANON_KEY` = (your anon key)
   - `SUPABASE_SERVICE_ROLE_KEY` = (your service role key)
   - `ADMIN_SECRET_TOKEN` = (your admin token)

### 9.2 Add Environment Variables to Vercel (Frontend)

1. Go to your Vercel project
2. Go to **Settings** → **Environment Variables**
3. Add these variables:
   - `VITE_SUPABASE_URL` = (your project URL)
   - `VITE_SUPABASE_ANON_KEY` = (your anon key)
4. Redeploy your frontend

---

## Step 10: Next Steps

✅ **You're all set!** Your Supabase integration is complete.

**What you can do now:**
- Users can sign up and sign in
- Verified logbook entries are saved to database
- You can grant credits to users via admin API
- All data is protected with Row Level Security

**Future enhancements:**
- Add a "My Verified Pages" tab to view saved entries
- Add credit balance display in UI
- Implement payment system for purchasing credits
- Add user profile/settings page

---

## Quick Reference

**Supabase Dashboard:**
- Project URL: https://app.supabase.com/project/your-project-id

**API Endpoints:**
- Grant Credits: `POST /api/admin/grant-credits` (requires `x-admin-token` header)
- Save Verified Scan: `POST /api/verified/save-scan` (requires `Authorization: Bearer <token>`)
- Get User's Scans: `GET /api/verified/scans` (requires `Authorization: Bearer <token>`)

**Important Files:**
- `.env` - Environment variables (never commit to git)
- `supabase/schema.sql` - Database schema
- `lib/supabase.ts` - Frontend Supabase client
- `server/lib/supabase.ts` - Backend Supabase clients

---

## Need Help?

If you encounter issues:
1. Check Supabase logs: **Logs** → **Postgres Logs**
2. Check browser console for frontend errors
3. Check backend terminal for server errors
4. Review the troubleshooting section above
5. Check Supabase documentation: https://supabase.com/docs

---

**Setup Complete! 🎉**

You now have a fully functional Supabase integration with user accounts, verified entry storage, and admin credit management.
