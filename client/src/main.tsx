import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import App from './App';
import './index.css';

import { ThemeProvider } from '@/components/ThemeProvider';

// One-time reset: purge all legacy client storage (auth tokens + UI prefs).
// Guarded by a version flag so it only runs once per browser.
const STORAGE_RESET_KEY = 'mm_storage_reset_v1';
if (!localStorage.getItem(STORAGE_RESET_KEY)) {
  localStorage.clear();
  localStorage.setItem(STORAGE_RESET_KEY, '1');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>,
);
