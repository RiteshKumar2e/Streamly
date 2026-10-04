import React from 'react';
import { formatBytes } from '../services/transfer.js';

export default function ProgressBar({ progress, label = 'Transferring...' }) {
  if (!progress) return null;

  const percent = progress.percent || 0;
  const sent = progress.bytesSent || progress.receivedBytes || 0;
  const total = progress.totalBytes || 0;

  return (
    <div className="transfer-section" id="transfer-progress">
      <div style={{ width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: 8 }}>
          {label}
        </div>
        <div className="transfer-progress-bar">
          <div
            className="transfer-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <div className="transfer-stats">
        <span>{formatBytes(sent)} / {formatBytes(total)}</span>
        <span>{percent}%</span>
      </div>
    </div>
  );
}
