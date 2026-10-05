import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Public, indexable routes for the sitemap. Rooms are private and excluded.
const PUBLIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/join', priority: '0.6', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
];

/** Fills %SITE_URL% in index.html and emits sitemap.xml + robots.txt for VITE_SITE_URL. */
function siteMeta(siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PUBLIC_ROUTES.map(
  (r) => `  <url>
    <loc>${siteUrl}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
).join('\n')}
</urlset>
`;
  const robots = `User-agent: *
Allow: /
Disallow: /room/

Sitemap: ${siteUrl}/sitemap.xml
`;
  return {
    name: 'streamly-site-meta',
    // 'pre' so the placeholder is filled before Vite parses (and URI-decodes) attribute URLs.
    transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', siteUrl) },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/sitemap.xml') return res.setHeader('Content-Type', 'application/xml'), res.end(sitemap);
        if (req.url === '/robots.txt') return res.setHeader('Content-Type', 'text/plain'), res.end(robots);
        return next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL || 'https://streamly-psi-six.vercel.app').replace(/\/+$/, '');
  return {
    plugins: [react(), siteMeta(siteUrl)],
    server: { port: 5173 },
  };
});
