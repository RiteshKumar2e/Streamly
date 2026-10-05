import { useCallback, useEffect, useRef, useState } from 'react';
import useVideoState from '../../hooks/useVideoState.js';
import PlayerControls from './PlayerControls.jsx';
import SourcePicker, { FilePrompt, MismatchBanner } from './SourcePicker.jsx';
import YouTubeFrame from './YouTubeFrame.jsx';
import { IconAlert, IconFilm, IconPlay, IconSwap } from './icons.jsx';
import { isYouTubeUrl } from '../../lib/youtube.js';

const IDLE_MS = 2600;

export default function VideoStage({
  stageRef,
  videoRef,
  sync,
  canControl,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  volume,
  muted,
  onVolume,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
}) {
  const ytUrl = sync.src && isYouTubeUrl(sync.src) ? sync.src : null;
  const vstate = useVideoState(videoRef, sync.src);
  const [awake, setAwake] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mismatchDismissed, setMismatchDismissed] = useState(false);
  const idleTimer = useRef(null);
  const clickTimer = useRef(null);
  const pointerType = useRef('mouse');

  // Load / unload the media imperatively so a removed source truly unloads.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || ytUrl || !(v instanceof HTMLMediaElement)) return; // YouTube loads itself
    if (sync.src) {
      if (v.getAttribute('src') !== sync.src) {
        v.setAttribute('src', sync.src);
        v.load();
      }
    } else if (v.getAttribute('src')) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  }, [sync.src, ytUrl, videoRef]);

  useEffect(() => setMismatchDismissed(false), [sync.localFile]);

  const wake = useCallback(() => {
    setAwake(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setAwake(false), IDLE_MS);
  }, []);
  useEffect(() => () => {
    clearTimeout(idleTimer.current);
    clearTimeout(clickTimer.current);
  }, []);

  const hasSource = !!sync.source;
  const showPicker = !hasSource || pickerOpen;
  const showFilePrompt = !showPicker && sync.needsFile;
  const showError = !showPicker && !showFilePrompt && !!vstate.error;
  const playable = hasSource && !!sync.src && !showPicker;
  const isPlaying = sync.playing && !sync.autoplayBlocked;
  const idle = playable && isPlaying && !awake && !menuOpen;

  const onSurfacePointerUp = (e) => {
    pointerType.current = e.pointerType || 'mouse';
  };
  const onSurfaceClick = () => {
    if (!playable) return;
    if (pointerType.current === 'touch') {
      // On touch, a tap reveals / hides the controls instead of toggling playback.
      if (awake) setAwake(false);
      else wake();
      return;
    }
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => sync.togglePlay(), 220);
  };
  const onSurfaceDoubleClick = () => {
    clearTimeout(clickTimer.current);
    onToggleFullscreen();
  };

  return (
    <div
      ref={stageRef}
      className={`stage ${idle ? 'is-idle' : ''} ${showPicker || showFilePrompt ? 'has-panel' : ''} ${
        isFullscreen ? 'is-fullscreen' : ''
      }`}
      onPointerMove={wake}
      onPointerDown={wake}
      onMouseLeave={() => isPlaying && setAwake(false)}
    >
      {ytUrl ? (
        <YouTubeFrame
          key={ytUrl}
          url={ytUrl}
          mediaRef={videoRef}
          onLoadedMetadata={sync.onLoadedMetadata}
          onPlaying={sync.onPlaying}
          onEnded={sync.onEnded}
        />
      ) : (
        <video
          ref={videoRef}
          className="stage__video"
          playsInline
          preload="auto"
          onLoadedMetadata={sync.onLoadedMetadata}
          onPlaying={sync.onPlaying}
          onEnded={sync.onEnded}
        />
      )}

      {playable && (
        <div
          className="stage__surface"
          onPointerUp={onSurfacePointerUp}
          onClick={onSurfaceClick}
          onDoubleClick={onSurfaceDoubleClick}
          aria-hidden="true"
        />
      )}

      {hasSource && !showPicker && (
        <div className="stage__top">
          <div className="stage__title" title={sync.source.title}>
            <IconFilm size={15} />
            <span>{sync.source.title || 'Untitled'}</span>
          </div>
          <button type="button" className="stage__change" onClick={onOpenPicker} disabled={!canControl}>
            <IconSwap size={15} />
            <span>Change movie</span>
          </button>
        </div>
      )}

      {playable && sync.playing && vstate.waiting && !vstate.error && !sync.autoplayBlocked && (
        <div className="stage__spinner" aria-label="Buffering">
          <span className="stage__spinner-ring" />
        </div>
      )}

      {playable && sync.autoplayBlocked && (
        <button type="button" className="stage__autoplay" onClick={sync.resumePlayback}>
          <span className="stage__autoplay-icon">
            <IconPlay size={30} />
          </span>
          <span className="stage__autoplay-text">Click to join playback</span>
          <span className="stage__autoplay-sub">Your browser blocked autoplay — your friend is already watching.</span>
        </button>
      )}

      {sync.fileMismatch && !showPicker && !mismatchDismissed && (
        <MismatchBanner
          source={sync.source}
          file={sync.localFile.file}
          onProvideFile={sync.provideFile}
          onDismiss={() => setMismatchDismissed(true)}
        />
      )}

      {sync.activity && (
        <div key={sync.activity.id} className="stage__toast" role="status">
          {sync.activity.text}
        </div>
      )}

      {showPicker && (
        <SourcePicker
          disabled={!canControl}
          onLoadUrl={(url, title) => {
            sync.loadUrl(url, title);
            onClosePicker();
          }}
          onChooseFile={(file) => {
            sync.chooseFile(file);
            onClosePicker();
          }}
          onCancel={hasSource ? onClosePicker : null}
        />
      )}

      {showFilePrompt && (
        <FilePrompt
          source={sync.source}
          sourceBy={sync.sourceBy}
          onProvideFile={sync.provideFile}
          onChangeMovie={onOpenPicker}
        />
      )}

      {showError && (
        <div className="stage-panel">
          <div className="stage-panel__card stage-panel__card--compact">
            <div className="stage-panel__head">
              <span className="stage-panel__icon stage-panel__icon--danger">
                <IconAlert size={22} />
              </span>
              <div>
                <h2>Can’t play this video</h2>
                <p>{vstate.error}</p>
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={onOpenPicker}>
              Choose another movie
            </button>
          </div>
        </div>
      )}

      {playable && !showError && (
        <div className="stage__controls">
          <PlayerControls
            vstate={vstate}
            sync={sync}
            disabled={!canControl}
            volume={volume}
            muted={muted}
            onVolume={onVolume}
            onToggleMute={onToggleMute}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            onMenuChange={setMenuOpen}
          />
        </div>
      )}
    </div>
  );
}
