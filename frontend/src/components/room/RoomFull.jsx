import { Link } from 'react-router-dom';
import Logo from '../ui/Logo.jsx';
import { IconUsers } from './icons.jsx';

export default function RoomFull({ roomId, onRetry, title, message }) {
  return (
    <div className="room-gate">
      <div className="room-gate__logo">
        <Logo />
      </div>
      <div className="card room-gate__card room-gate__card--center">
        <div className="room-gate__icon">
          <IconUsers size={28} />
        </div>
        <h1>{title || 'This room is full'}</h1>
        <p className="muted">
          {message || (
            <>
              Room <strong>{roomId}</strong> already has two people watching. Streamly parties are just for two — start
              your own room instead, or try again if someone left.
            </>
          )}
        </p>
        <div className="room-gate__actions">
          <Link to="/" className="btn btn-primary">
            Start a new room
          </Link>
          {onRetry && (
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
