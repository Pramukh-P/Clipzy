import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';

import Navbar from './components/Navbar';
import WakeUpLoader from './components/WakeUpLoader';
import Home from './pages/Home';
import YouTube from './pages/YouTube';
import Instagram from './pages/Instagram';
import { useWakeUp } from './hooks/useWakeUp';

import './App.css';

function AppContent() {
  const { status, attempt, maxAttempts, retry } = useWakeUp();

  if (status === 'checking' || status === 'waking') {
    return (
      <WakeUpLoader
        attempt={attempt}
        maxAttempts={maxAttempts}
        failed={false}
      />
    );
  }

  if (status === 'failed') {
    return (
      <WakeUpLoader
        attempt={attempt}
        maxAttempts={maxAttempts}
        failed={true}
        onRetry={retry}
      />
    );
  }

  return (
    <Router>
      <div className="app">
        <Navbar />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/youtube" element={<YouTube />} />
            <Route path="/instagram" element={<Instagram />} />
          </Routes>
        </AnimatePresence>
        <footer className="footer">
          <p>
            Made with ❤️ by <strong>Clipzy</strong> · For personal use only · Respect copyright
          </p>
        </footer>
      </div>
    </Router>
  );
}

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1a2e',
            color: '#e2e8f0',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#34d399', secondary: '#0a0a1a' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#0a0a1a' },
          },
        }}
      />
      <AppContent />
    </>
  );
}

export default App;
