# Supabase Production Setup - Fixing Email Confirmation Redirects

## Problem

When you manually send confirmation emails from Supabase dashboard, the links redirect to `localhost` instead of your production URL.

## Solution

You need to update the **Site URL** in Supabase settings to point to your production domain.

---

## Step 1: Update Site URL in Supabase

### 1.1 Navigate to Settings

1. Go to your Supabase dashboard
2. Select your project
3. Click **"Authentication"** in the left sidebar
4. Click **"Settings"** (under Authentication)

### 1.2 Update Site URL

1. Scroll down to find **"Site URL"** section
2. Change it from:
   ```
   http://localhost:3000
   ```
   To your production URL:
   ```
   https://your-production-domain.vercel.app
   ```
   Or your custom domain:
   ```
   https://logextract.com
   ```

3. Click **"Save"**

### 1.3 Add Redirect URLs (Important!)

1. Still in Authentication → Settings
2. Scroll to **"Redirect URLs"** section
3. Add all the URLs where users might land after email confirmation:
   ```
   http://localhost:3000/auth/callback
   https://your-production-domain.vercel.app/auth/callback
   https://logextract.com/auth/callback
   ```
   (Add both development and production URLs)

4. Click **"Save"**

---

## Step 2: Verify Email Template

1. Go to **Authentication** → **Email Templates**
2. Click on **"Confirm signup"** template
3. Check that the template includes:
   ```
   {{ .ConfirmationURL }}
   ```
   This will automatically use the correct URL based on where the user signed up.

4. The confirmation link will look like:
   ```
   https://your-project.supabase.co/auth/v1/verify?token=xxx&type=signup&redirect_to=https://your-production-domain.vercel.app/auth/callback
   ```

---

## Step 3: Test Confirmation Emails

### For Production:

1. When a user signs up on your production site, the confirmation email will contain:
   - Redirect URL pointing to your production domain
   - The link will work correctly

### For Development:

1. When testing locally, make sure your `.env` has:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   ```

2. Users signing up on `localhost` will get confirmation emails with `localhost` redirects
3. This is correct for development!

---

## How It Works

The confirmation email URL works like this:

1. **User signs up** → Supabase sends confirmation email
2. **Email contains link** → Uses the `emailRedirectTo` from signup OR the Site URL if manually sent
3. **User clicks link** → Goes to `https://your-project.supabase.co/auth/v1/verify?token=xxx&redirect_to=YOUR_SITE_URL/auth/callback`
4. **Supabase verifies** → Then redirects to `YOUR_SITE_URL/auth/callback`
5. **Your app** → Should handle `/auth/callback` route to complete login

---

## Important Notes

1. **Site URL** should be your production URL
2. **Redirect URLs** should include BOTH development AND production URLs
3. The code automatically uses `window.location.origin`, so it works for both dev and prod
4. Manually sent emails from Supabase dashboard use the Site URL

---

## Troubleshooting

### Email still redirects to localhost?

1. Check that **Site URL** is set to production URL
2. Make sure you clicked **"Save"** in Supabase settings
3. Try sending a new test email after saving

### Redirect URL not in allowed list?

1. Add the redirect URL to **"Redirect URLs"** in Supabase settings
2. Include the full path: `https://yourdomain.com/auth/callback`

### Production users getting localhost links?

1. Make sure your production environment variables are set correctly
2. The code uses `window.location.origin` which should automatically use production URL
3. But manually sent emails from dashboard will always use Site URL

---

## Best Practice

For production, set:
- **Site URL**: Your production domain
- **Redirect URLs**: Include both development and production callback URLs

This way:
- Production signups → Production confirmation links ✅
- Development testing → Localhost confirmation links ✅
- Manual emails → Production confirmation links ✅
