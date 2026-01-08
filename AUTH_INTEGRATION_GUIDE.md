# Authentication Integration Guide

This guide explains how to integrate Supabase or Firebase authentication into your SkyScan Logbook application.

## Overview

Currently, your app doesn't have user authentication. Adding auth will allow:
- User-specific logbook entries (each user sees only their own data)
- Secure data storage
- Multi-user support
- User profiles and settings

## Option 1: Supabase (Recommended)

Supabase is an open-source Firebase alternative with PostgreSQL database, authentication, and real-time features.

### Why Supabase?
- ✅ Free tier with generous limits
- ✅ PostgreSQL database (great for structured logbook data)
- ✅ Built-in authentication (email, OAuth, magic links)
- ✅ Row Level Security (RLS) for data isolation
- ✅ Real-time subscriptions
- ✅ Storage for images
- ✅ Easy to integrate with Express backend

### Architecture Changes Needed

#### Frontend Changes:
1. **Install Supabase client**:
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Create auth context/provider**:
   - Create `contexts/AuthContext.tsx` for auth state management
   - Wrap app with `<AuthProvider>`
   - Add login/signup/logout components

3. **Update App.tsx**:
   - Add auth check on mount
   - Show login screen if not authenticated
   - Pass user ID to API calls

4. **Protect routes**:
   - Add auth guards to dashboard and other protected routes
   - Redirect to login if not authenticated

#### Backend Changes:
1. **Add Supabase middleware**:
   - Verify JWT tokens from Supabase
   - Extract user ID from token
   - Add user context to requests

2. **Update API endpoints**:
   - Add user ID to all database operations
   - Filter queries by user ID
   - Validate user owns the data they're accessing

3. **Database schema**:
   - Add `user_id` column to all tables
   - Create indexes on `user_id`
   - Set up Row Level Security policies

### Database Schema Example

```sql
-- Users table (handled by Supabase Auth)
-- Supabase automatically creates auth.users

-- Logbook entries table
CREATE TABLE logbook_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id TEXT,
  date DATE,
  aircraft_id TEXT,
  aircraft_type TEXT,
  total_time DECIMAL(4,1),
  -- ... other fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Scans table
CREATE TABLE scans (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  images TEXT[], -- or use Supabase Storage
  mode TEXT,
  status TEXT,
  timestamp BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security policies
ALTER TABLE logbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own entries
CREATE POLICY "Users can view own entries"
  ON logbook_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON logbook_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Similar policies for scans table
```

### Integration Steps

1. **Create Supabase project**:
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Note your project URL and anon key

2. **Frontend setup**:
   ```typescript
   // lib/supabase.ts
   import { createClient } from '@supabase/supabase-js'
   
   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
   const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
   
   export const supabase = createClient(supabaseUrl, supabaseAnonKey)
   ```

3. **Backend setup**:
   ```typescript
   // server/middleware/auth.ts
   import { createClient } from '@supabase/supabase-js'
   
   const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for backend
   )
   
   export const verifyAuth = async (req, res, next) => {
     const token = req.headers.authorization?.replace('Bearer ', '')
     if (!token) {
       return res.status(401).json({ error: 'Unauthorized' })
     }
     
     const { data: { user }, error } = await supabase.auth.getUser(token)
     if (error || !user) {
       return res.status(401).json({ error: 'Invalid token' })
     }
     
     req.user = user
     next()
   }
   ```

4. **Update API endpoints**:
   ```typescript
   // server/index.ts
   import { verifyAuth } from './middleware/auth'
   
   app.post('/api/extract-single', verifyAuth, async (req, res) => {
     const userId = req.user.id
     // ... existing code, but save with userId
   })
   ```

### Environment Variables

**Frontend (.env)**:
```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Backend (.env)**:
```
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Option 2: Firebase

Firebase is Google's platform with authentication, Firestore database, and cloud functions.

### Why Firebase?
- ✅ Google-backed, very reliable
- ✅ Excellent free tier
- ✅ Firestore (NoSQL) for flexible data
- ✅ Firebase Auth (email, OAuth, phone)
- ✅ Cloud Storage for images
- ✅ Real-time database
- ✅ Cloud Functions for serverless backend

### Architecture Changes Needed

#### Frontend Changes:
1. **Install Firebase SDK**:
   ```bash
   npm install firebase
   ```

2. **Initialize Firebase**:
   ```typescript
   // lib/firebase.ts
   import { initializeApp } from 'firebase/app'
   import { getAuth } from 'firebase/auth'
   import { getFirestore } from 'firebase/firestore'
   
   const firebaseConfig = {
     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
     // ...
   }
   
   const app = initializeApp(firebaseConfig)
   export const auth = getAuth(app)
   export const db = getFirestore(app)
   ```

