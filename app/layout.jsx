import './globals.css';
import Navbar from '../src/components/Navbar.jsx';
import CookieConsent from '../src/components/CookieConsent.jsx';

export const metadata = {
  title: 'Streamly — Stream Movies from Phone to Laptop Screen',
  description: 'Stream full HD/4K movies directly from your phone to your laptop screen in original quality over private WebRTC. No PIN, zero cloud uploads.',
  icons: {
    icon: '/streamly.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body>
        <Navbar />
        <main id="main-content">
          {children}
        </main>
        <CookieConsent />
      </body>
    </html>
  );
}
