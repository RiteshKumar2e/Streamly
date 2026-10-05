import Navbar from '../components/ui/Navbar.jsx';
import Footer from '../components/ui/Footer.jsx';
import './Legal.css';

export default function LegalPage({ title, updated, intro, children }) {
  return (
    <div className="page">
      <Navbar />
      <main className="legal container">
        <header className="legal-head">
          <h1>{title}</h1>
          <p className="legal-updated">Last updated: {updated}</p>
          {intro && <p className="legal-intro">{intro}</p>}
        </header>
        <div className="legal-body">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
