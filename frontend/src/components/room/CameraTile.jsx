import { useEffect, useRef, useState } from 'react';
import { initials } from './utils.js';
import { IconCam, IconCamOff, IconMic, IconMicOff, IconMute, IconVolume, IconVolumeLow } from './icons.jsx';

/**
 * Camera tile. variant="self": muted + mirrored preview with cam/mic toggles.
 * variant="remote": plays the friend's audio through this <video>, with a local volume slider.
 */
export default function CameraTile({
  variant = 'self',
  name,
  stream,
  cam,
  mic,
  mediaSupported = true,
  camPending = false,
  micPending = false,
  onToggleCam,
  onToggleMic,
  notice,
  connectionState,
  empty,
}) {
  const isSelf = variant === 'self';
  const videoRef = useRef(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [volume, setVolume] = useState(1);
  const [hasLiveVideo, setHasLiveVideo] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream || null;
    setHasLiveVideo(!!stream && stream.getVideoTracks().length > 0);
    if (!stream) return;
    const p = v.play();
    if (p?.catch) {
      p.then(() => setNeedsGesture(false)).catch((err) => {
        if (!isSelf && err?.name === 'NotAllowedError') setNeedsGesture(true);
      });
    }
  }, [stream, isSelf]);

  useEffect(() => {
    const v = videoRef.current;
    if (v && !isSelf) v.volume = volume;
  }, [volume, isSelf]);

  // Detach on unmount.
  useEffect(() => {
    const v = videoRef.current;
    return () => {
      if (v) v.srcObject = null;
    };
  }, []);

  const enableAudio = () => {
    videoRef.current
      ?.play()
      .then(() => setNeedsGesture(false))
      .catch(() => {});
  };

  const showVideo = !empty && !!stream && hasLiveVideo && cam !== false && (isSelf ? !!cam : true);
  const displayName = isSelf ? `${name || 'You'} (you)` : name || 'Friend';
  const connecting = !isSelf && !empty && connectionState && !['connected', 'idle'].includes(connectionState);

  return (
    <section className={`cam-tile card ${isSelf ? 'cam-tile--self' : 'cam-tile--remote'}`} aria-label={displayName}>
      <div className="cam-tile__media">
        <video
          ref={videoRef}
          className={`cam-tile__video ${isSelf ? 'is-mirrored' : ''} ${showVideo ? '' : 'is-hidden'}`}
          autoPlay
          playsInline
          muted={isSelf}
        />
        {empty ? (
          <div className="cam-tile__empty">{empty}</div>
        ) : (
          !showVideo && (
            <div className="cam-tile__avatar">
              <span>{initials(name)}</span>
            </div>
          )
        )}
        {!empty && !isSelf && mic === false && (
          <span className="cam-tile__chip cam-tile__chip--mic" title={`${name || 'Friend'} is muted`}>
            <IconMicOff size={14} />
          </span>
        )}
        {connecting && (
          <span className="cam-tile__chip cam-tile__chip--status">
            <span className="spinner cam-tile__spinner" /> Connecting video…
          </span>
        )}
        {needsGesture && (
          <button type="button" className="cam-tile__gesture" onClick={enableAudio}>
            <IconVolume size={16} /> Tap to hear {name || 'your friend'}
          </button>
        )}
      </div>

      <div className="cam-tile__bar">
        <div className="cam-tile__name">
          <span className="cam-tile__name-text">{empty ? 'Your friend' : displayName}</span>
          {!empty && mic === false && <IconMicOff size={14} className="cam-tile__name-icon" />}
        </div>
        {isSelf ? (
          <div className="cam-tile__actions">
            <button
              type="button"
              className={`tile-btn ${mic ? '' : 'is-off'}`}
              onClick={onToggleMic}
              disabled={!mediaSupported || micPending}
              aria-pressed={!!mic}
              aria-label={mic ? 'Turn microphone off' : 'Turn microphone on'}
              title={!mediaSupported ? 'Microphone unavailable' : mic ? 'Turn microphone off' : 'Turn microphone on'}
            >
              {micPending ? <span className="spinner tile-btn__spinner" /> : mic ? <IconMic size={16} /> : <IconMicOff size={16} />}
            </button>
            <button
              type="button"
              className={`tile-btn ${cam ? '' : 'is-off'}`}
              onClick={onToggleCam}
              disabled={!mediaSupported || camPending}
              aria-pressed={!!cam}
              aria-label={cam ? 'Turn camera off' : 'Turn camera on'}
              title={!mediaSupported ? 'Camera unavailable' : cam ? 'Turn camera off' : 'Turn camera on'}
            >
              {camPending ? <span className="spinner tile-btn__spinner" /> : cam ? <IconCam size={16} /> : <IconCamOff size={16} />}
            </button>
          </div>
        ) : (
          !empty && (
            <div className="cam-tile__volume" title={`${name || 'Friend'}'s voice volume`}>
              <button
                type="button"
                className="tile-btn tile-btn--plain"
                onClick={() => setVolume((v) => (v > 0 ? 0 : 1))}
                aria-label={volume > 0 ? 'Mute friend' : 'Unmute friend'}
              >
                {volume === 0 ? <IconMute size={16} /> : volume < 0.5 ? <IconVolumeLow size={16} /> : <IconVolume size={16} />}
              </button>
              <input
                type="range"
                className="range range--light"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Friend's voice volume"
                style={{ '--fill': `${volume * 100}%` }}
              />
            </div>
          )
        )}
      </div>
      {notice && <div className="cam-tile__notice">{notice}</div>}
    </section>
  );
}
