
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyTheme, getSavedTheme } from './utils/theme';

// Inizializza il tema immediatamente all'avvio dell'applicazione per evitare FOUC
// e garantire che la pagina di Login abbia i colori corretti.
const savedTheme = getSavedTheme();
applyTheme(savedTheme.primary, savedTheme.bg);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
