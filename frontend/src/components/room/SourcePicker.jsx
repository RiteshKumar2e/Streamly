import { useRef, useState } from 'react';
import { formatBytes, titleFromUrl } from '../../lib/sync.js';
import { IconAlert, IconFilm, IconLink, IconUpload, IconX } from './icons.jsx';

function validUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Shown inside the stage when there is no movie yet (or when "Change movie" is pressed). */
export default function SourcePicker({ onLoadUrl, onChooseFile, onCancel, disabled }) {
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);
  const fileRef = useRef(null);
  const trimmed = url.trim();
  const ok = validUrl(trimmed);

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!ok || disabled) return;
    onLoadUrl(trimmed, titleFromUrl(trimmed));
    setUrl('');
    setTouched(false);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onChooseFile(file);
  };

  return (
    <div className="stage-panel" role="dialog" aria-label="Choose what to watch">
      <div className="stage-panel__card">
        {onCancel && (
          <button type="button" className="stage-panel__close" onClick={onCancel} aria-label="Close">
            <IconX size={18} />
          </button>
        )}
        <div className="stage-panel__head">
          <span className="stage-panel__icon">
            <IconFilm size={22} />
          </span>
          <div>
            <h2>Pick something to watch</h2>
            <p>Whatever you choose loads for both of you.</p>
          </div>
        </div>

        <form className="source-option" onSubmit={submit}>
          <label className="source-option__label" htmlFor="source-url">
            <IconLink size={16} /> Paste a YouTube or video link
          </label>
          <div className="source-option__row">
            <input
              id="source-url"
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://youtube.com/watch?v=… or https://…/movie.mp4"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && trimmed && !ok ? 'true' : undefined}
            />
            <button type="submit" className="btn btn-primary" disabled={!ok || disabled}>
              Load for both
            </button>
          </div>
          {touched && trimmed && !ok ? (
            <p className="source-option__error">Enter a full http(s) link — a YouTube video or an .mp4 / .webm file.</p>
          ) : (
            <p className="source-option__hint">
              Works with YouTube videos and direct MP4 / WebM links (not Netflix or Prime pages).
            </p>
          )}
        </form>

        <div className="source-divider">
          <span>or</span>
        </div>

        <div className="source-option">
          <span className="source-option__label">
            <IconUpload size={16} /> Use a file from my device
          </span>
          <p className="source-option__hint">
            Nothing is uploaded. You both pick the same movie file and Streamly keeps playback in sync.
          </p>
          <input ref={fileRef} type="file" accept="video/*,.mkv,.mp4,.webm,.mov,.m4v" hidden onChange={onFile} />
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
          >
            <IconUpload size={16} /> Choose a video file
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown when the room's source is a local file that this person hasn't selected yet. */
export function FilePrompt({ source, sourceBy, onProvideFile, onChangeMovie }) {
  const fileRef = useRef(null);
  const who = sourceBy && sourceBy !== 'You' ? sourceBy : 'Your friend';
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onProvideFile(file);
  };
  return (
    <div className="stage-panel" role="dialog" aria-label="Select the movie file">
      <div className="stage-panel__card">
        <div className="stage-panel__head">
          <span className="stage-panel__icon">
            <IconUpload size={22} />
          </span>
          <div>
            <h2>Select the same file</h2>
            <p>
              {who} chose <strong>“{source.name}”</strong> ({formatBytes(source.size)}). Select the same file on your
              device to start watching together.
            </p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="video/*,.mkv,.mp4,.webm,.mov,.m4v" hidden onChange={onFile} />
        <button type="button" className="btn btn-primary btn-block" onClick={() => fileRef.current?.click()}>
          <IconUpload size={16} /> Select “{source.name}”
        </button>
        <button type="button" className="btn btn-ghost btn-block stage-panel__secondary" onClick={onChangeMovie}>
          Choose a different movie instead
        </button>
      </div>
    </div>
  );
}

export function MismatchBanner({ source, file, onProvideFile, onDismiss }) {
  const fileRef = useRef(null);
  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onProvideFile(f);
  };
  return (
    <div className="stage-banner" role="alert">
      <IconAlert size={16} />
      <span className="stage-banner__text">
        Your file (“{file.name}”, {formatBytes(file.size)}) doesn’t match the room’s (“{source.name}”,{' '}
        {formatBytes(source.size)}). Playback may not line up.
      </span>
      <input ref={fileRef} type="file" accept="video/*,.mkv,.mp4,.webm,.mov,.m4v" hidden onChange={onFile} />
      <button type="button" className="stage-banner__btn" onClick={() => fileRef.current?.click()}>
        Pick another
      </button>
      {onDismiss && (
        <button type="button" className="stage-banner__close" onClick={onDismiss} aria-label="Dismiss warning">
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}
