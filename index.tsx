import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';
import { AuthProvider } from './contexts/AuthContext';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
// Force Clerk to load its script from a working CDN (avoids custom domain proxy failures)
const CLERK_JS_URL =
  import.meta.env.VITE_CLERK_JS_URL ||
  'https://unpkg.com/@clerk/clerk-js@5/dist/clerk.browser.js';
// When your Clerk instance uses a custom domain (e.g. clerk.logextract.co) that isn't reachable:
// 1) Set VITE_CLERK_FAPI_URL in your *frontend* build env (Vercel/Railway) to your default Clerk URL, then redeploy.
// 2) Or set the fallback below to your default Clerk Frontend API URL (Dashboard → Configure → Domains), then redeploy.
//    Example: 'https://pleasant-dog-12.clerk.accounts.dev' (replace with your instance slug).
const CLERK_FAPI_FALLBACK_IN_CODE: string | undefined = undefined;
const CLERK_FAPI_URL =
  import.meta.env.VITE_CLERK_FAPI_URL || CLERK_FAPI_FALLBACK_IN_CODE || undefined;

// Error boundary for mount errors - sanitize error messages to prevent XSS
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    // Sanitize error message to prevent XSS
    const errorMessage = event.error?.message || 'An error occurred while loading the application.';
    const sanitizedMessage = errorMessage
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #f8fafc; background: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <h1 style="color: #ef4444; margin-bottom: 10px;">Error Loading Application</h1>
        <p style="color: #94a3b8; margin-bottom: 20px;">${sanitizedMessage}</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Reload Page</button>
      </div>
    `;
  }
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  const app = (
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
  root.render(
    PUBLISHABLE_KEY ? (
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        clerkJSUrl={CLERK_JS_URL}
        proxyUrl={CLERK_FAPI_URL || undefined}
        afterSignOutUrl="/"
      >
        {app}
      </ClerkProvider>
    ) : (
      app
    )
  );
} catch (error) {
  console.error('Failed to mount React app:', error);
  // Sanitize error message to prevent XSS
  const errorMessage = error instanceof Error ? error.message : 'An error occurred while mounting the React application.';
  const sanitizedMessage = errorMessage
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  rootElement.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #f8fafc; background: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
      <h1 style="color: #ef4444; margin-bottom: 10px;">Failed to Load Application</h1>
      <p style="color: #94a3b8; margin-bottom: 20px;">${sanitizedMessage}</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Reload Page</button>
    </div>
  `;
}
