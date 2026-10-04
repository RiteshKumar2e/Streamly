import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms & Conditions — Streamly',
  description: 'Terms and Conditions of using Streamly peer-to-peer streaming.',
};

export default function TermsPage() {
  return (
    <div className="page" id="terms-page">
      <div className="legal-container animate-fade-in-up">
        <div className="legal-header">
          <Link href="/" className="legal-back-link">← Back to Streamly</Link>
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
            <h2>6. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of Streamly following any updates constitutes acceptance of the modified Terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
