import { Link } from 'react-router-dom';
import './Logo.css';

export default function Logo({ to = '/', size = 28, showWordmark = true }) {
  return (
    <Link to={to} className="logo" aria-label="Streamly home">
      <img src="/streamly.svg" width={size} height={size} alt="" />
      {showWordmark && <span className="logo-word">Streamly</span>}
    </Link>
  );
}
