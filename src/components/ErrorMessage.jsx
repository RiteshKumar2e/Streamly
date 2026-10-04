import React from 'react';

export default function ErrorMessage({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div className="error-banner" id="error-message" role="alert">
      <span className="error-banner-icon">⚠️</span>
      <span>{message}</span>
      {onDismiss && (
        <span
          className="error-banner-dismiss"
          onClick={onDismiss}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onDismiss()}
        >
          ✕
        </span>
      )}
    </div>
  );
}
