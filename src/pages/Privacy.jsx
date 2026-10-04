import React from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="page" id="privacy-page">
      <div className="legal-container animate-fade-in-up">
        <div className="legal-header">
          <Link to="/" className="legal-back-link">← Back to Streamly</Link>
          <span className="section-eyebrow">LEGAL & PRIVACY</span>
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last Updated: October 4, 2026</p>
        </div>

        <div className="legal-card">
          <section className="legal-section">
            <h2>1. Our Privacy First Guarantee</h2>
            <p>
              Streamly is engineered from the ground up as a <strong>100% Peer-to-Peer (P2P)</strong> streaming service.
              When you use Streamly to stream videos from your smartphone to your laptop, your video files are transmitted
              directly between your two devices via encrypted WebRTC data channels.
            </p>
            <div className="legal-highlight-box">
              <strong>Key Fact:</strong> Your movie files never touch, pass through, or get stored on any cloud servers or third-party databases.
            </div>
          </section>

          <section className="legal-section">
            <h2>2. Information We Do Not Collect</h2>
            <p>We believe the best way to protect your privacy is not to collect your data in the first place:</p>
            <ul>
              <li><strong>No Video Content:</strong> We never capture, view, copy, or store your videos.</li>
              <li><strong>No Account Credentials:</strong> You do not need to register, log in, or provide personal details to use Streamly.</li>
              <li><strong>No Tracking Profiles:</strong> We do not track your browsing history or build behavioral advertising profiles.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Information Used Locally</h2>
            <p>
              Streamly utilizes modern web browser capabilities for device pairing and session management:
            </p>
            <ul>
              <li>
                <strong>Temporary WebRTC Signaling:</strong> A transient 6-digit PIN is generated to establish the initial peer-to-peer handshake between your devices. Once connected, signaling is terminated.
              </li>
              <li>
                <strong>Browser LocalStorage:</strong> We store minimal configuration (e.g. cookie consent choice, session PIN) purely inside your browser. This data never leaves your device.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Security & Encryption</h2>
            <p>
              All WebRTC peer-to-peer data channels use standard <strong>DTLS (Datagram Transport Layer Security)</strong> and
              <strong>SRTP (Secure Real-time Transport Protocol)</strong> end-to-end encryption. Only your paired laptop can decrypt
              and render the video stream transmitted from your phone.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Contact Us</h2>
            <p>
              If you have any questions or feedback regarding this Privacy Policy, please contact our privacy team directly:
            </p>
            <p>
              Email:{' '}
              <a href="mailto:privacy@streamly.app" className="legal-email-link">
                privacy@streamly.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
