import React from 'react';
import { createRoot } from 'react-dom/client';
import { Settings } from './Settings';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <Settings />
    </React.StrictMode>
  );
}
