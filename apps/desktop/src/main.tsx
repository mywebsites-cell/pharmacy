import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Global error handlers to catch uncaught errors and promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('[Global Error Handler] Uncaught error:', event.error?.message || String(event.error));
    console.error('[Global Error Handler] Stack:', event.error?.stack || 'N/A');
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Global Error Handler] Unhandled promise rejection:', event.reason?.message || String(event.reason));
    console.error('[Global Error Handler] Stack:', event.reason?.stack || 'N/A');
  });

  // Log when app starts
  console.log('[Medicly Desktop] App initializing...');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
