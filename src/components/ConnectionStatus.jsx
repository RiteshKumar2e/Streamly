import React from 'react';

export default function ConnectionStatus({ state, className = '' }) {
  const getConfig = () => {
    switch (state) {
      case 'connected':
        return { icon: '✓', text: 'Connected', variant: 'success' };
      case 'connecting':
        return { icon: '⟳', text: 'Connecting...', variant: 'warning' };
      case 'pairing':
        return { icon: '🔗', text: 'Pairing...', variant: 'warning' };
      case 'transferring':
        return { icon: '↑', text: 'Transferring...', variant: 'warning' };
      case 'ready':
        return { icon: '✓', text: 'Ready to play', variant: 'success' };
      case 'playing':
        return { icon: '▶', text: 'Now playing', variant: 'success' };
      case 'disconnected':
        return { icon: '✕', text: 'Disconnected', variant: 'error' };
      case 'error':
        return { icon: '⚠', text: 'Error', variant: 'error' };
      default:
        return null;
    }
  };

  const config = getConfig();
  if (!config) return null;

  return (
    <div className={`connection-status ${config.variant} ${className}`} id="connection-status">
      <span>{config.icon}</span>
      <span>{config.text}</span>
    </div>
  );
}
