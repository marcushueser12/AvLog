import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';
import { AuthProvider } from './contexts/AuthContext';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
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
