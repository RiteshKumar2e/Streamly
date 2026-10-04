'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DeviceSelector from '../src/components/DeviceSelector.jsx';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="page" id="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-pill-badge">
            <span className="pill-dot" />
            <span>Direct WebRTC Peer-to-Peer Streaming</span>
            <span className="pill-divider">•</span>
            <span className="pill-highlight">Zero Cloud Uploads</span>
          </div>

          <h1>
            Your phone. Your movie.{' '}
            <span className="text-gradient">Your big screen.</span>
          </h1>

          <p className="hero-subtext">
            Stream high-definition movies directly from your phone's gallery to your laptop
            in full original quality without waiting for slow cloud uploads or creating accounts.
          </p>

          <div className="hero-buttons">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => router.push('/phone')}
              id="hero-phone-btn"
            >
              <span className="btn-icon-prefix" aria-hidden="true">📱</span>
              <span>Connect Phone (Sender)</span>
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => router.push('/laptop')}
              id="hero-laptop-btn"
            >
              <span className="btn-icon-prefix" aria-hidden="true">💻</span>
              <span>Connect Laptop (Screen)</span>
            </button>
          </div>

          <div className="hero-trust-strip">
            <div className="trust-item">
              <span className="trust-icon" aria-hidden="true">🔒</span>
              <span>End-to-End Encrypted</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon" aria-hidden="true">⚡</span>
              <span>No Cloud Buffering</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon" aria-hidden="true">📶</span>
              <span>Local Wi-Fi Optimized</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon" aria-hidden="true">✨</span>
              <span>Original Lossless Quality</span>
            </div>
          </div>
        </div>

        {/* Device Cards Section */}
        <div className="devices-section">
          <div className="section-header">
            <span className="section-eyebrow">CHOOSE YOUR DEVICE</span>
            <h2>How would you like to start?</h2>
          </div>
          <DeviceSelector />
        </div>

        {/* Feature Highlights Grid */}
        <div className="features-section">
          <div className="section-header">
            <span className="section-eyebrow">BUILT FOR SPEED & PRIVACY</span>
            <h2>Why stream with Streamly?</h2>
            <p className="section-subtitle">
              Traditional cloud uploads take forever and compress your videos. Streamly streams directly device-to-device.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <span className="feature-icon" aria-hidden="true">🛡️</span>
              </div>
              <h3>100% Private & P2P</h3>
              <p>
                Your movies never touch any 3rd party servers. Transmission happens directly over an encrypted WebRTC data channel.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <span className="feature-icon" aria-hidden="true">⚡</span>
              </div>
              <h3>Zero Cloud Upload Delay</h3>
              <p>
                Don't waste gigabytes of cellular data or wait 30 minutes for cloud drives to sync. Start streaming instantly.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <span className="feature-icon" aria-hidden="true">🎮</span>
              </div>
              <h3>Phone Remote Control</h3>
              <p>
                Control playback, scrub timelines, skip 10 seconds, and adjust volume straight from your smartphone couch seat.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <span className="feature-icon" aria-hidden="true">📺</span>
              </div>
              <h3>Cinematic Theater Mode</h3>
              <p>
                Enjoy high-bitrate Full HD and 4K playback with responsive keyboard controls, fullscreen mode, and pristine audio.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="how-it-works">
          <div className="section-header">
            <span className="section-eyebrow">SIMPLE 4-STEP SETUP</span>
            <h2>How It Works</h2>
            <p className="section-subtitle">
              Ready to watch in under 30 seconds. No apps or sign-up needed.
            </p>
          </div>

          <div className="steps">
            <div className="step-card">
              <div className="step-badge">Step 1</div>
              <div className="step-icon-circle" aria-hidden="true">💻</div>
              <h3>Open Laptop Screen</h3>
              <p>Open Streamly on your laptop or TV screen. A pairing QR code will appear.</p>
            </div>

            <div className="step-card">
              <div className="step-badge">Step 2</div>
              <div className="step-icon-circle" aria-hidden="true">📱</div>
              <h3>Scan with Phone</h3>
              <p>Scan the QR code with your phone camera. Devices connect automatically with zero PIN entry.</p>
            </div>

            <div className="step-card">
              <div className="step-badge">Step 3</div>
              <div className="step-icon-circle" aria-hidden="true">🎬</div>
              <h3>Pick a Movie</h3>
              <p>Select any video file directly from your phone gallery without file size restrictions.</p>
            </div>

            <div className="step-card">
              <div className="step-badge">Step 4</div>
              <div className="step-icon-circle" aria-hidden="true">🍿</div>
              <h3>Watch on Big Screen</h3>
              <p>Stream directly to your laptop's screen while your phone functions as the smart remote.</p>
            </div>
          </div>
        </div>

        {/* Professional Footer */}
        <footer className="footer">
          <div className="footer-content">
            <div className="footer-brand">
              <img src="/streamly.svg" alt="Streamly Logo" className="footer-logo" width="26" height="26" />
              <span className="footer-title">Streamly</span>
              <span className="footer-desc">— Direct WebRTC Peer-to-Peer Video Streaming</span>
            </div>
            <div className="footer-links">
              <Link href="/privacy" className="footer-link">Privacy Policy</Link>
              <span className="footer-dot" aria-hidden="true">•</span>
              <Link href="/terms" className="footer-link">Terms & Conditions</Link>
              <span className="footer-dot" aria-hidden="true">•</span>
              <a href="mailto:support@streamly.app" className="footer-link clickable-email">
                support@streamly.app
              </a>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
