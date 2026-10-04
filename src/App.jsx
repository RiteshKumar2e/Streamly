import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import CookieConsent from './components/CookieConsent.jsx';
import Home from './pages/Home.jsx';
import Phone from './pages/Phone.jsx';
import Laptop from './pages/Laptop.jsx';
import Privacy from './pages/Privacy.jsx';
import Terms from './pages/Terms.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/phone" element={<Phone />} />
          <Route path="/laptop" element={<Laptop />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <CookieConsent />
    </>
  );
}
