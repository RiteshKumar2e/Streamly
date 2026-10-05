import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Global styles must load BEFORE component CSS so component rules can override base classes (.btn etc).
import './styles/global.css';
import App from './App.jsx';

// No StrictMode: its dev-only double mount opens and immediately closes the room socket,
// which logs a noisy "WebSocket is closed before the connection is established" warning.
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </BrowserRouter>
);
