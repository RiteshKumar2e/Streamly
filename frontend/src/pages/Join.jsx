import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/ui/Navbar.jsx';
import Footer from '../components/ui/Footer.jsx';
import { getRoom, normalizeRoomId } from '../lib/api.js';
import { usePageMeta } from '../lib/site.js';

const NAME_KEY = 'streamly:name';

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export default function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => normalizeRoomId(params.get('code')));
  const [name, setName] = useState(readName);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  usePageMeta({
    title: 'Join a watch party',
    description: 'Enter the 6-character room code your friend shared to join their Streamly watch party.',
    path: '/join',
  });

  async function handleSubmit(e) {
    e.preventDefault();
    const id = normalizeRoomId(code);
    if (id.length !== 6) {
      setError('Room codes are 6 characters long.');
      return;
    }
    const trimmed = name.trim().slice(0, 32);
    try {
      if (trimmed) localStorage.setItem(NAME_KEY, trimmed);
    } catch {
      /* storage unavailable */
    }

    setChecking(true);
    setError('');
    try {
      const info = await getRoom(id);
      if (info?.full) {
        setError('That room already has two people in it.');
        setChecking(false);
        return;
      }
    } catch {
      // Backend check failed — still try; the room page handles connection errors.
    }
    navigate(`/room/${id}`);
  }

  return (
    <div className="page">
      <Navbar />
      <main className="page-center">
        <div className="card page-card">
          <h1>Join a watch party</h1>
          <p className="muted">Enter the 6-character code your friend shared with you.</p>
          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="join-code" className="label">Room code</label>
              <input
                id="join-code"
                className="input input-code"
                placeholder="ABC123"
                value={code}
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
                autoFocus={!code}
                aria-invalid={error ? 'true' : undefined}
                onChange={(e) => {
                  setCode(normalizeRoomId(e.target.value));
                  setError('');
                }}
              />
            </div>
            <div>
              <label htmlFor="join-name" className="label">Your name</label>
              <input
                id="join-name"
                className="input"
                placeholder="e.g. Sam"
                value={name}
                maxLength={32}
                autoComplete="nickname"
                autoFocus={!!code}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={checking}>
              {checking && <span className="spinner" />}
              {checking ? 'Checking…' : 'Join room'}
            </button>
            <p className="muted" style={{ margin: 0, fontSize: 14, textAlign: 'center' }}>
              No code? <Link to="/#start">Create a new room</Link>
            </p>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