3. **Auth context**:
   - Similar to Supabase setup
   - Use Firebase Auth hooks
   - Manage auth state

#### Backend Changes:
1. **Verify Firebase tokens**:
   ```typescript
   // server/middleware/auth.ts
   import admin from 'firebase-admin'
   
   admin.initializeApp({
     credential: admin.credential.cert(serviceAccount)
   })
   
   export const verifyAuth = async (req, res, next) => {
     const token = req.headers.authorization?.replace('Bearer ', '')
     if (!token) {
       return res.status(401).json({ error: 'Unauthorized' })
     }
     
     try {
       const decodedToken = await admin.auth().verifyIdToken(token)
       req.user = decodedToken
       next()
     } catch (error) {
       res.status(401).json({ error: 'Invalid token' })
     }
   }
   ```

2. **Firestore structure**:
   ```
   users/{userId}/
     logbookEntries/{entryId}
     scans/{scanId}
   ```

### Integration Steps

1. **Create Firebase project**:
   - Go to [firebase.google.com](https://firebase.google.com)
   - Create new project
   - Enable Authentication (Email/Password, Google, etc.)
   - Create Firestore database
   - Download service account key

2. **Frontend setup**:
   - Add Firebase config to environment variables
   - Initialize Firebase client
   - Set up auth context

3. **Backend setup**:
   - Install `firebase-admin`
   - Initialize with service account
   - Add auth middleware
   - Update endpoints to use user ID

---

## Comparison: Supabase vs Firebase

| Feature | Supabase | Firebase |
|---------|----------|----------|
| **Database** | PostgreSQL (SQL) | Firestore (NoSQL) |
| **Auth** | Built-in, very flexible | Built-in, Google-backed |
| **Real-time** | PostgreSQL subscriptions | Firestore listeners |
| **Storage** | S3-compatible | Cloud Storage |
| **Pricing** | Generous free tier | Generous free tier |
| **Learning Curve** | SQL knowledge helpful | NoSQL/document model |
| **Backend Integration** | Easy with Express | Easy with Express |
| **Best For** | Structured data, SQL queries | Flexible schemas, rapid dev |

---

## Recommended Approach for Your App

### Supabase (Recommended)

**Why?**
- Your logbook data is highly structured (perfect for SQL)
- You'll want to query entries by date, aircraft, etc. (SQL is great for this)
- Row Level Security makes multi-user easy
- Can store images in Supabase Storage
- Free tier is very generous

**Implementation Plan:**
1. Create Supabase project
2. Set up database schema with RLS
3. Add auth to frontend (login/signup screens)
4. Add auth middleware to backend
5. Update all API endpoints to include user_id
6. Update frontend to send auth tokens
7. Add user profile/settings page

### Firebase (Alternative)

**Why?**
- If you prefer NoSQL/document model
- If you want Google's infrastructure
- If you plan to use other Firebase services (Analytics, etc.)

---

## Data Migration Strategy

When adding auth, you'll need to handle existing data:

1. **If starting fresh**: No migration needed
2. **If you have existing data**:
   - Create a migration script
   - Assign existing entries to a default user
   - Or prompt users to claim their data on first login

---

## Security Considerations

### Supabase:
- Use Row Level Security (RLS) policies
- Never expose service role key to frontend
- Validate user ownership on backend
- Use Supabase Storage for images (not base64 in database)

### Firebase:
- Use Firestore security rules
- Validate user ownership in rules
- Use Firebase Storage for images
- Never expose service account to frontend

---

## Example User Flow

1. **User visits app** → Check if authenticated
2. **Not authenticated** → Show login/signup screen
3. **User signs up/logs in** → Get JWT token
4. **Store token** → In localStorage or httpOnly cookie
5. **Make API calls** → Include token in Authorization header
6. **Backend verifies** → Extract user ID from token
7. **Query database** → Filter by user_id automatically (RLS/Security Rules)
8. **Return data** → Only user's own entries

---

## Next Steps (When Ready to Implement)

1. **Choose platform** (Supabase recommended)
2. **Set up project** on chosen platform
3. **Design database schema** with user_id
4. **Create auth UI** (login/signup components)
5. **Add auth middleware** to backend
6. **Update API endpoints** to use user context
7. **Test thoroughly** with multiple users
8. **Deploy and monitor**

---

## Resources

### Supabase:
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase React Guide](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Firebase:
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

## Questions to Consider

Before implementing, decide:
1. **Do you need multi-user support?** (If yes, auth is essential)
2. **Should data be private per user?** (If yes, need RLS/security rules)
3. **Do you want social login?** (OAuth with Google, GitHub, etc.)
4. **Do you need user profiles?** (Name, settings, preferences)
5. **Should images be stored in database or separate storage?** (Recommend separate storage)

Once you're ready to implement, I can help you with the specific code changes needed!
