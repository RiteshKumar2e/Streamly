import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function DeviceSelector() {
  const navigate = useNavigate();

  return (
    <div className="device-cards animate-fade-in-up">
      <div
        className="device-card"
        id="select-phone"
        onClick={() => navigate('/phone')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/phone')}
      >
        <div className="device-card-badge">Sender & Remote</div>
        <div className="device-card-content">
          <div className="device-card-icon-wrapper">
            <span className="device-card-icon">📱</span>
          </div>
          <h3>Connect Phone</h3>
          <p>Pick a video from your gallery and stream it instantly to your computer.</p>
          <ul className="device-card-features">
            <li>✓ Pick any movie (.mp4, .mkv, .mov)</li>
            <li>✓ Full remote control on your phone</li>
            <li>✓ Zero uploads to cloud servers</li>
          </ul>
          <div className="device-card-action">
            <span>Start Streaming</span>
            <span className="device-card-arrow">→</span>
          </div>
        </div>
      </div>

      <div
        className="device-card"
        id="select-laptop"
        onClick={() => navigate('/laptop')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/laptop')}
      >
        <div className="device-card-badge device-badge-alt">Display & Audio</div>
        <div className="device-card-content">
          <div className="device-card-icon-wrapper">
            <span className="device-card-icon">💻</span>
          </div>
          <h3>Connect Laptop</h3>
          <p>Pair in seconds via 6-digit code or QR code and enjoy theater-mode playback.</p>
          <ul className="device-card-features">
            <li>✓ Fullscreen cinematic player</li>
            <li>✓ Direct high-bitrate WebRTC stream</li>
            <li>✓ Controlled directly from your couch</li>
          </ul>
          <div className="device-card-action">
            <span>Open Player</span>
            <span className="device-card-arrow">→</span>
          </div>
        </div>
      </div>
    </div>
  );
}
