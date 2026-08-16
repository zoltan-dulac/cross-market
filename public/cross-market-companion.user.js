// ==UserScript==
// @name        CrossMarket Companion
// @namespace   https://github.com/zoltan-dulac/cross-market
// @version     0.3.2
// @description User-triggered CrossMarket tools for marketplace forms, automatic published-ad URL capture, and importing the current Google Photos image into a local listing.
// @match       https://www.kijiji.ca/*
// @match       https://kijiji.ca/*
// @match       https://www.facebook.com/marketplace/*
// @match       https://facebook.com/marketplace/*
// @match       https://ca.karrotmarket.com/*
// @match       https://www.karrotmarket.com/*
// @match       https://karrotmarket.com/*
// @match       https://*.craigslist.org/*
// @match       https://photos.google.com/*
// @grant       GM.xmlHttpRequest
// @grant       GM.setClipboard
// @grant       GM.registerMenuCommand
// @run-at      document-idle
// ==/UserScript==

(() => {
  'use strict';

  const BASE = 'http://127.0.0.1:3784';
  const market = detectMarket();
  if (!market) return;

  const MARKET_NAMES = {
    kijiji: 'Kijiji',
    facebook: 'Facebook Marketplace',
    karrot: 'Karrot',
    craigslist: 'Craigslist',
    googlephotos: 'Google Photos'
  };

  let indexData = null;
  let selected = null;
  let panel = null;
  let trigger = null;
  let status = null;
  let captureInFlight = false;
  let lastObservedHref = location.href;

  const FIELD_RULES = {
    title: {
      words: ['title', 'item title', 'listing title', 'posting title', 'what are you selling', 'item name', 'headline'],
      selector: 'input:not([type]), input[type="text"], textarea, [contenteditable="true"], [role="textbox"]'
    },
    price: {
      words: ['price', 'asking price', 'amount'],
      selector: 'input:not([type]), input[type="text"], input[type="number"], input[inputmode="decimal"], input[inputmode="numeric"], [contenteditable="true"], [role="textbox"]'
    },
    description: {
      words: ['description', 'item description', 'listing description', 'posting body', 'describe your item', 'describe what you are selling', 'details'],
      selector: 'textarea, [contenteditable="true"], [role="textbox"]'
    },
    location: {
      words: ['location', 'city', 'item location'],
      selector: 'input:not([type]), input[type="text"], [contenteditable="true"], [role="textbox"]'
    }
  };

  function detectMarket() {
    const h = location.hostname.toLowerCase();
    if (h === 'kijiji.ca' || h.endsWith('.kijiji.ca')) return 'kijiji';
    if (h === 'facebook.com' || h.endsWith('.facebook.com')) return location.pathname.startsWith('/marketplace/') ? 'facebook' : null;
    if (h === 'karrotmarket.com' || h.endsWith('.karrotmarket.com')) return 'karrot';
    if (h === 'craigslist.org' || h.endsWith('.craigslist.org')) return 'craigslist';
    if (h === 'photos.google.com') return 'googlephotos';
    return null;
  }

  function requestJSON(url) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: 'GET',
        url,
        timeout: 4000,
        headers: { Accept: 'application/json' },
        onload: response => {
          if (response.status < 200 || response.status >= 300) return reject(new Error(`CrossMarket returned HTTP ${response.status}`));
          try { resolve(JSON.parse(response.responseText)); }
          catch { reject(new Error('CrossMarket returned invalid JSON')); }
        },
        onerror: () => reject(new Error('Cannot connect to CrossMarket')),
        ontimeout: () => reject(new Error('CrossMarket did not respond'))
      });
    });
  }

  function postJSON(url, method, data, timeout = 4000) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method,
        url,
        timeout,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        data: JSON.stringify(data),
        onload: response => {
          if (response.status < 200 || response.status >= 300) return reject(new Error(`CrossMarket returned HTTP ${response.status}`));
          try { resolve(JSON.parse(response.responseText)); }
          catch { reject(new Error('CrossMarket returned invalid JSON')); }
        },
        onerror: () => reject(new Error('Cannot connect to CrossMarket')),
        ontimeout: () => reject(new Error('CrossMarket did not respond'))
      });
    });
  }

  function css() {
    const style = document.createElement('style');
    style.textContent = `
      #mc-trigger { position:fixed; right:18px; bottom:18px; z-index:2147483646; border:2px solid #111; border-radius:999px; padding:9px 14px; background:#fff; color:#111; font:600 14px/1.2 system-ui,sans-serif; box-shadow:0 2px 10px rgb(0 0 0 / .28); cursor:pointer; }
      #mc-trigger:focus-visible, #mc-panel button:focus-visible, #mc-panel select:focus-visible, #mc-panel a:focus-visible, #mc-panel input:focus-visible { outline:3px solid #0b57d0 !important; outline-offset:2px !important; }
      #mc-panel { position:fixed; right:18px; bottom:66px; z-index:2147483647; width:min(390px,calc(100vw - 24px)); max-height:min(690px,calc(100vh - 90px)); overflow:auto; border:2px solid #222; border-radius:10px; padding:14px; background:#fff; color:#111; box-shadow:0 5px 24px rgb(0 0 0 / .36); font:14px/1.4 system-ui,sans-serif; }
      #mc-panel[hidden] { display:none !important; }
      #mc-panel * { box-sizing:border-box; }
      #mc-panel h2 { font:700 18px/1.25 system-ui,sans-serif; margin:0; color:#111; }
      #mc-panel p { margin:8px 0; color:#111; }
      #mc-panel .mc-head { display:flex; gap:8px; justify-content:space-between; align-items:start; }
      #mc-panel .mc-close { min-width:34px; }
      #mc-panel label { display:grid; gap:4px; margin:10px 0; font-weight:650; color:#111; }
      #mc-panel select, #mc-panel input { width:100%; padding:7px; border:1px solid #555; border-radius:4px; background:#fff; color:#111; font:inherit; }
      #mc-panel button, #mc-panel a.mc-button { display:inline-block; margin:3px 3px 3px 0; padding:7px 9px; border:1px solid #333; border-radius:4px; background:#f7f7f7; color:#111; font:inherit; text-decoration:none; cursor:pointer; }
      #mc-panel button[disabled] { opacity:.55; cursor:not-allowed; }
      #mc-panel .mc-primary { font-weight:700; border-width:2px; }
      #mc-panel .mc-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px; }
      #mc-panel .mc-preview { margin:9px 0; padding:8px; border:1px solid #aaa; border-radius:5px; background:#f6f6f6; }
      #mc-panel .mc-preview strong { display:block; overflow-wrap:anywhere; }
      #mc-panel .mc-status { min-height:2.8em; padding:6px; border-radius:4px; background:#f0f0f0; }
      #mc-panel .mc-warning { border-left:4px solid #8a4b00; padding-left:8px; }
      #mc-panel .mc-small { font-size:12px; }
      .mc-filled { outline:4px solid #0b57d0 !important; outline-offset:2px !important; transition:outline-color .2s; }
    `;
    document.documentElement.appendChild(style);
  }

  function buildUI() {
    css();
    trigger = document.createElement('button');
    trigger.id = 'mc-trigger';
    trigger.type = 'button';
    trigger.textContent = 'CrossMarket';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');

    panel = document.createElement('section');
    panel.id = 'mc-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'mc-heading');
    panel.innerHTML = `
      <div class="mc-head">
        <h2 id="mc-heading">CrossMarket</h2>
        <button class="mc-close" type="button" aria-label="Close CrossMarket panel">×</button>
      </div>
      <p>Target: <strong>${escapeHTML(MARKET_NAMES[market])}</strong></p>
      <div class="mc-status" role="status" aria-live="polite">Open the panel to connect to the local assistant.</div>
      <label>Listing
        <select class="mc-listing"><option>Loading…</option></select>
      </label>
      <div class="mc-preview" hidden></div>
      <label class="mc-replace"><span><input class="mc-overwrite" type="checkbox"> Replace fields that already contain text</span></label>
      <div class="mc-main-actions"></div>
      <div class="mc-copy-actions mc-grid"></div>
      <p class="mc-small mc-boundary-note">${market === 'googlephotos' ? 'Google Photos images are copied only when you explicitly press Add current photo.' : "CrossMarket never presses the site's Post, Publish, Next, or Submit control."}</p>
      <p class="mc-small"><a class="mc-button" href="${BASE}/" target="_blank" rel="noopener">Open local CrossMarket</a> <button type="button" class="mc-refresh">Refresh listings</button></p>
    `;

    document.documentElement.append(trigger, panel);
    status = panel.querySelector('.mc-status');
    trigger.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
    panel.querySelector('.mc-close').addEventListener('click', closePanel);
    panel.querySelector('.mc-refresh').addEventListener('click', loadListings);
    panel.querySelector('.mc-listing').addEventListener('change', e => selectListing(e.target.value));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });

    const main = panel.querySelector('.mc-main-actions');
    if (market === 'googlephotos') {
      panel.querySelector('.mc-replace').hidden = true;
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'mc-primary mc-add-google-photo';
      add.textContent = 'Add current photo to listing';
      add.addEventListener('click', addCurrentGooglePhoto);
      main.append(add);
      const note = document.createElement('p');
      note.className = 'mc-small';
      note.textContent = 'Open a single photo in Google Photos, then use this button to copy the displayed image into the selected CrossMarket listing.';
      main.append(note);
    } else if (market === 'craigslist') {
      panel.querySelector('.mc-replace').hidden = true;
      main.innerHTML = '<p class="mc-warning"><strong>Copy-only on Craigslist.</strong> CrossMarket does not fill Craigslist posting forms because Craigslist explicitly disallows automated posting.</p>';
    } else {
      const fill = document.createElement('button');
      fill.type = 'button';
      fill.className = 'mc-primary';
      fill.textContent = 'Fill visible fields';
      fill.addEventListener('click', fillFields);
      main.append(fill);
    }

    if (market !== 'googlephotos') {
      const saveUrl = document.createElement('button');
      saveUrl.type = 'button';
      saveUrl.className = 'mc-save-ad-url';
      saveUrl.textContent = 'Save current ad URL';
      saveUrl.addEventListener('click', () => saveCurrentAdUrl(true));
      main.append(saveUrl);
      const urlNote = document.createElement('p');
      urlNote.className = 'mc-small';
      urlNote.textContent = 'If you started here with CrossMarket’s Open button, the companion also tries to save the URL automatically after the marketplace opens the newly published ad.';
      main.append(urlNote);
    }

    if (typeof GM.registerMenuCommand === 'function') {
      GM.registerMenuCommand('Open CrossMarket panel', openPanel);
      if (market === 'googlephotos') GM.registerMenuCommand('Add current photo to CrossMarket', () => openPanel().then(addCurrentGooglePhoto));
    }
  }

  async function openPanel() {
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    panel.querySelector('.mc-close').focus();
    if (!indexData) await loadListings();
  }

  function closePanel() {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  }

  async function loadListings() {
    setStatus('Connecting to the local CrossMarket…');
    try {
      indexData = await requestJSON(`${BASE}/api/companion?market=${encodeURIComponent(market)}`);
      const select = panel.querySelector('.mc-listing');
      select.innerHTML = '';
      if (!indexData.listings.length) {
        select.innerHTML = '<option value="">No CrossMarket listings yet</option>';
        selected = null;
        renderSelected();
        setStatus('Connected, but there are no listings yet.');
        return;
      }
      for (const item of indexData.listings) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.title}${item.price ? ` — $${item.price}` : ''}`;
        select.append(option);
      }
      const preferred = indexData.listings.some(x => x.id === indexData.activeListingId) ? indexData.activeListingId : indexData.listings[0].id;
      select.value = preferred;
      selectListing(preferred, false);
      setStatus(`Connected to CrossMarket ${indexData.version}.`);
      if (market !== 'googlephotos') setTimeout(maybeAutoCapturePublishedUrl, 250);
    } catch (error) {
      selected = null;
      renderSelected();
      setStatus(`${error.message}. Start CrossMarket with “npm start”, then refresh.`);
    }
  }

  async function selectListing(id, makeActive = true) {
    selected = indexData?.listings.find(x => x.id === id) || null;
    renderSelected();
    if (selected && makeActive) {
      try {
        await postJSON(`${BASE}/api/companion/active`, 'PUT', { id: selected.id });
        indexData.activeListingId = selected.id;
      } catch { /* Selection still works in this tab if saving active choice fails. */ }
    }
  }

  function renderSelected() {
    const preview = panel.querySelector('.mc-preview');
    const copies = panel.querySelector('.mc-copy-actions');
    copies.innerHTML = '';
    if (!selected?.resolved) {
      preview.hidden = true;
      return;
    }
    const x = selected.resolved;
    preview.hidden = false;
    preview.innerHTML = `<strong>${escapeHTML(x.title)}</strong>${x.price ? `<span>$${escapeHTML(x.price)}</span>` : ''}<br><span>${escapeHTML(x.category || 'No category')} · ${escapeHTML(x.condition || 'No condition')}</span><br><span>${x.photos.length} photo${x.photos.length === 1 ? '' : 's'} stored locally</span>`;

    if (market === 'googlephotos') return;

    const actions = [
      ['Title', x.title], ['Price', x.price], ['Description', x.description],
      ['Category', x.category], ['Condition', x.condition], ['Location', x.location]
    ];
    for (const [label, value] of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `Copy ${label.toLowerCase()}`;
      b.disabled = !value;
      b.addEventListener('click', () => copy(value, `${label} copied.`));
      copies.append(b);
    }
    if (market === 'karrot' && x.importSourceUrl) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Copy import URL';
      b.addEventListener('click', () => copy(x.importSourceUrl, 'Kijiji/Facebook source URL copied for Karrot import.'));
      copies.append(b);
    }
  }

  function copy(value, message) {
    GM.setClipboard(String(value || ''));
    setStatus(message);
  }

  function setStatus(message) { if (status) status.textContent = message; }

  function normalizedPageUrl(raw = location.href) {
    try {
      const u = new URL(raw, location.href);
      u.hash = '';
      return u;
    } catch { return null; }
  }

  function marketUrlCandidates() {
    const raw = [
      location.href,
      document.querySelector('link[rel="canonical"]')?.href,
      document.querySelector('meta[property="og:url"]')?.content
    ];
    const seen = new Set();
    return raw.map(normalizedPageUrl).filter(u => {
      if (!u) return false;
      const h = u.hostname.toLowerCase();
      const allowed =
        (market === 'kijiji' && (h === 'kijiji.ca' || h.endsWith('.kijiji.ca'))) ||
        (market === 'facebook' && (h === 'facebook.com' || h.endsWith('.facebook.com'))) ||
        (market === 'karrot' && (h === 'karrotmarket.com' || h.endsWith('.karrotmarket.com'))) ||
        (market === 'craigslist' && (h === 'craigslist.org' || h.endsWith('.craigslist.org')));
      const key = u.toString();
      if (!allowed || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function currentCanonicalUrl() {
    return marketUrlCandidates()[0] || normalizedPageUrl(location.href);
  }

  function detectedPublishedAdUrl() {
    if (market === 'googlephotos') return '';
    for (const u of marketUrlCandidates()) {
      const path = u.pathname.replace(/\/+$/, '');
      let recognized = false;

      if (market === 'facebook') recognized = /^\/marketplace\/item\/\d+$/i.test(path);
      if (market === 'craigslist') recognized = /\/\d{8,}\.html$/i.test(path);
      if (market === 'karrot') recognized = /^\/(?:ca\/)?buy-sell\/(?!all$)[a-z0-9_-]+$/i.test(path);
      if (market === 'kijiji') recognized = /\/v-[^/]+\//i.test(path) && /\/\d{7,}$/i.test(path);

      if (recognized) {
        u.search = '';
        u.hash = '';
        return u.toString();
      }
    }
    return '';
  }

  async function persistAdUrl(listingId, url, automatic = false) {
    const resolved = await postJSON(`${BASE}/api/companion/listings/${listingId}/market-url`, 'PUT', { market, url });
    if (selected?.id === listingId && selected.resolved) selected.resolved = { ...selected.resolved, ...resolved };
    if (indexData) {
      indexData.pendingUrlCaptureId = '';
      const item = indexData.listings.find(x => x.id === listingId);
      if (item?.resolved) item.resolved = { ...item.resolved, ...resolved };
    }
    renderSelected();
    setStatus(`${automatic ? 'Automatically saved' : 'Saved'} this ${MARKET_NAMES[market]} ad URL to “${resolved.title}”.`);
    if (automatic && trigger) {
      const old = trigger.textContent;
      trigger.textContent = 'CrossMarket ✓ URL saved';
      setTimeout(() => { if (trigger) trigger.textContent = old; }, 3500);
    }
    return resolved;
  }

  async function saveCurrentAdUrl(allowUnrecognized = false) {
    if (market === 'googlephotos') return;
    if (!selected?.resolved) return setStatus('Choose a CrossMarket listing first.');
    let url = detectedPublishedAdUrl();
    if (!url && allowUnrecognized) {
      const candidate = currentCanonicalUrl();
      if (!candidate) return setStatus('I could not determine the current page URL.');
      const ok = confirm(`CrossMarket cannot confidently recognize this as a published ${MARKET_NAMES[market]} ad. Save this page URL anyway?\n\n${candidate.toString()}`);
      if (!ok) return;
      candidate.hash = '';
      url = candidate.toString();
    }
    if (!url) return setStatus('Open the published ad page first, then try Save current ad URL again.');
    try { await persistAdUrl(selected.id, url, false); }
    catch (error) { setStatus(error.message || 'Could not save the ad URL.'); }
  }

  async function maybeAutoCapturePublishedUrl() {
    if (captureInFlight || market === 'googlephotos') return;
    const url = detectedPublishedAdUrl();
    if (!url) return;
    captureInFlight = true;
    try {
      // Refresh here because CrossMarket may have armed capture just after this
      // marketplace tab first loaded.
      const fresh = await requestJSON(`${BASE}/api/companion?market=${encodeURIComponent(market)}`);
      const selectedId = selected?.id;
      indexData = fresh;
      if (selectedId) selected = fresh.listings.find(x => x.id === selectedId) || selected;
      const pending = fresh.listings.find(x => x.id === fresh.pendingUrlCaptureId);
      if (!pending) return;
      await persistAdUrl(pending.id, url, true);
    } catch (error) {
      setStatus(`Found what looks like a published ad, but could not save its URL: ${error.message}`);
    } finally {
      captureInFlight = false;
    }
  }

  function startUrlWatcher() {
    if (market === 'googlephotos') return;
    setInterval(() => {
      if (location.href === lastObservedHref) return;
      lastObservedHref = location.href;
      setTimeout(maybeAutoCapturePublishedUrl, 500);
    }, 750);
  }

  function visibleRect(el) {
    const r = el?.getBoundingClientRect?.();
    if (!r || r.width < 1 || r.height < 1) return null;
    const left = Math.max(0, r.left), top = Math.max(0, r.top);
    const right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom);
    const width = Math.max(0, right - left), height = Math.max(0, bottom - top);
    return width && height ? { r, area: width * height, cx: left + width / 2, cy: top + height / 2 } : null;
  }

  function findCurrentGooglePhoto() {
    const visibleVideo = [...document.querySelectorAll('video')]
      .map(el => ({ el, vr: visibleRect(el) }))
      .filter(x => x.vr && x.vr.area > innerWidth * innerHeight * 0.12)
      .sort((a, b) => b.vr.area - a.vr.area)[0];

    const candidates = [...document.images]
      .filter(img => !img.closest('#mc-panel') && img.id !== 'mc-trigger')
      .map(img => {
        const vr = visibleRect(img);
        const src = img.currentSrc || img.src || '';
        if (!vr || !src || img.naturalWidth < 300 || img.naturalHeight < 300) return null;
        if (vr.r.width < 240 || vr.r.height < 180) return null;
        let score = vr.area;
        const dx = vr.cx - innerWidth / 2, dy = vr.cy - innerHeight / 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        score -= distance * 400;
        if (/googleusercontent\.com|ggpht\.com/i.test(src)) score += innerWidth * innerHeight * 0.25;
        return { img, src, area: vr.area, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    if (!best || best.area < innerWidth * innerHeight * 0.08) return { error: 'Open a single photo in Google Photos first. I could not find a large displayed photo.' };
    if (visibleVideo && visibleVideo.vr.area > best.area * 0.8) return { error: 'The current Google Photos item appears to be a video. CrossMarket currently imports still photos only.' };
    return best;
  }

  function getResponseHeader(headers, name) {
    const m = String(headers || '').match(new RegExp(`^${name}:\\s*(.+)$`, 'im'));
    return m ? m[1].trim() : '';
  }

  function downloadGooglePhoto(src) {
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      return fetch(src).then(r => {
        if (!r.ok) throw new Error(`Could not read the displayed photo (HTTP ${r.status})`);
        return r.blob();
      });
    }
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: 'GET',
        url: src,
        responseType: 'blob',
        timeout: 30000,
        onload: response => {
          if (response.status < 200 || response.status >= 300) return reject(new Error(`Could not fetch the Google Photos image (HTTP ${response.status})`));
          const type = getResponseHeader(response.responseHeaders, 'content-type').split(';')[0].toLowerCase();
          const blob = response.response instanceof Blob ? response.response : new Blob([response.response], { type });
          resolve(blob.type ? blob : blob.slice(0, blob.size, type));
        },
        onerror: () => reject(new Error('Could not fetch the displayed Google Photos image')),
        ontimeout: () => reject(new Error('Timed out while reading the Google Photos image'))
      });
    });
  }

  function extensionForMime(type) {
    return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[String(type || '').toLowerCase()] || '';
  }

  function fileNameForGooglePhoto(img, type) {
    const ext = extensionForMime(type) || 'jpg';
    const possible = [img.getAttribute('alt'), img.getAttribute('aria-label')]
      .map(s => String(s || '').trim())
      .find(s => /\.(?:jpe?g|png|webp|gif)$/i.test(s) && s.length <= 180);
    if (possible) return possible.replace(/[\\/]+/g, '-');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `google-photos-${stamp}.${ext}`;
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not convert the Google Photos image for local storage'));
      reader.readAsDataURL(blob);
    });
  }

  async function addCurrentGooglePhoto() {
    if (market !== 'googlephotos') return;
    if (!selected?.resolved) return setStatus('Choose a CrossMarket listing first.');
    const button = panel?.querySelector('.mc-add-google-photo');
    if (button?.disabled) return;

    const found = findCurrentGooglePhoto();
    if (found.error) return setStatus(found.error);

    try {
      if (button) { button.disabled = true; button.textContent = 'Adding photo…'; }
      setStatus(`Reading the current Google Photos image for “${selected.resolved.title}”…`);
      const blob = await downloadGooglePhoto(found.src);
      const type = String(blob.type || '').split(';')[0].toLowerCase();
      if (!extensionForMime(type)) throw new Error(`Google Photos returned ${type || 'an unknown image format'}; CrossMarket currently supports JPEG, PNG, WEBP, and GIF`);
      if (blob.size > 40 * 1024 * 1024) throw new Error('This displayed photo is larger than 40 MB');
      const dataUrl = await blobToDataURL(blob);
      const name = fileNameForGooglePhoto(found.img, type);
      await postJSON(`${BASE}/api/listings/${selected.id}/photos`, 'POST', { name, dataUrl }, 60000);

      indexData = await requestJSON(`${BASE}/api/companion?market=googlephotos`);
      selected = indexData.listings.find(x => x.id === selected.id) || selected;
      renderSelected();
      setStatus(`Added the current Google Photos image to “${selected.resolved.title}”. It is now stored locally in CrossMarket.`);
    } catch (error) {
      setStatus(error.message || 'Could not add the Google Photos image.');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Add current photo to listing'; }
    }
  }

  function normalize(s) {
    return String(s || '').toLowerCase().replace(/[\s\n\r\t:_-]+/g, ' ').trim();
  }

  function getDescriptor(el) {
    const parts = [];
    const push = (kind, value) => { if (value) parts.push({ kind, text: normalize(value) }); };
    push('aria', el.getAttribute('aria-label'));
    push('placeholder', el.getAttribute('placeholder'));
    push('name', el.getAttribute('name'));
    push('id', el.id);
    push('data', el.getAttribute('data-testid'));

    if (el.labels) for (const l of el.labels) push('label', l.textContent);
    const wrappingLabel = el.closest('label');
    if (wrappingLabel) push('label', wrappingLabel.textContent);
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) for (const id of labelledby.split(/\s+/)) push('label', document.getElementById(id)?.textContent);

    const parent = el.closest('[role="group"], [role="combobox"], [class]');
    if (parent && parent !== el && String(parent.textContent || '').length < 140) push('context', parent.textContent);
    return parts;
  }

  function isVisible(el) {
    if (!el || el.disabled || el.readOnly) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.getClientRects().length > 0;
  }

  function candidateScore(el, words) {
    const desc = getDescriptor(el);
    let best = 0;
    for (const part of desc) {
      for (const rawWord of words) {
        const word = normalize(rawWord);
        if (!part.text) continue;
        let score = 0;
        if (part.text === word) score = part.kind === 'label' || part.kind === 'aria' ? 30 : 24;
        else if (part.text.startsWith(word + ' ') || part.text.endsWith(' ' + word)) score = part.kind === 'label' || part.kind === 'aria' ? 22 : 17;
        else if (part.text.includes(word)) score = part.kind === 'label' || part.kind === 'aria' ? 16 : 11;
        if (part.kind === 'context') score -= 7;
        best = Math.max(best, score);
      }
    }
    if (el.tagName === 'TEXTAREA') best += 1;
    return best;
  }

  function findField(field) {
    const rule = FIELD_RULES[field];
    const candidates = [...document.querySelectorAll(rule.selector)].filter(isVisible);
    const ranked = candidates.map(el => ({ el, score: candidateScore(el, rule.words) })).sort((a, b) => b.score - a.score);
    return ranked[0]?.score >= 11 ? ranked[0] : null;
  }

  function existingValue(el) {
    if (el.isContentEditable || el.getAttribute('role') === 'textbox' && !('value' in el)) return (el.textContent || '').trim();
    return String(el.value || '').trim();
  }

  function setNativeValue(el, value) {
    const text = String(value ?? '');
    if (el.isContentEditable || (el.getAttribute('role') === 'textbox' && !('value' in el))) {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    el.focus();
    if (setter) setter.call(el, text); else el.value = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  async function fillFields() {
    if (!selected?.resolved) return setStatus('Choose a CrossMarket listing first.');
    if (market === 'craigslist') return setStatus('Craigslist is intentionally copy-only.');

    const overwrite = panel.querySelector('.mc-overwrite').checked;
    const x = selected.resolved;
    const fieldValues = { title: x.title, price: x.price, description: x.description, location: x.location };
    const filled = [];
    const skipped = [];
    const notFound = [];

    for (const [field, value] of Object.entries(fieldValues)) {
      if (!value) continue;
      const result = findField(field);
      if (!result) { notFound.push(field); continue; }
      const old = existingValue(result.el);
      if (old && old !== String(value) && !overwrite) { skipped.push(field); continue; }
      setNativeValue(result.el, value);
      result.el.classList.add('mc-filled');
      setTimeout(() => result.el.classList.remove('mc-filled'), 2200);
      filled.push(field);
    }

    const parts = [];
    if (filled.length) parts.push(`Filled: ${filled.join(', ')}`);
    if (skipped.length) parts.push(`Kept existing: ${skipped.join(', ')}`);
    if (notFound.length) parts.push(`Not found: ${notFound.join(', ')}`);
    if (!parts.length) parts.push('No compatible visible text fields were found.');
    parts.push('Category, condition, photos, and final posting remain manual.');
    setStatus(parts.join('. ') + '.');
  }

  function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  buildUI();
  startUrlWatcher();
  if (market !== 'googlephotos') setTimeout(loadListings, 300);
})();
