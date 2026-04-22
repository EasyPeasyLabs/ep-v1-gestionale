import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log("EP Gestionale: App booting...");

const container = document.getElementById('root');
if (!container) {
  console.error("EP Gestionale: Root container not found!");
} else {
  console.log("EP Gestionale: Root container found, rendering...");
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
