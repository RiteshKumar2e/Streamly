import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { normalizeRoomId } from '../lib/api.js';
import { usePageMeta } from '../lib/site.js';
import useRoomSocket from '../hooks/useRoomSocket.js';
import useLocalMedia from '../hooks/useLocalMedia.js';
import usePeerConnection from '../hooks/usePeerConnection.js';
import usePlaybackSync from '../hooks/usePlaybackSync.js';
import RoomHeader from '../components/room/RoomHeader.jsx';
import NameGate from '../components/room/NameGate.jsx';
import RoomFull from '../components/room/RoomFull.jsx';
import VideoStage from '../components/room/VideoStage.jsx';
import CameraTile from '../components/room/CameraTile.jsx';
import ChatPanel from '../components/room/ChatPanel.jsx';
import SessionInfo from '../components/room/SessionInfo.jsx';
import CopyInviteButton from '../components/room/CopyInviteButton.jsx';
import { isTypingTarget } from '../components/room/utils.js';
import './Room.css';

const NAME_KEY = 'streamly:name';
const VOLUME_KEY = 'streamly:volume';

function readStorage(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export default function Room() {
  const { roomId: rawId } = useParams();
  const roomId = normalizeRoomId(rawId);
  const [name, setName] = useState(() => readStorage(NAME_KEY).trim());

  usePageMeta({
    title: roomId ? `Room ${roomId}` : 'Room',
    description: 'You have been invited to a Streamly watch party. Join to watch together, face to face.',
    path: '/room',
    noindex: true,
  });

  if (!roomId) {
    return <RoomFull title="That room link looks broken" message="Check the invite link, or start a new room." />;
  }

  if (!name) {
    return (
      <NameGate
        roomId={roomId}
        onSubmit={(n) => {
          writeStorage(NAME_KEY, n);
          setName(n);
        }}
      />
    );
  }

  return <RoomSession key={roomId} roomId={roomId} name={name} />;
}

function RoomSession({ roomId, name }) {
  const navigate = useNavigate();
  const room = useRoomSocket(roomId, name);
  const media = useLocalMedia();
  const rtc = usePeerConnection({
    socket: room.socket,
    peer: room.peer,
    localStream: media.stream,
    mediaReady: media.ready,
  });

  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const sync = usePlaybackSync({
    socket: room.socket,
    joinInfo: room.joinInfo,
    serverNow: room.serverNow,
    videoRef,
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolumeState] = useState(() => {
    const v = parseFloat(readStorage(VOLUME_KEY));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  });
  const [muted, setMuted] = useState(false);
  const canControl = room.status === 'joined';

  // Local-only movie volume.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted, sync.src]); // re-apply when the player changes (e.g. <video> ↔ YouTube)

  const setVolume = useCallback((v) => {
    const next = Math.min(1, Math.max(0, Math.round(v * 100) / 100));
    setVolumeState(next);
    setMuted(next === 0);
    writeStorage(VOLUME_KEY, String(next));
  }, []);
  const toggleMute = useCallback(() => {
    if (muted) {
      if (volume === 0) setVolumeState(0.5);
      setMuted(false);
    } else {
      setMuted(true);
    }
  }, [muted, volume]);

  // Tell the other person whether our cam / mic are on (after every (re)join, and on change).
  useEffect(() => {
    if (room.status !== 'joined' || !room.socket?.connected || !media.ready) return;
    room.socket.emit('media:status', { cam: !!media.cam, mic: !!media.mic });
  }, [room.status, room.socket, room.joinInfo, media.ready, media.cam, media.mic]);

  // Fullscreen for the stage.
  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(!!el && el === stageRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
      return;
    }
    if (stage?.requestFullscreen) stage.requestFullscreen().catch(() => {});
    else if (stage?.webkitRequestFullscreen) stage.webkitRequestFullscreen();
    else videoRef.current?.webkitEnterFullscreen?.(); // iOS Safari
  }, []);

  // Keyboard shortcuts (ignored while typing).
  const keyHandlers = useRef({});
  keyHandlers.current = { sync, volume, muted, setVolume, toggleMute, toggleFullscreen, canControl };
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const h = keyHandlers.current;
      const hasMovie = !!h.sync.source && !!h.sync.src;
      switch (e.key) {
        case ' ':
        case 'Spacebar':
          if (e.target?.tagName === 'BUTTON') return; // let buttons handle their own activation
          if (!hasMovie || !h.canControl) return;
          e.preventDefault();
          h.sync.togglePlay();
          break;
        case 'ArrowLeft':
          if (!hasMovie || !h.canControl) return;
          e.preventDefault();
          h.sync.seekBy(-10);
          break;
        case 'ArrowRight':
          if (!hasMovie || !h.canControl) return;
          e.preventDefault();
          h.sync.seekBy(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          h.setVolume((h.muted ? 0 : h.volume) + 0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          h.setVolume((h.muted ? 0 : h.volume) - 0.05);
          break;
        case 'm':
        case 'M':
          h.toggleMute();
          break;
        case 'f':
        case 'F':
          if (!hasMovie) return;
          h.toggleFullscreen();
          break;
        default:
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const leave = () => navigate('/');

  if (room.status === 'full') {
    return <RoomFull roomId={roomId} onRetry={room.retry} />;
  }

  const peer = room.peer;
  const mediaNotice =
    media.error === 'denied'
      ? 'Camera & mic are blocked. You can still watch and chat — allow access in your browser settings and reload to be seen.'
      : media.error === 'unavailable' || media.error === 'unsupported'
        ? 'No camera or microphone found. You can still watch and chat.'
        : media.error === 'no-camera'
          ? 'No camera available — your friend will only hear you.'
          : media.error === 'no-mic'
            ? 'No microphone available — your friend will only see you.'
            : null;

  return (
    <div className="room">
      <RoomHeader roomId={roomId} status={room.status} peerName={peer?.name} onLeave={leave} />

      {room.status === 'error' && (
        <div className="room-alert alert alert-danger" role="alert">
          {room.error === 'RATE_LIMITED'
            ? 'Too many attempts in a short time. Wait a minute, then try again.'
            : `Couldn’t join the room (${room.error}).`}{' '}
          <button type="button" className="room-alert__btn" onClick={room.retry}>
            Try again
          </button>
        </div>
      )}

      <main className="room-main">
        <div className="room-area room-area--stage">
          <VideoStage
            stageRef={stageRef}
            videoRef={videoRef}
            sync={sync}
            canControl={canControl}
            pickerOpen={pickerOpen}
            onOpenPicker={() => setPickerOpen(true)}
            onClosePicker={() => setPickerOpen(false)}
            volume={volume}
            muted={muted}
            onVolume={setVolume}
            onToggleMute={toggleMute}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        </div>

        <div className="room-area room-area--self">
          <CameraTile
            variant="self"
            name={name}
            stream={media.stream}
            cam={media.cam}
            mic={media.mic}
            hasCamTrack={media.hasCamTrack}
            hasMicTrack={media.hasMicTrack}
            onToggleCam={media.toggleCam}
            onToggleMic={media.toggleMic}
            notice={mediaNotice}
          />
        </div>

        <div className="room-area room-area--peer">
          <CameraTile
            variant="remote"
            name={peer?.name}
            stream={peer ? rtc.remoteStream : null}
            cam={peer ? peer.cam !== false : false}
            mic={peer ? peer.mic !== false : true}
            connectionState={rtc.connectionState}
            empty={
              peer ? null : (
                <div className="waiting">
                  <div className="waiting__pulse" />
                  <p className="waiting__title">Waiting for your friend…</p>
                  <p className="waiting__sub">Send them the invite link to join room {roomId}.</p>
                  <CopyInviteButton roomId={roomId} className="btn btn-primary btn-sm" />
                </div>
              )
            }
          />
        </div>

        <div className="room-area room-area--info">
          <SessionInfo sync={sync} canControl={canControl} onChangeMovie={() => setPickerOpen(true)} />
        </div>

        <div className="room-area room-area--chat">
          <ChatPanel
            messages={room.messages}
            isOwnMessage={room.isOwnMessage}
            onSend={room.sendChat}
            notice={room.chatNotice}
            disabled={!canControl}
            peerName={peer?.name}
          />
        </div>
      </main>
    </div>
  );
}
