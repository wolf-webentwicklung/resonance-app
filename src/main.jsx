import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Capture beforeinstallprompt before React renders — event fires once at page load
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
});

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(App)
);
