import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './index.css';

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a prompt to user if there's a new version
    if (confirm('New content available. Reload?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Suspense fallback={<div className="flex w-full h-screen items-center justify-center bg-black text-white">Loading...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);