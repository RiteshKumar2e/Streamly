import Logo from '../ui/Logo.jsx';
import CopyInviteButton from './CopyInviteButton.jsx';
import { IconLogOut } from './icons.jsx';

const STATUS = {
  connecting: { label: 'Connecting…', tone: 'warning' },
  reconnecting: { label: 'Reconnecting…', tone: 'warning' },
  joined: { label: 'Connected', tone: 'success' },
  error: { label: 'Offline', tone: 'danger' },
  full: { label: 'Room full', tone: 'danger' },
};

export default function RoomHeader({ roomId, status, peerName, onLeave }) {
  const s = STATUS[status] || STATUS.connecting;
  const label = status === 'joined' && peerName ? `Connected · with ${peerName}` : s.label;
  return (
    <header className="room-header">
      <div className="room-header__left">
        <Logo size={26} />
      </div>
      <div className="room-header__center">
        <div className="room-code" title="Room code">
          <span className="room-code__label">Room</span>
          <span className="room-code__value">{roomId}</span>
        </div>
        <CopyInviteButton roomId={roomId} label="Copy invite" />
      </div>
      <div className="room-header__right">
        <span className={`badge badge-${s.tone} room-status`} role="status">
          <span className={`room-status__dot room-status__dot--${s.tone}`} />
          <span className="room-status__text">{label}</span>
        </span>
        <button type="button" className="btn btn-ghost btn-sm room-leave" onClick={onLeave}>
          <IconLogOut size={16} />
          <span>Leave</span>
        </button>
      </div>
    </header>
  );
}
