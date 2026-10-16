// Minimal, dependency-free static file server for the `expo export --platform web` output
// (dist/) -- serves any matching file as-is and falls back to index.html for everything else,
// which is required for a client-side-routed SPA (Expo Router/React Navigation) to handle deep
// links like /operator or /:beachSlug correctly instead of 404ing.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 8080;
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const MIME = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (!err) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(indexHtml);
      }
    });
  })
  .listen(PORT, '0.0.0.0', () => console.log(`serving ${ROOT} on 0.0.0.0:${PORT}`));
