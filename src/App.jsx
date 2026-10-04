import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Phone from './pages/Phone.jsx';
import Laptop from './pages/Laptop.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/phone" element={<Phone />} />
        <Route path="/laptop" element={<Laptop />} />
      </Routes>
    </>
  );
}
