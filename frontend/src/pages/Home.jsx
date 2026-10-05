import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/ui/Navbar.jsx';
import Footer from '../components/ui/Footer.jsx';
import { createRoom, normalizeRoomId } from '../lib/api.js';
import './Home.css';

const NAME_KEY = 'streamly:name';

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

function saveName(name) {
  try {
    if (name) localStorage.setItem(NAME_KEY, name);
  } catch {
    /* storage unavailable */
  }
}

const Icon = {
  sync: (
    <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M18 2v4h-4M6 22v-4h4" />
  ),
  video: (
    <>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l6-3v10l-6-3" />
    </>
  ),
  controls: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M10 8l6 4-6 4z" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  film: (
    <>
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5M2 12h20" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  volume: (
    <>
      <path d="M11 5L6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </>
  ),
};

function Svg({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {Icon[name]}
    </svg>
  );
}

const STEPS = [
  {
    title: 'Create a room',
    body: 'Enter your name and get a private room with a short 6-character code. No sign-up, no downloads.',
  },
  {
    title: 'Invite one person',
    body: 'Share the link or the code. Rooms hold exactly two people, so it stays personal.',
  },
  {
    title: 'Press play together',
    body: 'Load a video URL or pick the same local file. Play, pause and seek stay in sync for both of you.',
  },
];

const FEATURES = [
  {
    icon: 'sync',
    title: 'Real-time sync',
    body: 'Server-timed playback keeps both screens within a fraction of a second, with automatic drift correction.',
  },
  {
    icon: 'video',
    title: 'Face-to-face video',
    body: 'The movie sits in the middle with each camera beside it, so you can see every reaction as it happens.',
  },
  {
    icon: 'controls',
    title: 'Shared controls',
    body: 'Either person can play, pause, seek or change speed. Volume stays personal to each of you.',
  },
  {
    icon: 'lock',
    title: 'Private P2P video calls',
    body: 'Camera and mic stream directly between browsers over WebRTC. Nothing is recorded or stored.',
  },
  {
    icon: 'chat',
    title: 'Built-in chat',
    body: 'Drop a quick message without talking over the dialogue. Chat history stays with the room.',
  },
  {
    icon: 'film',
    title: 'Any video URL or local file',
    body: 'Paste a direct MP4/WebM link, or both pick the same file from your computer — it never gets uploaded.',
  },
];

const FAQ = [
  {
    q: 'Do we need an account?',
    a: 'No. Type a name, create a room and share the link. That is all.',
  },
  {
    q: 'How many people can join a room?',
    a: 'Two. Streamly is built for one-on-one watch parties — partners, best friends, long-distance family.',
  },
  {
    q: 'Where does the movie come from?',
    a: 'Either a direct video URL (for example an .mp4 or .webm link) or a local file that both of you have. Local files play straight from your own device and are never uploaded.',
  },
  {
    q: 'Is the video call private?',
    a: 'Yes. Cameras and microphones connect peer-to-peer using WebRTC. Our server only helps the two browsers find each other and keeps playback in sync.',
  },
  {
    q: 'Can we each set our own volume?',
    a: 'Yes. Play, pause, seek and speed are shared, but volume and mute are personal so each of you can balance the movie and the call.',
  },
  {
    q: 'Which browsers are supported?',
    a: 'Any modern Chrome, Edge, Firefox or Safari on desktop or mobile. Allow camera and microphone access when asked — or skip it and still watch together.',
  },
];

