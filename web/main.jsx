import React from 'react';
import { createRoot } from 'react-dom/client';
import KaeroApp from '../kaero-v51.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <KaeroApp />
  </React.StrictMode>
);
