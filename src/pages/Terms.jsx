import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="page" id="terms-page">
      <div className="legal-container animate-fade-in-up">
        <div className="legal-header">
          <Link to="/" className="legal-back-link">← Back to Streamly</Link>
          <span className="section-eyebrow">TERMS OF SERVICE</span>
          <h1>Terms & Conditions</h1>
          <p className="legal-updated">Last Updated: October 4, 2026</p>
        </div>

        <div className="legal-card">
          <section className="legal-section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using Streamly ("the Service"), you agree to be bound by these Terms and Conditions.
              If you do not agree to all terms, please refrain from using the application.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Description of Service</h2>
            <p>
              Streamly provides a serverless web software interface facilitating direct peer-to-peer (P2P) multimedia file
              transfer and playback between user-controlled devices on local and internet networks via WebRTC protocols.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. User Responsibilities & Content Ownership</h2>
            <p>
              You acknowledge and agree that:
            </p>
            <ul>
              <li>You are solely responsible for all video files and media streamed through your devices.</li>
              <li>You must possess all necessary legal rights, licenses, or personal ownership for any content you transmit.</li>
              <li>You shall not use Streamly to violate intellectual property rights, copyrights, or applicable local laws.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Disclaimer of Warranties</h2>
            <p>
              The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied.
              Because transfer speed depends on user hardware, Wi-Fi signal, and local network topology, Streamly does not guarantee uninterrupted or error-free video transmission.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Streamly and its contributors shall not be liable for any indirect,
              incidental, consequential, or punitive damages arising from your access to or use of the application.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Contact & Legal Inquiries</h2>
            <p>
              For legal questions, copyright inquiries, or support, please reach out to:
            </p>
            <p>
              Email:{' '}
              <a href="mailto:legal@streamly.app" className="legal-email-link">
                legal@streamly.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
