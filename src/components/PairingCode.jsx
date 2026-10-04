import React, { useState } from 'react';

export default function PairingCode({ code, label = 'Pairing Code' }) {
  const [copied, setCopied] = useState(false);

  const cleanCode = code ? code.replace(/\s/g, '') : '';
  const digits = cleanCode.split('');

  const handleCopy = async () => {
    if (!cleanCode) return;
    try {
      await navigator.clipboard.writeText(cleanCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="pairing-code-card">
      <div className="pairing-code-header">
        <span className="pairing-code-label">{label}</span>
        {cleanCode && cleanCode !== '------' && (
          <button
            type="button"
            className={`pairing-copy-pill ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title="Copy pairing code"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        )}
      </div>

      <div className="pairing-digits-container" onClick={handleCopy} role="button" tabIndex={0} title="Click to copy code">
        {digits.length > 0 ? (
          digits.map((digit, i) => (
            <React.Fragment key={i}>
              {i === 3 && <span className="digit-separator">—</span>}
              <span className="digit-box">{digit}</span>
            </React.Fragment>
          ))
        ) : (
          <span className="pairing-code">{code}</span>
        )}
      </div>
      <div className="pairing-code-hint">Enter this 6-digit PIN on your laptop</div>
    </div>
  );
}
