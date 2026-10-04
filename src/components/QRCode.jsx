import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRCode({ value, size = 180 }) {
  if (!value) return null;

  return (
    <div className="qr-container" id="qr-code">
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#0a0a0f"
        style={{ display: 'block' }}
      />
    </div>
  );
}
