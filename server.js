const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3784);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const DB_FILE = path.join(DATA_DIR, 'listings.json');

fs.mkdirSync(PHOTOS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]\n');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif'
};

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return []; }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2) + '\n');
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function bodyJSON(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 25 * 1024 * 1024) reject(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function slugify(s) {
  return String(s || 'listing').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'listing';
}
function sanitizeListing(input, old = {}) {
  const marketKeys = ['kijiji', 'facebook', 'karrot', 'craigslist'];
  const markets = {};
  for (const key of marketKeys) {
    markets[key] = {
      status: input.markets?.[key]?.status || old.markets?.[key]?.status || 'not-posted',
      url: input.markets?.[key]?.url ?? old.markets?.[key]?.url ?? '',
      title: input.markets?.[key]?.title ?? old.markets?.[key]?.title ?? '',
      description: input.markets?.[key]?.description ?? old.markets?.[key]?.description ?? '',
      price: input.markets?.[key]?.price ?? old.markets?.[key]?.price ?? '',
      category: input.markets?.[key]?.category ?? old.markets?.[key]?.category ?? '',
      location: input.markets?.[key]?.location ?? old.markets?.[key]?.location ?? ''
    };
  }
  return {
    id: old.id || crypto.randomUUID(),
    title: String(input.title ?? old.title ?? '').trim(),
    price: String(input.price ?? old.price ?? '').trim(),
    condition: String(input.condition ?? old.condition ?? '').trim(),
    category: String(input.category ?? old.category ?? '').trim(),
    location: String(input.location ?? old.location ?? '').trim(),
    description: String(input.description ?? old.description ?? '').trim(),
    tags: Array.isArray(input.tags) ? input.tags.map(String).map(s => s.trim()).filter(Boolean).slice(0, 10) : (old.tags || []),
    photos: Array.isArray(old.photos) ? old.photos : [],
    markets,
    createdAt: old.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return json(res, 404, { error: 'Not found' });
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(u.pathname);

    if (pathname === '/api/listings' && req.method === 'GET') {
      return json(res, 200, readDB());
    }
    if (pathname === '/api/listings' && req.method === 'POST') {
      const db = readDB();
      const listing = sanitizeListing(await bodyJSON(req));
      if (!listing.title) return json(res, 400, { error: 'Title is required' });
      db.unshift(listing); writeDB(db); return json(res, 201, listing);
    }

    const m = pathname.match(/^\/api\/listings\/([a-f0-9-]+)$/i);
    if (m && req.method === 'GET') {
      const listing = readDB().find(x => x.id === m[1]);
      return listing ? json(res, 200, listing) : json(res, 404, { error: 'Listing not found' });
    }
    if (m && req.method === 'PUT') {
      const db = readDB(); const i = db.findIndex(x => x.id === m[1]);
      if (i < 0) return json(res, 404, { error: 'Listing not found' });
      db[i] = sanitizeListing(await bodyJSON(req), db[i]); writeDB(db); return json(res, 200, db[i]);
    }
    if (m && req.method === 'DELETE') {
      const db = readDB(); const i = db.findIndex(x => x.id === m[1]);
      if (i < 0) return json(res, 404, { error: 'Listing not found' });
      const [removed] = db.splice(i, 1); writeDB(db);
      for (const p of removed.photos || []) {
        const f = path.join(PHOTOS_DIR, path.basename(p.file));
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      return json(res, 200, { ok: true });
    }

    const pm = pathname.match(/^\/api\/listings\/([a-f0-9-]+)\/photos$/i);
    if (pm && req.method === 'POST') {
      const db = readDB(); const i = db.findIndex(x => x.id === pm[1]);
      if (i < 0) return json(res, 404, { error: 'Listing not found' });
      const body = await bodyJSON(req);
      const match = String(body.dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
      if (!match) return json(res, 400, { error: 'Only JPEG, PNG, WEBP and GIF photos are supported' });
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[match[1]];
      const filename = `${slugify(db[i].title)}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(PHOTOS_DIR, filename), Buffer.from(match[2], 'base64'));
      const photo = { file: filename, name: String(body.name || filename), url: `/photos/${filename}` };
      db[i].photos.push(photo); db[i].updatedAt = new Date().toISOString(); writeDB(db);
      return json(res, 201, photo);
    }

    const pd = pathname.match(/^\/api\/listings\/([a-f0-9-]+)\/photos\/([^/]+)$/i);
    if (pd && req.method === 'DELETE') {
      const db = readDB(); const i = db.findIndex(x => x.id === pd[1]);
      if (i < 0) return json(res, 404, { error: 'Listing not found' });
      const filename = path.basename(pd[2]);
      db[i].photos = (db[i].photos || []).filter(p => p.file !== filename);
      writeDB(db);
      const f = path.join(PHOTOS_DIR, filename); if (fs.existsSync(f)) fs.unlinkSync(f);
      return json(res, 200, { ok: true });
    }

    if (pathname.startsWith('/photos/')) {
      const f = path.join(PHOTOS_DIR, path.basename(pathname));
      return serveFile(res, f);
    }

    let file = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
    if (!file.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Forbidden' });
    return serveFile(res, file);
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`MarketCross Assistant running at http://${HOST}:${PORT}`);
  console.log('Press Ctrl+C to stop. Data stays in ./data/.');
});
