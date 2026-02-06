# Get Clerk Running (Railway + Vercel)

Code is pushed to GitHub; Railway will auto-deploy the backend. Use this guide to turn on Clerk in production.

---

## 1. Get your Clerk keys

1. Open **[Clerk Dashboard](https://dashboard.clerk.com)** and sign in.
2. Select your application (or create one).
3. Go to **API Keys**: [dashboard.clerk.com → API keys](https://dashboard.clerk.com/last-active?path=api-keys).
4. Under **React**, copy:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`) → used in the **frontend**.
   - **Secret Key** (starts with `sk_test_` or `sk_live_`) → used only on the **backend** when you add a Clerk → Supabase session exchange (optional for now).

Use only these keys in environment variables; never commit them.

---

## 2. Where your app runs

- **Backend:** Railway (API, server).
- **Frontend:** Either:
  - **Vercel** (if you followed the Vercel + Railway guide), or
  - **Railway** (if you build and serve the full app from one Railway service).

Clerk’s **Publishable Key** must be available where the **frontend** is built and served.

---

## 3. Set Clerk env vars

### If the frontend is on **Vercel**

1. Open [Vercel Dashboard](https://vercel.com) → your **AvLog** project.
2. Go to **Settings** → **Environment Variables**.
3. Add:
   - **Name:** `VITE_CLERK_PUBLISHABLE_KEY`  
   - **Value:** your Clerk **Publishable Key** (from step 1).  
   - **Environment:** Production (and Preview if you want Clerk in previews).
4. Save. Trigger a new deployment (e.g. **Deployments** → **Redeploy** or push a commit) so the new variable is baked into the build.

Clerk will work on the next frontend deployment.

### If the frontend is built and served from **Railway** (single service)

1. Open [Railway Dashboard](https://railway.app) → your project → the service that builds and runs the app.
2. Go to **Variables**.
3. Add:
   - **Name:** `VITE_CLERK_PUBLISHABLE_KEY`  
   - **Value:** your Clerk **Publishable Key**.
4. Save. Railway will redeploy; the next build will include the key.

### Backend (Railway) – optional for now

Only needed when you implement a **Clerk → Supabase session exchange** (see `CLERK_SUPABASE_SETUP.md`).

- In the same Railway service (backend), add:
  - **Name:** `CLERK_SECRET_KEY`  
  - **Value:** your Clerk **Secret Key**.

Do **not** add the Secret Key to Vercel or any client-side config.

---

## 4. Clerk Dashboard – allowed origins (production)

So Clerk only accepts requests from your real app:

1. In **Clerk Dashboard** go to **Configure** → **Domains** (or **Paths** / **Allowed redirect origins**, depending on UI).
2. Add your **production frontend URL**, e.g.:
   - `https://your-app.vercel.app`
   - or `https://your-app.up.railway.app`  
   (no trailing slash).
3. If you use custom domains (e.g. `https://logextract.co`), add those too.
4. Save.

Without this, Clerk may block sign-in/sign-up on the live site.

---

## 5. Quick checklist

- [ ] Clerk application created; Publishable Key copied.
- [ ] **VITE_CLERK_PUBLISHABLE_KEY** set where the frontend is built (Vercel or Railway).
- [ ] (Optional) **CLERK_SECRET_KEY** set on Railway when you add the session exchange.
- [ ] Production domain(s) added in Clerk Dashboard.
- [ ] New deployment triggered after adding env vars (so the build includes the key).

---

## 6. Verify

1. Open your **production frontend URL** (Vercel or Railway).
2. You should see **Sign In** and **Sign Up** (Clerk) in the header, and “Existing account?” for Supabase.
3. Click **Sign Up**, create a test user, and confirm the Clerk flow works.

If you still see only the old “Sign In” button, the frontend was built without `VITE_CLERK_PUBLISHABLE_KEY`. Add the variable and redeploy the frontend.

---

## 7. References

- [Clerk React Quickstart](https://clerk.com/docs/quickstarts/react)
- [Clerk environment variables](https://clerk.com/docs/guides/development/clerk-environment-variables)
- Full Clerk + Supabase + user migration: **`CLERK_SUPABASE_SETUP.md`**
