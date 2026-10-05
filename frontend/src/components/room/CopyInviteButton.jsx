import { useEffect, useRef, useState } from 'react';
import { copyText, inviteUrl } from './utils.js';
import { IconCheck, IconLink } from './icons.jsx';

export default function CopyInviteButton({ roomId, className = 'btn btn-secondary btn-sm', label = 'Copy invite link' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyText(inviteUrl(roomId));
    if (!ok) {
      window.prompt('Copy this invite link:', inviteUrl(roomId));
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button type="button" className={className} onClick={onClick} aria-live="polite">
      {copied ? <IconCheck size={16} /> : <IconLink size={16} />}
      <span>{copied ? 'Link copied' : label}</span>
    </button>
  );
}
