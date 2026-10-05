import { formatBytes, formatRate } from '../../lib/sync.js';
import { IconFilm, IconSwap } from './icons.jsx';

const SHORTCUTS = [
  ['Space', 'Play / pause'],
  ['← →', 'Back / forward 10s'],
  ['↑ ↓', 'Volume'],
  ['M', 'Mute'],
  ['F', 'Fullscreen'],
];

export default function SessionInfo({ sync, canControl, onChangeMovie }) {
  const src = sync.source;
  return (
    <section className="session card" aria-label="Now watching">
      <div className="session__label">Now watching</div>
      {src ? (
        <>
          <div className="session__title">
            <IconFilm size={16} />
            <span title={src.title}>{src.title || 'Untitled'}</span>
          </div>
          <div className="session__meta">
            {src.kind === 'file' ? `Local file · ${formatBytes(src.size)}` : 'Video link'}
            {sync.rate !== 1 && ` · ${formatRate(sync.rate)}`}
          </div>
        </>
      ) : (
        <div className="session__meta">Nothing yet — pick a movie in the player.</div>
      )}
      <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={onChangeMovie} disabled={!canControl}>
        <IconSwap size={15} /> {src ? 'Change movie' : 'Choose a movie'}
      </button>
      <div className="session__shortcuts">
        <div className="session__label">Shortcuts</div>
        <ul>
          {SHORTCUTS.map(([k, d]) => (
            <li key={k}>
              <span className="kbd">{k}</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
