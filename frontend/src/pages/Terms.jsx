import { Link } from 'react-router-dom';
import LegalPage from './LegalPage.jsx';
import { CONTACT_EMAIL, usePageMeta } from '../lib/site.js';

export default function Terms() {
  usePageMeta({
    title: 'Terms of Service',
    description: 'The rules for using Streamly watch parties: fair use, content you have the right to watch, and our limits.',
    path: '/terms',
  });

  return (
    <LegalPage
      title="Terms of Service"
      updated="5 October 2026"
      intro="By using Streamly you agree to these terms. They are short, so please read them."
    >
      <h2>1. The service</h2>
      <p>
        Streamly lets two people watch a video together in sync, with a video call and chat. It is free, needs no
        account, and is provided as is. We may change, pause or stop the service at any time.
      </p>

      <h2>2. Content you watch</h2>
      <ul>
        <li>
          Only watch content you have the right to watch. You are responsible for the files and links you load and for
          following copyright law and the terms of the sites you stream from (for example YouTube’s Terms of Service).
        </li>
        <li>Streamly does not host, upload, copy or distribute any movies or videos.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>harass, threaten or share illegal or sexually explicit content involving minors;</li>
        <li>record or share another person’s video or audio without their consent;</li>
        <li>spam, overload, scrape, probe or attack the service or try to get around its limits;</li>
        <li>use Streamly if you are under 13.</li>
      </ul>
      <p>We may block access that breaks these rules.</p>

      <h2>4. Privacy</h2>
      <p>
        How we handle data is explained in our <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>5. No warranty</h2>
      <p>
        Streamly is provided “as is” without warranties of any kind. Sync quality, video calls and availability depend
        on your network, your browser and third-party services, and may not always work.
      </p>

      <h2>6. Limitation of liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, or for content that users
        choose to watch or share.
      </p>

      <h2>7. Changes</h2>
      <p>We may update these terms. The date above shows the latest version; continuing to use Streamly means you accept it.</p>

      <h2>8. Contact</h2>
      <p>
        Questions or reports: <a href={`mailto:${CONTACT_EMAIL}?subject=Terms%20question`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
