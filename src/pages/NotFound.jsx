import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="page page-centered" id="not-found-page">
      <div className="not-found-card animate-fade-in-up">
        <div className="not-found-code">404</div>
        <div className="not-found-icon">🎬</div>
        <h1>Page Not Found</h1>
        <p>
          The page or stream link you are looking for doesn't exist, was moved, or has expired.
        </p>

        <div className="not-found-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/')}
            id="not-found-home-btn"
          >
            ← Back to Home
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => navigate('/phone')}
            id="not-found-phone-btn"
          >
            📱 Connect Phone
          </button>
        </div>

        <div className="not-found-help">
          Need help? Contact support at{' '}
          <a href="mailto:support@streamly.app" className="support-link">
            support@streamly.app
          </a>
        </div>
      </div>
    </div>
  );
}
