import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Automatically ensure the admin portal uses 'localhost' instead of '127.0.0.1' so Firebase Auth OAuth succeeds
if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
  window.location.replace(window.location.href.replace('//127.0.0.1:', '//localhost:'));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
