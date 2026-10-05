import { Link } from 'react-router-dom';
import LegalPage from './LegalPage.jsx';
import { CONTACT_EMAIL, usePageMeta } from '../lib/site.js';
import { openConsentSettings } from '../lib/consent.js';

export default function Privacy() {
  usePageMeta({
    title: 'Privacy Policy',
    description: 'What Streamly collects, why, and how long it is kept. No accounts, no recordings, no uploads.',
    path: '/privacy',
  });

  return (
    <LegalPage
      title="Privacy Policy"
      updated="5 October 2026"
      intro="Streamly is built to know as little about you as possible. There are no accounts, nothing is recorded, and your movie files never leave your device."
    >
      <h2>1. What we process</h2>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Why</th>
              <th>Where / how long</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Display name you type</td>
              <td>Shown to the other person in your room</td>
              <td>Your browser (localStorage) and our server’s memory while the room exists</td>
            </tr>
            <tr>
              <td>Room code, playback state (play/pause, position, speed), the video link or file name and size</td>
              <td>Keeping both screens in sync</td>
              <td>Server memory only; deleted 10 minutes after the room is empty</td>
            </tr>
            <tr>
              <td>Chat messages</td>
              <td>Delivering chat and showing recent history when someone rejoins</td>
              <td>Server memory only (last 100 per room); deleted 10 minutes after the room is empty</td>
            </tr>
            <tr>
              <td>IP address</td>
              <td>Connecting you and limiting abuse (rate limits)</td>
              <td>Held briefly in memory; not stored in a database or logs we keep</td>
            </tr>
            <tr>
              <td>Camera and microphone</td>
              <td>The video call with the other person</td>
              <td>Sent directly between the two browsers (peer-to-peer, encrypted). Never recorded or stored by us</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        We do not have a database. Everything above lives in the server’s memory and disappears when rooms expire or
        the server restarts.
      </p>

      <h2>2. Video calls</h2>
      <p>
        Camera and microphone streams use WebRTC, which encrypts media end to end between the two browsers. On some
        networks a relay (TURN) server is needed to connect; it forwards the encrypted stream and cannot see or hear
        it. You can turn your camera or mic off at any time, or deny access and still watch together.
      </p>

      <h2>3. Movies and videos</h2>
      <ul>
        <li>
          <strong>Local files</strong> play straight from your device. They are never uploaded. Only the file name and
          size are shared with the other person so they can pick the same file.
        </li>
        <li>
          <strong>Video links</strong> are loaded by each browser directly from the site that hosts them.
        </li>
        <li>
          <strong>YouTube videos</strong> play in YouTube’s embedded player. YouTube may set cookies and collect data
          under{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Google’s Privacy Policy
          </a>
          .
        </li>
      </ul>

      <h2>4. Cookies, local storage and analytics</h2>
      <p>Streamly itself sets no cookies. We keep a few small settings in your browser’s local storage:</p>
      <ul>
        <li>your display name, so you don’t have to retype it;</li>
        <li>your movie volume;</li>
        <li>your privacy choice (accept or decline analytics).</li>
      </ul>
      <p>
        If you accept, we use <strong>Vercel Web Analytics</strong> to count page views. It uses no cookies and builds
        no personal profiles; room codes are removed before anything is sent. If your browser sends “Do Not Track” or
        Global Privacy Control, analytics stays off. You can{' '}
        <button type="button" className="link-button" onClick={openConsentSettings}>
          change your choice
        </button>{' '}
        at any time.
      </p>

      <h2>5. Sharing</h2>
      <p>
        We don’t sell or share your data. Our hosting providers (Vercel for the website, Render for the server) process
        traffic on our behalf to run the service.
      </p>

      <h2>6. Children</h2>
      <p>Streamly is not meant for children under 13, and we don’t knowingly process their data.</p>

      <h2>7. Your rights</h2>
      <p>
        Because we keep no accounts and delete room data automatically, there is usually nothing stored about you to
        access or erase. You can clear your browser’s local storage to remove your settings. For any request or
        question, email us.
      </p>

      <h2>8. Changes and contact</h2>
      <p>
        If this policy changes, we’ll update the date above. Questions:{' '}
        <a href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20question`}>{CONTACT_EMAIL}</a>. See also our{' '}
        <Link to="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
