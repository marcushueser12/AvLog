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

## 7. Troubleshooting: "Failed to load Clerk" / ERR_CONNECTION_RESET

If you see errors like:

- `GET https://clerk.logextract.co/npm/@clerk/clerk-js@5/dist/clerk.browser.js net::ERR_CONNECTION_RESET`
- `Clerk: Failed to load Clerk, failed to load script` (`failed_to_load_clerk_js`)

**Cause:** Your Clerk instance is set to use a **custom domain** (e.g. `clerk.logextract.co`) for the Frontend API. The SDK then tries to load the Clerk script from that domain. If that host isn’t correctly proxying to Clerk (or DNS/SSL is broken), the request fails.

**Fix (already in code):** The app now forces the Clerk script to load from a working CDN (unpkg) via `clerkJSUrl`. Redeploy the frontend so the new build is live; the error should stop.

**Optional – fix in Clerk Dashboard:** To use Clerk’s default domain instead of a custom one:

1. In **Clerk Dashboard** go to **Configure** → **Domains** (or **Paths**).
2. If you see a custom Frontend API domain (e.g. `clerk.logextract.co`), remove it or fix the proxy so it forwards to Clerk’s servers.
3. After that, you can remove the `clerkJSUrl` override in code if you prefer to use Clerk’s default script URL.

**Override script URL yourself:** Set `VITE_CLERK_JS_URL` to any URL that serves `@clerk/clerk-js` if needed.

### Fix: `/v1/client` and `/v1/environment` calling clerk.logextract.co (ERR_CONNECTION_RESET)

If the **script** loads but requests to `clerk.logextract.co/v1/client` or `.../v1/environment` fail with **ERR_CONNECTION_RESET**, your publishable key is tied to that custom domain and the SDK is using it for API calls. Override the Frontend API URL:

1. **Get your default Clerk Frontend API URL**
   - In **Clerk Dashboard** go to **Configure** → **Domains**.
   - If you use a custom domain (e.g. `clerk.logextract.co`), remove it so the instance uses Clerk’s default, or note the **default** instance URL shown (e.g. `https://<slug>.clerk.accounts.dev`).
   - That default URL is your Frontend API base (e.g. `https://pleasant-dog-12.clerk.accounts.dev`).

2. **Set it in your app** (use **one** of these):

   **Option A – Env var (recommended)**  
   Add the variable **where the frontend is built** (e.g. Vercel → your project → Settings → Environment Variables), **not** only on the backend (Railway):
   - **Name:** `VITE_CLERK_FAPI_URL`
   - **Value:** your default Clerk Frontend API URL (e.g. `https://YOUR-SLUG.clerk.accounts.dev`).  
   Then trigger a **new build** (e.g. Redeploy on Vercel). Vite bakes `VITE_*` in at build time, so a new deploy is required.

   **Option B – In-code fallback (if env var doesn’t work)**  
   If requests still go to `clerk.logextract.co`, the build may not see the env var (e.g. wrong project, cache, or backend-only env). Use the fallback in code:
   - Open **`index.tsx`** and find:  
     `const CLERK_FAPI_FALLBACK_IN_CODE: string | undefined = undefined;`
   - Set it to your default Clerk URL, e.g.:  
     `const CLERK_FAPI_FALLBACK_IN_CODE = 'https://YOUR-SLUG.clerk.accounts.dev';`  
     (replace `YOUR-SLUG` with the slug from Clerk Dashboard → Configure → Domains.)
   - Commit and push, then redeploy the frontend. Requests will go to Clerk’s default host instead of `clerk.logextract.co`.

3. **Where to get the slug**  
   In Clerk Dashboard → **Configure** → **Domains**, check the **Frontend API** section. If only the custom domain is shown, try **Support** (support@clerk.com) to remove or reset the custom domain so the default `https://<slug>.clerk.accounts.dev` is available or shown.

The app will then send `/v1/client` and `/v1/environment` to Clerk’s default host instead of your custom domain.

---

## 8. References

- [Clerk React Quickstart](https://clerk.com/docs/quickstarts/react)
- [Clerk environment variables](https://clerk.com/docs/guides/development/clerk-environment-variables)
- Full Clerk + Supabase + user migration: **`CLERK_SUPABASE_SETUP.md`**
- Script loading: [Clerk troubleshooting](https://clerk.com/docs/guides/development/troubleshooting/script-loading)
