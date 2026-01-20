
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

// Error boundary for mount errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #f8fafc; background: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <h1 style="color: #ef4444; margin-bottom: 10px;">Error Loading Application</h1>
        <p style="color: #94a3b8; margin-bottom: 20px;">${event.error?.message || 'An error occurred while loading the application.'}</p>
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
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Failed to mount React app:', error);
  rootElement.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #f8fafc; background: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
      <h1 style="color: #ef4444; margin-bottom: 10px;">Failed to Load Application</h1>
      <p style="color: #94a3b8; margin-bottom: 20px;">${error instanceof Error ? error.message : 'An error occurred while mounting the React application.'}</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Reload Page</button>
    </div>
  `;
}
