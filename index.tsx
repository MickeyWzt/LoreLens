import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import i18n from './i18n';
import './index.css';

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm(i18n.t('pwa.updatePrompt'))) {
      updateSW(true);
    }
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Suspense fallback={<div className="flex w-full h-screen items-center justify-center bg-black text-white">LoreLens</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);
