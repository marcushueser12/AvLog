# Clerk + Supabase Setup and Moving Users to Clerk

This app uses **Clerk** for sign-in/sign-up (React/Vite) and **Supabase** for database and backend auth. Use this guide to finish configuring both and to move existing Supabase users to Clerk.

---

## 1. Clerk setup (React + Vite)

- **Docs:** [Clerk React Quickstart](https://clerk.com/docs/quickstarts/react)

### 1.1 Create a Clerk application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com) and sign in or create an account.
2. Create a new application (or use an existing one).
3. Open **API Keys**: [dashboard.clerk.com → API keys](https://dashboard.clerk.com/last-active?path=api-keys).
4. Select **React** and copy the **Publishable Key** (starts with `pk_test_` or `pk_live_`).

### 1.2 Environment variable (client)

- Create or edit **`.env.local`** in the project root (do not commit this file; `.gitignore` already excludes `.env*`).
- Add the key with the **`VITE_`** prefix so Vite exposes it to the client:

```bash
VITE_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Replace `YOUR_PUBLISHABLE_KEY` with the value from the Clerk Dashboard. Use only placeholders in any tracked files or docs.

### 1.3 App wiring (already done in this repo)

- The app is wrapped in **`<ClerkProvider publishableKey={...}>`** in **`index.tsx`** (the root entry).
- **`VITE_CLERK_PUBLISHABLE_KEY`** is read with `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY`.
- If the key is missing, Clerk is not loaded; when it is set, Clerk’s Sign In / Sign Up / User button are shown in the header.

### 1.4 Optional: redirect after sign-out

- `afterSignOutUrl="/"` is already set on `ClerkProvider` in `index.tsx`. Change it there if you want a different redirect.

---

## 2. Supabase setup

### 2.1 Project and API keys

1. Go to [Supabase Dashboard](https://app.supabase.com) and open your project (or create one).
2. **Settings → API**: copy **Project URL**, **anon (public) key**, and **service_role key** (keep the latter secret and server-only).

### 2.2 Environment variables

In **`.env.local`** (and in your deployment environment), set:

```bash
# Supabase (backend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Supabase (frontend – Vite exposes only VITE_* to client)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Use the same URL and anon key for both backend and frontend; use the service role key only on the backend. Never commit real keys; use placeholders in examples.

### 2.3 Add Clerk as a Third-Party Auth provider in Supabase (so Clerk and Supabase work together)

The **URL** Supabase asks for is your **Clerk domain** (the Frontend API host), not a redirect or callback URL.

**Step 1 – Get the Clerk domain**

1. In **Clerk Dashboard** go to the **Supabase integration** page:  
   [dashboard.clerk.com/setup/supabase](https://dashboard.clerk.com/setup/supabase)
2. Click **Activate Supabase integration** (or follow the steps there).
3. The page will show a **Clerk domain** (e.g. `something.clerk.accounts.dev`). **Copy it.**  
   - If it shows a custom domain like `clerk.logextract.co` and that domain doesn’t work, use the **default** Clerk domain for your instance if you have it (or ask Clerk support). Supabase must be able to reach this domain to verify Clerk JWTs.

**Step 2 – Add Clerk in Supabase**

1. In **Supabase Dashboard** go to **Authentication** → **Third-party** (or **Sign In / Up** → third-party).
2. Click **Add provider** and choose **Clerk**.
3. In the **URL** (or **Clerk domain**) field, paste the **Clerk domain** from Step 1 (e.g. `something.clerk.accounts.dev`).  
   - Use the **host only**, no `https://` or path (e.g. `pleasant-dog-12.clerk.accounts.dev`).
4. Save.

After this, Supabase will accept **Clerk session tokens** as valid auth.

**Using Supabase with Clerk’s token (seamless use from the frontend)**  
When Clerk is added as a third-party provider in Supabase, you can create a Supabase client that sends the Clerk session token on each request. Supabase will then treat the request as authenticated and apply RLS using the Clerk JWT claims (e.g. `auth.jwt() ->> 'sub'` is the Clerk user ID). Example:

```ts
import { createClient } from '@supabase/supabase-js';
import { useSession } from '@clerk/clerk-react';

// Inside a component (React):
const { session } = useSession();
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    global: {
      fetch: (url, options = {}) => {
        return session?.getToken().then((token) => {
          return fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              Authorization: token ? `Bearer ${token}` : '',
            },
          });
        }) ?? fetch(url, options);
      },
    },
  }
);
```

Or use Supabase’s `accessToken` option if your `@supabase/supabase-js` version supports it (see [Supabase third-party Clerk docs](https://supabase.com/docs/guides/auth/third-party/clerk)).  

**Note:** Your Express backend currently expects a **Supabase** access token (from Supabase Auth). If you only use Clerk + Supabase third-party auth and the client above, API calls that go to your **Express** backend still need a token it understands. To make the backend work with Clerk, you’d either implement a **Clerk → Supabase session exchange** (backend issues a Supabase session when given a Clerk JWT) or change the backend to verify **Clerk** JWTs and use Clerk user IDs for authorization.

---

### 2.4 Database and RLS

- Run your existing Supabase migrations so tables and RLS policies are in place.
- Backend auth middleware expects a **Supabase JWT** in the `Authorization: Bearer <token>` header. That token comes from either:
  - Supabase Auth (legacy flow: sign in with email/password via AuthModal), or
  - A future **Clerk → Supabase session exchange** (see below).

---

## 3. How Clerk and Supabase work together in this app

- **Clerk** handles the sign-in/sign-up UI and identity (Clerk’s `<SignInButton>`, `<SignUpButton>`, `<UserButton>`).
- **Supabase** stores your data and backs the API; protected routes expect a **Supabase** access token.

Right now:

- **Legacy path:** Users can still use “Existing account?” → AuthModal and sign in with **Supabase** (email/password). They get a Supabase session and the app works as before.
- **Clerk path:** Users can use “Sign In” / “Sign Up” (Clerk). They get a Clerk session, but the backend does not yet accept Clerk tokens. So **credits, verified scans, and other API calls will not work for Clerk-only users until you add a session exchange**.

To make Clerk the primary auth while keeping Supabase as the database and source of API tokens, you need a **Clerk → Supabase session exchange**:

1. User signs in with Clerk (frontend).
2. Frontend sends the **Clerk JWT** to your backend (e.g. `POST /api/auth/supabase-session` with `Authorization: Bearer <clerk_jwt>`).
3. Backend verifies the Clerk JWT (using `CLERK_SECRET_KEY` and e.g. `@clerk/backend`), then:
   - **New user:** create a Supabase user (e.g. with same email) and a link `clerk_id ↔ supabase_user_id`, then create a Supabase session (e.g. magic link or admin API) and return Supabase `access_token` and `refresh_token`.
   - **Existing Supabase user (same email):** either return `{ needsVerification: true }` and later support a “verify password to link” step, or create/link and return a Supabase session.
4. Frontend stores the Supabase session (e.g. `supabase.auth.setSession(...)`) and uses the Supabase token for API calls so existing backend and RLS keep working.

Until that exchange is implemented, “Sign In (Clerk)” gives identity only; “Existing account?” keeps full app functionality via Supabase.

---

## 4. Moving users from Supabase to Clerk

Goal: existing Supabase users can sign in with Clerk and still have their data (same Supabase user id / RLS).

### 4.1 Option A: Link on first Clerk sign-in (recommended)

1. **Backend session exchange** (as in section 3):
   - When the frontend sends a Clerk JWT, backend looks up Supabase user by **email** (e.g. from Clerk token).
   - If a Supabase user exists with that email and there is no Clerk link yet, return e.g. `{ needsVerification: true, email }`.
   - Frontend shows: “We found an existing account for … Verify your password to link it to this sign-in.”
   - User enters their **existing Supabase password**; frontend sends it to the backend (over HTTPS, e.g. `POST /api/auth/link-existing` with Clerk JWT + password).
   - Backend verifies password with Supabase (`signInWithPassword` with anon client), creates a link `clerk_user_id → supabase_user_id`, then returns the Supabase session so the frontend can call `supabase.auth.setSession(...)`.
   - From then on, that user signs in with Clerk and gets a Supabase session via the same exchange (no password step again).

2. **Database:** Add a table to store the link, e.g.:

   - `clerk_supabase_links (clerk_user_id text primary key, supabase_user_id uuid not null)`  
   - Backend uses this to find `supabase_user_id` when you only have the Clerk JWT.

3. **Security:** Only allow linking when the Clerk JWT is valid and the Supabase password is correct; rate-limit the link endpoint.

### 4.2 Option B: One-time migration (bulk)

1. **Export** Supabase users (e.g. from `auth.users` via Dashboard or SQL; handle PII according to your policy).
2. **Invite or notify** them (email) that they should sign in with the new flow (Clerk) using the **same email**.
3. On first Clerk sign-in, use the same **session exchange + “verify password to link”** flow as in Option A so their existing Supabase user is linked and they keep access to their data.
4. Optionally run a script that creates Clerk users (e.g. via Clerk Backend API) and sends magic links so users can set a password in Clerk; then you can deprecate Supabase Auth for new logins.

### 4.3 Option C: Keep both indefinitely

- New users: sign up with Clerk (and, once implemented, get a Supabase session via the exchange).
- Existing users: can keep using “Existing account?” (Supabase email/password) or link once via Option A and then use Clerk.

---

## 5. Checklist

- [ ] Clerk application created; **Publishable Key** copied.
- [ ] **`VITE_CLERK_PUBLISHABLE_KEY`** set in `.env.local` (and in production env); no real keys in repo.
- [ ] Supabase **URL**, **anon key**, and **service_role key** set (backend); **VITE_SUPABASE_URL** and **VITE_SUPABASE_ANON_KEY** set (frontend).
- [ ] `.gitignore` excludes `.env*` (already done in this repo).
- [ ] (Optional) Implement Clerk → Supabase session exchange and “verify password to link” for existing users.
- [ ] (Optional) Add `clerk_supabase_links` (or equivalent) and backend logic to link Clerk users to Supabase users.

---

## 6. References

- Clerk React: [Quickstart](https://clerk.com/docs/quickstarts/react)
- Clerk env vars: [Development](https://clerk.com/docs/guides/development/clerk-environment-variables)
- Clerk Dashboard API keys: [API keys](https://dashboard.clerk.com/last-active?path=api-keys)
- Supabase Auth: [Supabase Auth docs](https://supabase.com/docs/guides/auth)