function HeroMock() {
  return (
    <div className="mock" aria-hidden="true">
      <div className="mock-bar">
        <span className="mock-dot" />
        <span className="mock-dot" />
        <span className="mock-dot" />
        <span className="mock-url">streamly.app/room/K7Q2MX</span>
      </div>
      <div className="mock-body">
        <div className="mock-cam mock-cam-a">
          <div className="mock-avatar">A</div>
          <span className="mock-name">Alex</span>
        </div>
        <div className="mock-stage">
          <div className="mock-scene">
            <div className="mock-sun" />
            <div className="mock-hill mock-hill-1" />
            <div className="mock-hill mock-hill-2" />
          </div>
          <div className="mock-sync">
            <span className="mock-live" /> In sync
          </div>
          <div className="mock-controls">
            <span className="mock-play">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M2 1l7 4-7 4z" fill="currentColor" />
              </svg>
            </span>
            <span className="mock-time">42:17</span>
            <span className="mock-track">
              <span className="mock-progress" />
            </span>
            <span className="mock-time">1:58:03</span>
            <span className="mock-rate">1x</span>
          </div>
        </div>
        <div className="mock-cam mock-cam-b">
          <div className="mock-avatar">S</div>
          <span className="mock-name">Sam</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState(readName);
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) requestAnimationFrame(() => el.scrollIntoView());
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    const trimmed = name.trim().slice(0, 32);
    saveName(trimmed);
    setCreating(true);
    try {
      const roomId = await createRoom();
      navigate(`/room/${roomId}`);
    } catch {
      setError(
        "We couldn't reach the Streamly server. Check your connection and try again in a moment."
      );
      setCreating(false);
    }
  }

  function handleJoin(e) {
    e.preventDefault();
    const id = normalizeRoomId(code);
    if (id.length !== 6) {
      setCodeError('Room codes are 6 characters long.');
      return;
    }
    saveName(name.trim().slice(0, 32));
    navigate(`/room/${id}`);
  }

  return (
    <div className="page home">
      <Navbar />

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="badge">
                <span className="hero-badge-dot" /> Two-person watch parties
              </span>
              <h1 className="hero-title">
                Watch movies together, <span className="hero-accent">face to face.</span>
              </h1>
              <p className="hero-sub">
                Streamly puts the movie in the middle and both of your cameras on either side.
                Playback stays perfectly in sync, and either of you can pause, rewind or skip ahead.
              </p>

              <div className="hero-forms card" id="start">
                <form onSubmit={handleCreate} className="hero-create">
                  <label htmlFor="home-name" className="label">
                    Your name
                  </label>
                  <div className="hero-row">
                    <input
                      id="home-name"
                      className="input"
                      placeholder="e.g. Alex"
                      value={name}
                      maxLength={32}
                      autoComplete="nickname"
                      onChange={(e) => setName(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary btn-lg" disabled={creating}>
                      {creating ? <span className="spinner" /> : null}
                      {creating ? 'Creating…' : 'Create room'}
                    </button>
                  </div>
                </form>

                <div className="hero-divider">
                  <span>or join with a code</span>
                </div>

                <form onSubmit={handleJoin} className="hero-row">
                  <label htmlFor="home-code" className="sr-only">
                    Room code
                  </label>
                  <input
                    id="home-code"
                    className="input input-code"
                    placeholder="ABC123"
                    value={code}
                    maxLength={6}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={codeError ? 'true' : undefined}
                    onChange={(e) => {
                      setCode(normalizeRoomId(e.target.value));
                      setCodeError('');
                    }}
                  />
                  <button type="submit" className="btn btn-secondary btn-lg">
                    Join
                  </button>
                </form>

                {codeError && <p className="hero-hint hero-hint-error">{codeError}</p>}
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}
              </div>

              <ul className="hero-points">
                <li>No sign-up</li>
                <li>Private P2P video</li>
                <li>Free to use</li>
              </ul>
            </div>

            <div className="hero-visual">
              <HeroMock />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="section" id="how-it-works">
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">How it works</span>
              <h2>From link to opening scene in under a minute</h2>
              <p className="muted">Three steps. No installs, no accounts, no screen-sharing lag.</p>
            </div>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="card step">
                  <span className="step-num">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p className="muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="section section-alt" id="features">
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">Features</span>
              <h2>Everything you need for movie night apart</h2>
              <p className="muted">
                Designed for two people who want to feel like they are on the same couch.
              </p>
            </div>
            <div className="features">
              {FEATURES.map((f) => (
                <article key={f.title} className="card feature">
                  <span className="feature-icon">
                    <Svg name={f.icon} />
                  </span>
                  <h3>{f.title}</h3>
                  <p className="muted">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section" id="faq">
          <div className="container faq-wrap">
            <div className="section-head">
              <span className="section-eyebrow">FAQ</span>
              <h2>Questions, answered</h2>
            </div>
            <div className="faq">
              {FAQ.map((item) => (
                <details key={item.q} className="faq-item">
                  <summary>
                    {item.q}
                    <span className="faq-chevron" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </summary>
                  <p className="muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="section cta-section">
          <div className="container">
            <div className="cta">
              <h2>Movie night starts now.</h2>
              <p>Create a room, send the link, and press play together.</p>
              <div className="cta-actions">
                <a href="#start" className="btn btn-lg cta-primary">
                  Start a watch party <Svg name="arrow" size={18} />
                </a>
                <Link to="/join" className="btn btn-lg cta-secondary">
                  I have a code
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
