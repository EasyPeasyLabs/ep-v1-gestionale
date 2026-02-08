
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
// import './index.css'; // Removed to prevent 404 errors, styles are now in index.html
import { applyTheme, getSavedTheme } from './utils/theme';

// Inizializza il tema immediatamente all'avvio dell'applicazione.
try {
  const savedTheme = getSavedTheme();
  applyTheme(savedTheme.primary, savedTheme.bg);
} catch (e: any) {
  console.error("Theme Init Error: " + e.message);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Hide visual boot monitor if present
setTimeout(() => {
    const monitor = document.getElementById('boot-monitor');
    if (monitor) monitor.style.display = 'none';
}, 500);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
