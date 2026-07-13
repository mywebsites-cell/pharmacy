import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Silently ping the backend to prevent Render cold-starts.
// This runs once when the page loads so the server is warm before the user needs it.
fetch('https://pharmacy-django-fj01.onrender.com/health/', { method: 'GET' }).catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
