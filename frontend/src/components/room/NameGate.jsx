import { useState } from 'react';
import Logo from '../ui/Logo.jsx';

export default function NameGate({ roomId, initialName = '', onSubmit }) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  const submit = (e) => {
    e.preventDefault();
    if (trimmed) onSubmit(trimmed.slice(0, 32));
  };

  return (
    <div className="room-gate">
      <div className="room-gate__logo">
        <Logo />
      </div>
      <form className="card room-gate__card" onSubmit={submit}>
        <span className="badge room-gate__badge">Room {roomId}</span>
        <h1>What should we call you?</h1>
        <p className="muted">Your friend will see this name next to your camera and in the chat.</p>
        <label className="label" htmlFor="streamly-name">
          Your name
        </label>
        <input
          id="streamly-name"
          className="input"
          autoFocus
          autoComplete="nickname"
          maxLength={32}
          placeholder="e.g. Riya"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-lg btn-block room-gate__submit" disabled={!trimmed}>
          Join the watch party
        </button>
        <p className="room-gate__hint">We’ll ask for camera &amp; microphone access next. You can turn them off anytime.</p>
      </form>
    </div>
  );
}
