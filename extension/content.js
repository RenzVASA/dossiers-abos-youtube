// Dossiers d'abos pour YouTube — content script
(() => {
  if (window.top !== window.self || window.__ytFolders) return;
  window.__ytFolders = true;

  // ───────────────────────── Constantes & état ─────────────────────────
  const COLORS = ['#3ea6ff', '#ff4e45', '#2ba640', '#f9a825', '#a142f4', '#ff7ab6', '#00bfa5', '#ff8a3d'];
  const EMOJIS = ['📁', '🎮', '📚', '🎵', '🍳', '💻', '😂', '🎬', '⚽', '🧪', '🎨', '📰', '🚗', '✈️', '🧠', '⭐', '🔥', '💤'];

  let data = { folders: [], channels: {} };
  let ready = false;
  let active = sessionStorage.getItem('ytf-active') || 'all'; // 'all' | 'none' | id de dossier
  let index = { keys: {}, names: {}, allKeys: new Set(), allNames: new Set() };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const uid = () => Math.random().toString(36).slice(2, 10);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };
  const isSubsPage = () => location.pathname.replace(/\/+$/, '') === '/feed/subscriptions';
  const isChannelsPage = () => location.pathname.replace(/\/+$/, '') === '/feed/channels';
  const folderById = (id) => data.folders.find((f) => f.id === id);
  const chanUrl = (k) => `https://www.youtube.com/${k}`;
  const chanName = (k) => data.channels[k]?.name || k.replace(/^channel\//, '');

  function keyFromHref(href) {
    if (!href) return null;
    let p;
    try { p = decodeURIComponent(new URL(href, location.origin).pathname); } catch { return null; }
    const m = p.match(/^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/);
    if (!m) return null;
    return m[1].startsWith('@') ? m[1].toLowerCase() : m[1];
  }

  function rebuildIndex() {
    index = { keys: {}, names: {}, allKeys: new Set(), allNames: new Set() };
    for (const f of data.folders) {
      const ks = new Set(f.channels), ns = new Set();
      for (const k of f.channels) {
        const n = norm(data.channels[k]?.name);
        index.allKeys.add(k);
        if (n) { ns.add(n); index.allNames.add(n); }
      }
      index.keys[f.id] = ks;
      index.names[f.id] = ns;
    }
  }

  function sanitize(raw) {
    const folders = Array.isArray(raw.folders) ? raw.folders : [];
    const channels = raw.channels && typeof raw.channels === 'object' ? raw.channels : {};
    return {
      folders: folders.filter((f) => f && f.id).map((f, i) => ({
        id: String(f.id),
        name: String(f.name || 'Dossier').slice(0, 40),
        emoji: f.emoji || '📁',
        color: f.color || COLORS[i % COLORS.length],
        channels: Array.isArray(f.channels) ? [...new Set(f.channels.map(String))] : [],
        open: !!f.open
      })),
      channels
    };
  }

  async function save() {
    rebuildIndex();
    renderAll();
    if (!alive()) return;
    try { await chrome.storage.local.set({ folders: data.folders, channels: data.channels }); } catch { /* extension rechargée */ }
  }

  // ───────────────────────── Opérations ─────────────────────────
  function createFolder(name, withKey) {
    const f = {
      id: uid(),
      name: (name || '').trim().slice(0, 40) || 'Nouveau dossier',
      emoji: '📁',
      color: COLORS[data.folders.length % COLORS.length],
      channels: withKey ? [withKey] : [],
      open: false
    };
    data.folders.push(f);
    save();
    return f;
  }

  function setInFolder(fid, key, want) {
    const f = folderById(fid);
    if (!f) return;
    const has = f.channels.includes(key);
    const w = want ?? !has;
    if (w && !has) f.channels.push(key);
    if (!w && has) f.channels = f.channels.filter((k) => k !== key);
    save();
  }

  function upsertChannel(key, name, avatar, desc) {
    if (!key) return false;
    const c = data.channels[key] || {};
    let changed = !data.channels[key];
    const d = (desc || '').trim().replace(/\s+/g, ' ').slice(0, 400);
    if (d && c.desc !== d) { c.desc = d; changed = true; }
    const n = (name || '').trim().replace(/\s+/g, ' ');
    if (n && !n.startsWith('@') && c.name !== n) { c.name = n; changed = true; }
    if (!c.name && n) { c.name = n; changed = true; }
    if (avatar && /^https?:/.test(avatar) && c.avatar !== avatar) { c.avatar = avatar; changed = true; }
    data.channels[key] = c;
    return changed;
  }

  // ───────────────────────── Styles ─────────────────────────
  const globalStyle = document.createElement('style');
  globalStyle.textContent = '[data-ytf-hide]{display:none!important}';
  (document.head || document.documentElement).appendChild(globalStyle);

  const BASE = `
    :host { --bg:#fff; --fg:#0f0f0f; --muted:#606060; --chip:rgba(0,0,0,.05); --chip-h:rgba(0,0,0,.1);
      --line:rgba(0,0,0,.1); --pop:#fff; --accent:#065fd4; --act-bg:#0f0f0f; --act-fg:#fff; --field:#fff;
      --shadow:0 4px 32px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.06);
      font-family:"Roboto","Arial",sans-serif; color:var(--fg); -webkit-font-smoothing:antialiased; }
    :host([dark]) { --bg:#0f0f0f; --fg:#f1f1f1; --muted:#aaa; --chip:rgba(255,255,255,.1); --chip-h:rgba(255,255,255,.2);
      --line:rgba(255,255,255,.16); --pop:#282828; --accent:#3ea6ff; --act-bg:#f1f1f1; --act-fg:#0f0f0f; --field:#121212;
      --shadow:0 4px 32px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08); }
    * { box-sizing:border-box; }
    button { font:inherit; color:inherit; cursor:pointer; }
    input, select { font:inherit; color:inherit; }
    .av { width:24px; height:24px; border-radius:50%; flex:none; object-fit:cover; background:var(--chip);
      display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:500; color:var(--muted); }
  `;

  function makeHost(tag, css) {
    const host = document.createElement(tag);
    host.style.setProperty('display', 'block', 'important');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${BASE}${css}</style><div class="r"></div>`;
    return { host, root, r: root.querySelector('.r') };
  }

  // Empêche les raccourcis clavier de YouTube (k, f, /…) quand on tape dans nos champs
  function shieldKeys(root, onEscape) {
    for (const t of ['keydown', 'keyup', 'keypress']) {
      root.addEventListener(t, (e) => {
        if (t === 'keydown' && e.key === 'Escape' && onEscape) onEscape();
        e.stopPropagation();
      });
    }
  }

  const avatarHtml = (k, cls = 'av') => {
    const c = data.channels[k];
    if (c?.avatar) return `<img class="${cls}" src="${esc(c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
    return `<span class="${cls}">${esc(chanName(k).replace(/^@/, '').charAt(0).toUpperCase())}</span>`;
  };

  // ───────────────────────── Barre de filtres (fil Abonnements) ─────────────────────────
  const BAR_CSS = `
    :host { margin:4px 8px 20px !important; }
    .r { display:flex; flex-direction:column; gap:8px; }
    .chips { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .chip { height:32px; padding:0 12px; border-radius:8px; border:0; background:var(--chip); font-size:14px; font-weight:500;
      display:inline-flex; align-items:center; gap:6px; white-space:nowrap; transition:background .15s; }
    .chip:hover { background:var(--chip-h); }
    .chip.on { background:var(--act-bg); color:var(--act-fg); }
    .chip .n { opacity:.6; font-weight:400; font-size:12px; }
    .chip .dot { width:8px; height:8px; border-radius:50%; }
    .chip.ghost { background:transparent; border:1px solid var(--line); }
    .sep { width:1px; height:20px; background:var(--line); margin:0 4px; }
    .status { font-size:13px; color:var(--muted); min-height:0; }
    .status:empty { display:none; }
  `;
  let bar = null, barSig = '';

  function ensureBar() {
    const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]:not([hidden])');
    if (!browse) return null;
    if (!bar) {
      bar = makeHost('ytf-bar', BAR_CSS);
      bar.r.addEventListener('click', (e) => {
        const b = e.target.closest('[data-f]');
        if (b) return setActive(b.dataset.f, true);
        if (e.target.closest('[data-act="manage"]')) openManager();
      });
    }
    if (!browse.contains(bar.host)) {
      const grid = browse.querySelector('ytd-rich-grid-renderer, ytd-section-list-renderer');
      const contents = grid && (grid.querySelector(':scope > #contents') || grid.querySelector('#contents'));
      if (contents?.parentNode) contents.parentNode.insertBefore(bar.host, contents);
      else (browse.querySelector('#primary') || browse).prepend(bar.host);
      barSig = '';
    }
    renderBar();
    return browse;
  }

  function renderBar() {
    if (!bar) return;
    if (active !== 'all' && active !== 'none' && !folderById(active)) active = 'all';
    const sig = JSON.stringify([active, data.folders.map((f) => [f.id, f.name, f.emoji, f.color, f.channels.length])]);
    if (sig === barSig) return;
    barSig = sig;
    const chip = (id, label, extra = '') =>
      `<button class="chip ${active === id ? 'on' : ''}" data-f="${esc(id)}">${extra}${label}</button>`;
    let html = chip('all', 'Tout');
    for (const f of data.folders) {
      html += chip(f.id, `${esc(f.emoji)} ${esc(f.name)} <span class="n">${f.channels.length}</span>`);
    }
    if (data.folders.length) html += chip('none', 'Non classées');
    html += `<span class="sep"></span><button class="chip ghost" data-act="manage">${data.folders.length ? '⚙️ Gérer' : '➕ Créer des dossiers'}</button>`;
    bar.r.innerHTML = `<div class="chips">${html}</div><div class="status"></div>`;
  }

  function setActive(id, scroll) {
    active = id;
    sessionStorage.setItem('ytf-active', id);
    barSig = ''; sideSig = '';
    renderBar(); renderSide(); applyFilter();
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function itemChannel(it) {
    const keys = new Set(), names = new Set();
    for (const a of it.querySelectorAll('a[href]')) {
      const k = keyFromHref(a.getAttribute('href'));
      if (k) { keys.add(k); const t = norm(a.textContent); if (t && t.length < 80) names.add(t); }
    }
    for (const e of it.querySelectorAll('ytd-channel-name #text, .yt-content-metadata-view-model__metadata-row:first-child')) {
      const t = norm(e.textContent); if (t && t.length < 80) names.add(t);
    }
    return { keys, names };
  }

  function matches(it) {
    const { keys, names } = itemChannel(it);
    if (active === 'none') {
      for (const k of keys) if (index.allKeys.has(k)) return false;
      for (const n of names) if (index.allNames.has(n)) return false;
      return true;
    }
    const ks = index.keys[active], ns = index.names[active];
    if (!ks) return true;
    for (const k of keys) if (ks.has(k)) return true;
    for (const n of names) if (ns.has(n)) return true;
    return false;
  }

  function applyFilter() {
    const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
    if (!browse) return;
    const filtering = active !== 'all' && isSubsPage();
    let shown = 0, total = 0;
    for (const it of browse.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer')) {
      if (it.closest('ytd-rich-section-renderer')) continue;
      total++;
      if (!filtering || matches(it)) { shown++; it.removeAttribute('data-ytf-hide'); }
      else it.setAttribute('data-ytf-hide', '');
    }
    for (const s of browse.querySelectorAll('ytd-rich-section-renderer')) {
      if (filtering) s.setAttribute('data-ytf-hide', ''); else s.removeAttribute('data-ytf-hide');
    }
    for (const row of browse.querySelectorAll('ytd-rich-grid-row')) {
      const vis = [...row.querySelectorAll('ytd-rich-item-renderer')].some((i) => !i.hasAttribute('data-ytf-hide'));
      if (vis) row.removeAttribute('data-ytf-hide'); else row.setAttribute('data-ytf-hide', '');
    }
    const st = bar?.root.querySelector('.status');
    if (st) {
      st.textContent = !filtering ? ''
        : shown === 0 ? 'Aucune vidéo de ce dossier dans ce qui est chargé. Fais défiler pour en charger plus.'
        : `${shown} vidéo${shown > 1 ? 's' : ''} sur ${total} chargées. Fais défiler pour en voir plus.`;
    }
  }

  // ───────────────────────── Section « Dossiers » dans la barre latérale ─────────────────────────
  const SIDE_CSS = `
    :host { border-top:1px solid var(--line); padding:12px 12px 12px; }
    .title { font-size:16px; font-weight:500; padding:6px 12px 4px; display:flex; align-items:center; justify-content:space-between; }
    .row { display:flex; align-items:center; border-radius:10px; }
    .row:hover { background:var(--chip); }
    .row.on { background:var(--chip); font-weight:500; }
    .go { flex:1; min-width:0; height:40px; display:flex; align-items:center; gap:16px; padding:0 4px 0 12px; border:0; background:none;
      font-size:14px; text-align:left; }
    .emo { width:24px; text-align:center; font-size:17px; flex:none; }
    .name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cnt { font-size:12px; color:var(--muted); }
    .chev { width:32px; height:32px; border:0; background:none; border-radius:50%; display:flex; align-items:center; justify-content:center;
      color:var(--muted); margin-right:4px; flex:none; }
    .chev:hover { background:var(--chip-h); color:var(--fg); }
    .chev svg { transition:transform .15s; }
    .chev.open svg { transform:rotate(90deg); }
    .chans { padding:2px 0 6px 20px; }
    .ch { display:flex; align-items:center; gap:12px; height:34px; padding:0 12px; border-radius:10px; color:inherit; text-decoration:none; font-size:13px; }
    .ch:hover { background:var(--chip); }
    .ch span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .empty { font-size:12px; color:var(--muted); padding:4px 12px 6px; }
    .manage { color:var(--muted); }
  `;
  let side = null, sideSig = '';
  const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function ensureSidebar() {
    const sections = document.querySelector('ytd-guide-renderer #sections');
    if (!sections) return;
    if (!side) {
      side = makeHost('ytf-side', SIDE_CSS);
      side.r.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const f = folderById(b.dataset.id);
        if (b.dataset.act === 'go') goFolder(b.dataset.id);
        else if (b.dataset.act === 'toggle' && f) { f.open = !f.open; save(); }
        else if (b.dataset.act === 'manage') openManager();
      });
    }
    if (side.host.parentNode !== sections) {
      const first = sections.querySelector(':scope > ytd-guide-section-renderer');
      if (first) first.after(side.host); else sections.prepend(side.host);
      sideSig = '';
    }
    renderSide();
  }

  function renderSide() {
    if (!side) return;
    const sel = isSubsPage() ? active : '';
    const sig = JSON.stringify([sel, data.folders, data.folders.flatMap((f) => (f.open ? f.channels.map((k) => data.channels[k]) : []))]);
    if (sig === sideSig) return;
    sideSig = sig;
    let html = `<div class="title">Dossiers</div>`;
    for (const f of data.folders) {
      html += `<div class="row ${sel === f.id ? 'on' : ''}">
        <button class="go" data-act="go" data-id="${esc(f.id)}" title="Voir les vidéos de ce dossier">
          <span class="emo">${esc(f.emoji)}</span><span class="name">${esc(f.name)}</span><span class="cnt">${f.channels.length}</span>
        </button>
        <button class="chev ${f.open ? 'open' : ''}" data-act="toggle" data-id="${esc(f.id)}" aria-label="Afficher les chaînes">${CHEV}</button>
      </div>`;
      if (f.open) {
        html += `<div class="chans">${f.channels.length
          ? f.channels.map((k) => `<a class="ch" href="${esc(chanUrl(k))}">${avatarHtml(k)}<span>${esc(chanName(k))}</span></a>`).join('')
          : '<div class="empty">Dossier vide</div>'}</div>`;
      }
    }
    html += `<div class="row"><button class="go manage" data-act="manage"><span class="emo">${data.folders.length ? '⚙️' : '➕'}</span>
      <span class="name">${data.folders.length ? 'Gérer les dossiers' : 'Créer un dossier'}</span></button></div>`;
    side.r.innerHTML = html;
  }

  function goFolder(id) {
    if (isSubsPage()) return setActive(id, true);
    active = id;
    sessionStorage.setItem('ytf-active', id);
    const link = document.querySelector('ytd-app a[href="/feed/subscriptions"]');
    if (link) link.click(); else location.assign('/feed/subscriptions');
  }

  // ───────────────────────── Bouton « Ranger » (chaîne & vidéo) ─────────────────────────
  const BTN_CSS = `
    :host { display:inline-block !important; margin-left:8px; vertical-align:middle; flex:none; }
    button.b { height:36px; padding:0 14px; border-radius:18px; border:0; background:var(--chip); font-size:14px; font-weight:500;
      display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
    button.b:hover { background:var(--chip-h); }
  `;
  let cb = null, cbSig = '';

  function currentChannel() {
    const p = location.pathname;
    if (p === '/watch') {
      const meta = document.querySelector('ytd-watch-metadata');
      const owner = meta?.querySelector('#owner');
      if (!owner) return null;
      const a = [...owner.querySelectorAll('a[href]')].find((x) => keyFromHref(x.getAttribute('href')));
      if (!a) return null;
      return {
        key: keyFromHref(a.getAttribute('href')),
        name: owner.querySelector('ytd-channel-name #text, ytd-channel-name a')?.textContent?.trim() || a.textContent.trim(),
        avatar: owner.querySelector('#avatar img, img')?.src,
        anchor: owner,
        after: owner.querySelector('#subscribe-button')
      };
    }
    const key = keyFromHref(p);
    if (!key) return null;
    const browse = document.querySelector('ytd-browse[page-subtype="channels"]:not([hidden])') || document;
    const anchor = browse.querySelector('#page-header yt-flexible-actions-view-model, yt-page-header-renderer yt-flexible-actions-view-model, ytd-c4-tabbed-header-renderer #buttons');
    if (!anchor) return null;
    return {
      key,
      name: browse.querySelector('#page-header h1, yt-page-header-renderer h1, ytd-c4-tabbed-header-renderer #channel-name #text')?.textContent?.trim()
        || document.title.replace(/ - YouTube$/, ''),
      avatar: browse.querySelector('#page-header yt-avatar-shape img, yt-page-header-renderer img, ytd-c4-tabbed-header-renderer #avatar img')?.src,
      anchor,
      after: null
    };
  }

  function ensureChanBtn() {
    const c = currentChannel();
    if (!c) return;
    if (!cb) {
      cb = makeHost('ytf-chanbtn', BTN_CSS);
      cb.r.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!cb.chan) return;
        if (pop?.open) return closePopover();
        openPopover(cb.chan, cb.r.querySelector('button').getBoundingClientRect());
      });
    }
    cb.chan = c;
    if (!c.anchor.contains(cb.host)) {
      if (c.after?.parentNode === c.anchor) c.after.after(cb.host); else c.anchor.appendChild(cb.host);
      cbSig = '';
    }
    const inF = data.folders.filter((f) => f.channels.includes(c.key));
    const sig = JSON.stringify([c.key, inF.map((f) => f.emoji + f.name)]);
    if (sig === cbSig) return;
    cbSig = sig;
    const label = inF.length === 0 ? '📁 Ranger'
      : inF.length === 1 ? `${esc(inF[0].emoji)} ${esc(inF[0].name)}`
      : `📁 ${inF.length} dossiers`;
    cb.r.innerHTML = `<button class="b" title="Ranger cette chaîne dans un dossier">${label}</button>`;
  }

  // ───────────────────────── Popover de rangement ─────────────────────────
  const POP_CSS = `
    :host { position:fixed !important; inset:0 auto auto 0; z-index:2300; }
    .p { position:fixed; width:280px; background:var(--pop); border-radius:12px; box-shadow:var(--shadow); padding:8px 0; font-size:14px;
      display:flex; flex-direction:column; overflow:hidden; }
    .h { padding:8px 16px 10px; font-weight:500; display:flex; gap:10px; align-items:center; border-bottom:1px solid var(--line); margin-bottom:6px; }
    .h span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .list { flex:1 1 auto; min-height:60px; max-height:300px; overflow:auto; }
    .h, form, .link { flex:none; }
    label { display:flex; align-items:center; gap:12px; padding:8px 16px; cursor:pointer; }
    label:hover { background:var(--chip); }
    input[type=checkbox] { width:18px; height:18px; accent-color:var(--accent); margin:0; }
    .none { padding:6px 16px 10px; color:var(--muted); font-size:13px; }
    form { display:flex; gap:8px; padding:8px 16px 4px; border-top:1px solid var(--line); margin-top:6px; }
    form input { flex:1; min-width:0; height:34px; border-radius:8px; border:1px solid var(--line); background:var(--field); padding:0 10px; outline:none; }
    form input:focus { border-color:var(--accent); }
    form button { border:0; border-radius:8px; background:var(--act-bg); color:var(--act-fg); padding:0 12px; font-weight:500; }
    .link { display:block; width:100%; border:0; background:none; text-align:left; padding:10px 16px 6px; color:var(--accent); font-size:13px; }
  `;
  let pop = null;

  function openPopover(chan, rect) {
    if (!pop) {
      pop = makeHost('ytf-pop', POP_CSS);
      document.documentElement.appendChild(pop.host);
      shieldKeys(pop.root, closePopover);
      pop.r.addEventListener('change', (e) => {
        const cbx = e.target.closest('input[type=checkbox]');
        if (!cbx) return;
        upsertChannel(pop.chan.key, pop.chan.name, pop.chan.avatar);
        setInFolder(cbx.dataset.id, pop.chan.key, cbx.checked);
      });
      pop.r.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = pop.r.querySelector('form input');
        if (!inp.value.trim()) return inp.focus();
        upsertChannel(pop.chan.key, pop.chan.name, pop.chan.avatar);
        createFolder(inp.value, pop.chan.key);
      });
      pop.r.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="manage"]')) { closePopover(); openManager(); }
      });
      document.addEventListener('pointerdown', (e) => {
        if (!pop?.open) return;
        const path = e.composedPath();
        if (!path.includes(pop.host) && !(cb && path.includes(cb.host))) closePopover();
      }, true);
      window.addEventListener('scroll', () => pop?.open && closePopover(), { passive: true });
    }
    pop.chan = chan;
    pop.rect = rect;
    pop.open = true;
    pop.host.style.setProperty('display', 'block', 'important');
    renderPopover();
    pop.r.querySelector('form input')?.focus({ preventScroll: true });
  }

  function renderPopover() {
    if (!pop?.open) return;
    const { chan, rect } = pop;
    const typed = pop.r.querySelector('form input');
    const list = data.folders.map((f) => `<label><input type="checkbox" data-id="${esc(f.id)}" ${f.channels.includes(chan.key) ? 'checked' : ''}>
      <span>${esc(f.emoji)} ${esc(f.name)}</span></label>`).join('');
    const left = Math.max(8, Math.min(rect.left, innerWidth - 288));
    pop.r.innerHTML = `<div class="p" style="left:${left}px;top:${rect.bottom + 8}px">
      <div class="h">${chan.avatar ? `<img class="av" src="${esc(chan.avatar)}" alt="" referrerpolicy="no-referrer">` : ''}<span>Ranger « ${esc(chan.name || chan.key)} »</span></div>
      <div class="list">${list || '<div class="none">Pas encore de dossier : crée le premier ci-dessous.</div>'}</div>
      <form><input placeholder="Nouveau dossier…" maxlength="40"><button>Créer</button></form>
      <button class="link" data-act="manage">Gérer tous les dossiers →</button>
    </div>`;
    const box = pop.r.querySelector('.p');
    const below = innerHeight - rect.bottom - 16, above = rect.top - 16;
    const h = box.offsetHeight;
    if (h > below && above > below) {
      box.style.maxHeight = `${above}px`;
      box.style.top = `${Math.max(8, rect.top - 8 - Math.min(h, above))}px`;
    } else box.style.maxHeight = `${below}px`;
    if (typed && document.activeElement === pop.host) pop.r.querySelector('form input').focus({ preventScroll: true });
  }

  function closePopover() {
    if (!pop) return;
    pop.open = false;
    pop.host.style.setProperty('display', 'none', 'important');
  }

  // ───────────────────────── Gestionnaire (fenêtre) ─────────────────────────
  const MGR_CSS = `
    :host { position:fixed !important; inset:0; z-index:2400; }
    .ov { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:24px; }
    .m { width:min(980px,100%); height:min(680px,100%); background:var(--pop); border-radius:16px; box-shadow:var(--shadow);
      display:flex; flex-direction:column; overflow:hidden; }
    header { display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid var(--line); }
    h2 { margin:0; font-size:20px; font-weight:500; flex:1; }
    .btn { height:36px; padding:0 14px; border-radius:18px; border:0; background:var(--chip); font-size:14px; font-weight:500; white-space:nowrap; }
    .btn:hover { background:var(--chip-h); }
    .btn.pri { background:var(--act-bg); color:var(--act-fg); }
    .x { width:40px; height:40px; border-radius:50%; border:0; background:none; font-size:20px; }
    .x:hover { background:var(--chip); }
    .body { flex:1; display:flex; min-height:0; }
    aside { width:290px; border-right:1px solid var(--line); display:flex; flex-direction:column; min-height:0; }
    .sub { font-size:12px; font-weight:500; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); padding:16px 16px 8px; }
    .folders { flex:1; overflow:auto; padding:0 8px; }
    .f { display:flex; align-items:center; gap:4px; padding:4px; border-radius:10px; border:2px solid transparent; }
    .f:hover { background:var(--chip); }
    .f.sel { background:var(--chip); }
    .f.drop { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 12%, transparent); }
    .grip { width:16px; color:var(--muted); cursor:grab; text-align:center; font-size:12px; user-select:none; flex:none; }
    .emo { width:32px; height:32px; border:0; background:none; border-radius:8px; font-size:18px; flex:none; }
    .emo:hover { background:var(--chip-h); }
    .fname { flex:1; min-width:0; border:1px solid transparent; background:none; border-radius:6px; padding:5px 6px; font-size:14px; outline:none; }
    .fname:hover { border-color:var(--line); }
    .fname:focus { border-color:var(--accent); background:var(--field); }
    .cnt { font-size:12px; color:var(--muted); min-width:18px; text-align:right; }
    .dot { width:16px; height:16px; border-radius:50%; border:0; flex:none; margin:0 4px; }
    .pick { margin:2px 4px 8px 24px; padding:10px; border-radius:10px; background:var(--chip); }
    .emos { display:grid; grid-template-columns:repeat(6,1fr); gap:2px; }
    .emos button { height:32px; border:0; background:none; border-radius:8px; font-size:18px; }
    .emos button:hover, .emos button.on { background:var(--chip-h); }
    .cols { display:flex; gap:6px; align-items:center; margin-top:8px; }
    .cols button { width:20px; height:20px; border-radius:50%; border:2px solid transparent; padding:0; }
    .cols button.on { border-color:var(--fg); }
    .cols .ok { margin-left:auto; width:auto; height:28px; border-radius:14px; padding:0 12px; background:var(--act-bg); color:var(--act-fg); border:0; font-size:13px; font-weight:500; }
    .del { width:28px; height:28px; border:0; background:none; border-radius:50%; opacity:.5; font-size:13px; flex:none; }
    .del:hover { opacity:1; background:var(--chip-h); }
    .newf { display:flex; gap:8px; padding:12px 16px 16px; border-top:1px solid var(--line); }
    .field { flex:1; min-width:0; height:36px; border-radius:8px; border:1px solid var(--line); background:var(--field); padding:0 10px; outline:none; font-size:14px; }
    .field:focus { border-color:var(--accent); }
    .hint { font-size:13px; color:var(--muted); padding:8px 16px; line-height:1.4; }
    section { flex:1; display:flex; flex-direction:column; min-width:0; }
    .tools { display:flex; gap:8px; padding:16px 16px 8px; flex-wrap:wrap; }
    .tools .field { min-width:180px; }
    select.field { flex:0 0 auto; width:auto; max-width:210px; cursor:pointer; }
    .chans { flex:1; overflow:auto; padding:0 8px 16px; }
    .c { display:flex; align-items:center; gap:12px; padding:8px; border-radius:10px; }
    .c:hover { background:var(--chip); }
    .c[draggable=true] { cursor:grab; }
    .c .av { width:36px; height:36px; font-size:14px; }
    .cn { width:200px; min-width:0; flex:none; }
    .nm { font-size:14px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .nm a { color:inherit; text-decoration:none; }
    .nm a:hover { text-decoration:underline; }
    .hd { font-size:12px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pills { flex:1; display:flex; flex-wrap:wrap; gap:6px; }
    .pill { height:26px; padding:0 10px; border-radius:13px; border:1px dashed var(--line); background:none; font-size:12px; color:var(--muted); white-space:nowrap; }
    .pill:hover { border-color:var(--fc); color:var(--fg); }
    .pill.on { border:1px solid var(--fc); background:color-mix(in srgb, var(--fc) 22%, transparent); color:var(--fg); font-weight:500; }
    .pill .rm { opacity:.5; margin-left:2px; font-size:10px; }
    .pill:hover .rm { opacity:1; }
    .addto { max-width:140px; height:26px; border-radius:13px; border:1px dashed var(--line); background:none; color:var(--muted); font-size:12px; padding:0 8px; cursor:pointer; outline:none; }
    .addto:hover, .addto:focus { border-color:var(--accent); color:var(--fg); }
    .addto option { background:var(--pop); color:var(--fg); }
    .forget { width:28px; height:28px; border:0; background:none; border-radius:50%; opacity:0; font-size:12px; color:var(--muted); flex:none; }
    .c:hover .forget { opacity:.7; }
    .forget:hover { opacity:1 !important; background:var(--chip-h); }
    .m { position:relative; }
    .dlg { position:absolute; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; padding:24px; z-index:2; }
    .dlg[hidden] { display:none; }
    .card { background:var(--pop); border-radius:16px; padding:22px 24px 18px; width:min(560px,100%); max-height:100%; overflow:auto; box-shadow:var(--shadow); font-size:14px; line-height:1.45; }
    .card h3 { margin:0 0 8px; font-size:18px; font-weight:500; }
    .card p { margin:8px 0; }
    .card .muted { color:var(--muted); font-size:13px; }
    .plan { list-style:none; margin:12px 0; padding:0; display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:6px; }
    .plan li { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:8px; background:var(--chip); font-size:13px; min-width:0; }
    .plan .n { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
    .plan .e { width:22px; text-align:center; }
    .plan .n { flex:1; }
    .plan .new { font-size:11px; font-weight:500; color:var(--accent); border:1px solid currentColor; border-radius:10px; padding:0 6px; }
    .plan .c { font-variant-numeric:tabular-nums; font-weight:500; min-width:24px; text-align:right; }
    .acts { display:flex; justify-content:flex-end; gap:8px; margin-top:14px; }
    .empty { text-align:center; color:var(--muted); padding:48px 24px; font-size:14px; line-height:1.6; }
    .empty b { color:var(--fg); }
    @media (max-width:720px) { aside { width:220px; } .cn { width:130px; } }
  `;
  let mgr = null;
  let mgrFilter = 'all', mgrQuery = '', pickerFor = null;

  function openManager(filter) {
    closePopover();
    if (!mgr) {
      mgr = makeHost('ytf-manager', MGR_CSS);
      document.documentElement.appendChild(mgr.host);
      shieldKeys(mgr.root, closeManager);
      mgr.r.innerHTML = `
        <div class="ov">
          <div class="m" role="dialog" aria-label="Dossiers d'abonnements">
            <header>
              <h2>📁 Dossiers d'abonnements</h2>
              <button class="btn" data-act="export" title="Sauvegarder tes dossiers dans un fichier">Exporter</button>
              <button class="btn" data-act="importfile" title="Restaurer depuis un fichier">Restaurer</button>
              <button class="x" data-act="close" aria-label="Fermer">✕</button>
            </header>
            <div class="body">
              <aside>
                <div class="sub">Mes dossiers</div>
                <div class="folders"></div>
                <form class="newf"><input class="field" placeholder="Nouveau dossier…" maxlength="40"><button class="btn pri">Créer</button></form>
              </aside>
              <section>
                <div class="tools">
                  <input class="field q" type="search" placeholder="Rechercher une chaîne…">
                  <select class="field filter"></select>
                  <button class="btn" data-act="autosort" title="Ranger automatiquement les chaînes non classées">✨ Tri auto</button>
                  <button class="btn pri" data-act="sync">⬇ Importer mes abonnements</button>
                </div>
                <div class="hint">Range une chaîne avec « ＋ Dossier… », glisse-la sur un dossier à gauche, ou laisse faire ✨ Tri auto.</div>
                <div class="chans"></div>
              </section>
            </div>
            <div class="dlg" hidden></div>
          </div>
          <input type="file" accept="application/json,.json" hidden>
        </div>`;
      const r = mgr.r;
      r.querySelector('.ov').addEventListener('pointerdown', (e) => { if (e.target.classList.contains('ov')) closeManager(); });
      r.querySelector('.q').addEventListener('input', (e) => { mgrQuery = e.target.value; renderChans(); });
      r.querySelector('.filter').addEventListener('change', (e) => { mgrFilter = e.target.value; renderFolders(); renderChans(); });
      r.querySelector('.newf').addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = e.target.querySelector('input');
        if (!inp.value.trim()) return inp.focus();
        const f = createFolder(inp.value);
        inp.value = '';
        mgrFilter = f.id;
        pickerFor = f.id;
        renderManager();
      });
      r.addEventListener('change', (e) => {
        if (e.target.classList.contains('addto') && e.target.value) {
          setInFolder(e.target.value, e.target.dataset.key, true);
          return;
        }
        if (e.target.classList.contains('fname')) {
          const f = folderById(e.target.dataset.id);
          if (f) { f.name = e.target.value.trim().slice(0, 40) || f.name; save(); }
        }
      });
      r.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('fname')) e.target.blur();
      });
      r.addEventListener('click', onMgrClick);
      r.querySelector('input[type=file]').addEventListener('change', onImportFile);

      // Glisser-déposer : chaînes → dossiers, et réordonner les dossiers
      let dragFolder = null;
      r.addEventListener('dragstart', (e) => {
        const c = e.target.closest?.('.c');
        const g = e.target.closest?.('.grip');
        if (g) { dragFolder = g.dataset.id; e.dataTransfer.setData('text/plain', 'f:' + dragFolder); e.dataTransfer.effectAllowed = 'move'; }
        else if (c) { dragFolder = null; e.dataTransfer.setData('text/plain', 'c:' + c.dataset.key); e.dataTransfer.effectAllowed = 'copy'; }
      });
      r.addEventListener('dragover', (e) => {
        const f = e.target.closest?.('.f');
        if (!f) return;
        e.preventDefault();
        r.querySelectorAll('.f.drop').forEach((x) => x !== f && x.classList.remove('drop'));
        f.classList.add('drop');
      });
      r.addEventListener('dragleave', (e) => {
        const f = e.target.closest?.('.f');
        if (f && !f.contains(e.relatedTarget)) f.classList.remove('drop');
      });
      r.addEventListener('drop', (e) => {
        const f = e.target.closest?.('.f');
        r.querySelectorAll('.f.drop').forEach((x) => x.classList.remove('drop'));
        if (!f) return;
        e.preventDefault();
        const payload = e.dataTransfer.getData('text/plain') || '';
        if (payload.startsWith('c:')) setInFolder(f.dataset.id, payload.slice(2), true);
        else if (payload.startsWith('f:')) {
          const from = data.folders.findIndex((x) => x.id === payload.slice(2));
          const to = data.folders.findIndex((x) => x.id === f.dataset.id);
          if (from >= 0 && to >= 0 && from !== to) {
            const [moved] = data.folders.splice(from, 1);
            data.folders.splice(to, 0, moved);
            save();
          }
        }
        dragFolder = null;
      });
    }
    if (filter) mgrFilter = filter;
    learnFromGuide(true);
    mgr.open = true;
    mgr.host.style.setProperty('display', 'block', 'important');
    mgr.prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    setDark();
    renderManager();
  }

  function closeManager() {
    if (!mgr?.open) return;
    mgr.open = false;
    mgr.host.style.setProperty('display', 'none', 'important');
    document.documentElement.style.overflow = mgr.prevOverflow || '';
  }

  function onMgrClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) {
      const row = e.target.closest('.f');
      if (row && !e.target.closest('input')) { mgrFilter = mgrFilter === row.dataset.id ? 'all' : row.dataset.id; renderFolders(); renderChans(); }
      return;
    }
    const f = folderById(b.dataset.id);
    switch (b.dataset.act) {
      case 'close': closeManager(); break;
      case 'emoji': case 'color': pickerFor = pickerFor === b.dataset.id ? null : b.dataset.id; renderFolders(); break;
      case 'setemoji': if (f) { f.emoji = b.dataset.v; save(); } break;
      case 'setcolor': if (f) { f.color = b.dataset.v; save(); } break;
      case 'pickdone': pickerFor = null; renderFolders(); break;
      case 'del':
        if (f && confirm(`Supprimer le dossier « ${f.name} » ?\n(Tu restes abonné à toutes ses chaînes.)`)) {
          data.folders = data.folders.filter((x) => x !== f);
          if (mgrFilter === f.id) mgrFilter = 'all';
          save();
        }
        break;
      case 'pill': setInFolder(b.dataset.id, b.dataset.key); break;
      case 'forget': {
        const k = b.dataset.key;
        delete data.channels[k];
        data.folders.forEach((x) => { x.channels = x.channels.filter((y) => y !== k); });
        save();
        break;
      }
      case 'sync': startImport(); break;
      case 'autosort': autoSort(); break;
      case 'export': exportJson(); break;
      case 'importfile': mgr.r.querySelector('input[type=file]').click(); break;
    }
  }

  function renderManager() {
    if (!mgr?.open) return;
    if (mgrFilter !== 'all' && mgrFilter !== 'none' && !folderById(mgrFilter)) mgrFilter = 'all';
    const sel = mgr.r.querySelector('.filter');
    sel.innerHTML = `<option value="all">Toutes les chaînes</option><option value="none">Non classées</option>` +
      data.folders.map((f) => `<option value="${esc(f.id)}">${esc(f.emoji)} ${esc(f.name)}</option>`).join('');
    sel.value = mgrFilter;
    renderFolders();
    renderChans();
  }

  function renderFolders() {
    const box = mgr.r.querySelector('.folders');
    const focused = mgr.root.activeElement?.classList?.contains('fname') ? mgr.root.activeElement.dataset.id : null;
    if (!data.folders.length) {
      box.innerHTML = `<div class="hint">Aucun dossier pour l'instant.<br>Crée-en un ci-dessous, par exemple <b>🎮 Jeux</b> ou <b>📚 Études</b>.</div>`;
      return;
    }
    box.innerHTML = data.folders.map((f) => `
      <div class="f ${mgrFilter === f.id ? 'sel' : ''}" data-id="${esc(f.id)}">
        <span class="grip" draggable="true" data-id="${esc(f.id)}" title="Glisser pour réordonner">⋮⋮</span>
        <button class="emo" data-act="emoji" data-id="${esc(f.id)}" title="Changer l'emoji">${esc(f.emoji)}</button>
        <input class="fname" data-id="${esc(f.id)}" value="${esc(f.name)}" maxlength="40" title="Renommer">
        <span class="cnt">${f.channels.length}</span>
        <button class="dot" data-act="color" data-id="${esc(f.id)}" style="background:${esc(f.color)}" title="Changer la couleur"></button>
        <button class="del" data-act="del" data-id="${esc(f.id)}" title="Supprimer le dossier">🗑</button>
      </div>${pickerFor === f.id ? `<div class="pick">
        <div class="emos">${EMOJIS.map((e) => `<button class="${e === f.emoji ? 'on' : ''}" data-act="setemoji" data-id="${esc(f.id)}" data-v="${e}">${e}</button>`).join('')}</div>
        <div class="cols">${COLORS.map((c) => `<button class="${c === f.color ? 'on' : ''}" style="background:${c}" data-act="setcolor" data-id="${esc(f.id)}" data-v="${c}" aria-label="Couleur"></button>`).join('')}
        <button class="ok" data-act="pickdone">OK</button></div>
      </div>` : ''}`).join('');
    if (focused) box.querySelector(`.fname[data-id="${CSS.escape(focused)}"]`)?.focus();
    const sel = mgr.r.querySelector('.filter');
    if (sel.value !== mgrFilter) sel.value = mgrFilter;
  }

  function renderChans() {
    const box = mgr.r.querySelector('.chans');
    const keys = new Set(Object.keys(data.channels));
    data.folders.forEach((f) => f.channels.forEach((k) => keys.add(k)));
    const q = norm(mgrQuery);
    let list = [...keys];
    if (mgrFilter === 'none') list = list.filter((k) => !index.allKeys.has(k));
    else if (mgrFilter !== 'all') list = list.filter((k) => index.keys[mgrFilter]?.has(k));
    if (q) list = list.filter((k) => norm(chanName(k)).includes(q) || k.includes(q));
    list.sort((a, b) => chanName(a).localeCompare(chanName(b), 'fr', { sensitivity: 'base' }));

    if (!keys.size) {
      box.innerHTML = `<div class="empty"><b>Aucune chaîne pour l'instant.</b><br>
        Clique sur « ⬇ Importer mes abonnements » pour récupérer la liste complète,<br>
        ou utilise le bouton <b>📁 Ranger</b> qui apparaît sur chaque chaîne et sous chaque vidéo.</div>`;
      return;
    }
    if (!list.length) {
      box.innerHTML = `<div class="empty">${mgrFilter === 'none' ? 'Toutes tes chaînes sont rangées 🎉' : q ? 'Aucune chaîne trouvée.' : 'Ce dossier est vide : glisse des chaînes dessus.'}</div>`;
      return;
    }
    box.innerHTML = list.map((k) => {
      const inF = data.folders.filter((f) => f.channels.includes(k));
      const outF = data.folders.filter((f) => !f.channels.includes(k));
      const pills = !data.folders.length ? '' :
        inF.map((f) => `<button class="pill on" style="--fc:${esc(f.color)}" data-act="pill" data-id="${esc(f.id)}" data-key="${esc(k)}" title="Retirer de ce dossier">${esc(f.emoji)} ${esc(f.name)} <span class="rm">✕</span></button>`).join('') +
        (outF.length ? `<select class="addto" data-key="${esc(k)}" title="Ajouter à un dossier"><option value="">＋ Dossier…</option>${outF.map((f) => `<option value="${esc(f.id)}">${esc(f.emoji)} ${esc(f.name)}</option>`).join('')}</select>` : '');
      return `<div class="c" draggable="true" data-key="${esc(k)}">
        ${avatarHtml(k)}
        <div class="cn"><div class="nm"><a href="${esc(chanUrl(k))}">${esc(chanName(k))}</a></div><div class="hd">${esc(k.startsWith('@') ? k : '')}</div></div>
        <div class="pills">${pills || '<span class="hd">Crée un dossier à gauche pour commencer</span>'}</div>
        <button class="forget" data-act="forget" data-key="${esc(k)}" title="Retirer de la liste">✕</button>
      </div>`;
    }).join('');
  }

  // ───────────────────────── Tri automatique ─────────────────────────
  const preset = () => window.__ytfPreset || { folders: [], byKey: {}, byName: {} };

  function guessFolder(k) {
    const P = preset();
    if (P.byKey[k]) return P.byKey[k];
    const c = data.channels[k] || {};
    const n = norm(c.name);
    if (n && P.byName[n]) return P.byName[n];
    const text = `${c.name || ''} ${c.desc || ''} ${k}`;
    for (const [folder, re] of window.__ytfRules || []) if (re.test(text)) return folder;
    return null;
  }

  function askInManager(html, okLabel) {
    const box = mgr.r.querySelector('.dlg');
    box.innerHTML = `<div class="card">${html}<div class="acts"><button class="btn" data-ans="0">Annuler</button><button class="btn pri" data-ans="1">${esc(okLabel)}</button></div></div>`;
    box.hidden = false;
    box.querySelector('[data-ans="1"]').focus();
    return new Promise((resolve) => {
      box.onclick = (e) => {
        const b = e.target.closest('[data-ans]');
        if (!b && e.target !== box) return;
        box.hidden = true;
        box.onclick = null;
        resolve(b?.dataset.ans === '1');
      };
    });
  }

  async function autoSort() {
    const P = preset();
    const keys = new Set(Object.keys(data.channels));
    data.folders.forEach((f) => f.channels.forEach((k) => keys.add(k)));
    const unsorted = [...keys].filter((k) => !index.allKeys.has(k));
    if (!unsorted.length) return toast('Toutes tes chaînes sont déjà rangées 🎉');

    const plan = new Map();
    let left = 0;
    for (const k of unsorted) {
      const g = guessFolder(k);
      if (!g) { left++; continue; }
      if (!plan.has(g)) plan.set(g, []);
      plan.get(g).push(k);
    }
    if (!plan.size) return toast('Je n’ai trouvé aucun dossier pour tes chaînes non classées.');

    const order = (n) => { const i = P.folders.findIndex((f) => f.name === n); return i < 0 ? 999 : i; };
    const style = (n) => P.folders.find((f) => f.name === n) || { emoji: '📁', color: COLORS[data.folders.length % COLORS.length] };
    const findF = (n) => data.folders.find((f) => norm(f.name) === norm(n));
    const entries = [...plan].sort((a, b) => order(a[0]) - order(b[0]));
    const total = entries.reduce((s, [, ks]) => s + ks.length, 0);
    const created = entries.filter(([n]) => !findF(n)).length;

    const rows = entries.map(([n, ks]) => `<li><span class="e">${esc(style(n).emoji)}</span><span class="n">${esc(n)}</span>` +
      `${findF(n) ? '' : '<span class="new">nouveau</span>'}<span class="c">${ks.length}</span></li>`).join('');
    const ok = await askInManager(`<h3>✨ Tri automatique</h3>
      <p><b>${total}</b> chaîne${total > 1 ? 's' : ''} non classée${total > 1 ? 's' : ''} vont être rangées${created ? `, avec <b>${created}</b> nouveau${created > 1 ? 'x' : ''} dossier${created > 1 ? 's' : ''}` : ''} :</p>
      <ul class="plan">${rows}</ul>
      <p class="muted">Les chaînes déjà rangées ne bougent pas.${left ? ` ${left} chaîne${left > 1 ? 's' : ''} resteront à ranger à la main.` : ''}</p>`, 'Ranger');
    if (!ok) return;

    for (const [n, ks] of entries) {
      let f = findF(n);
      if (!f) {
        const st = style(n);
        f = { id: uid(), name: n, emoji: st.emoji, color: st.color, channels: [], open: false };
        data.folders.push(f);
      }
      for (const k of ks) if (!f.channels.includes(k)) f.channels.push(k);
    }
    save();
    toast(`✨ ${total} chaînes rangées${left ? `, ${left} à ranger à la main` : ''}`);
    mgrFilter = left ? 'none' : 'all';
    renderManager();
  }

  // ───────────────────────── Export / restauration ─────────────────────────
  function exportJson() {
    const blob = new Blob([JSON.stringify({ app: 'ytfolders', version: 1, folders: data.folders, channels: data.channels }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dossiers-youtube-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function onImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = sanitize(JSON.parse(reader.result));
        if (!parsed.folders.length && !Object.keys(parsed.channels).length) throw new Error('vide');
        if (!confirm(`Remplacer tes dossiers actuels par les ${parsed.folders.length} dossiers de ce fichier ?`)) return;
        data = parsed;
        save();
        toast('✅ Dossiers restaurés');
      } catch {
        alert('Ce fichier ne ressemble pas à une sauvegarde de Dossiers d\'abos.');
      }
    };
    reader.readAsText(file);
  }

  // ───────────────────────── Import des abonnements ─────────────────────────
  function scrapeChannels(scope) {
    const out = new Map();
    const add = (k, name, avatar, desc) => {
      if (!k) return;
      const e = out.get(k) || {};
      if (desc && !e.desc) e.desc = desc;
      const n = (name || '').trim().replace(/\s+/g, ' ');
      if (n && !e.name) e.name = n;
      if (avatar && /^https?:/.test(avatar) && !e.avatar) e.avatar = avatar;
      out.set(k, e);
    };
    for (const r of scope.querySelectorAll('ytd-channel-renderer')) {
      const a = [...r.querySelectorAll('a[href]')].find((x) => keyFromHref(x.getAttribute('href')));
      if (a) add(keyFromHref(a.getAttribute('href')), r.querySelector('ytd-channel-name #text, #channel-title #text, #channel-title')?.textContent, r.querySelector('#avatar img, img')?.src, r.querySelector('#description, yt-formatted-string#description')?.textContent);
    }
    for (const r of scope.querySelectorAll('ytd-guide-entry-renderer')) {
      const a = r.querySelector('a[href]');
      const k = a && keyFromHref(a.getAttribute('href'));
      if (k) add(k, a.getAttribute('title') || r.querySelector('.title, yt-formatted-string')?.textContent, r.querySelector('img')?.src);
    }
    if (!out.size) {
      for (const a of scope.querySelectorAll('a[href]')) {
        const k = keyFromHref(a.getAttribute('href'));
        if (!k) continue;
        const t = a.getAttribute('title') || a.textContent.trim();
        add(k, t.length < 60 && !t.includes('\n') ? t : '', a.querySelector('img')?.src);
      }
    }
    return out;
  }

  let lastLearn = 0;
  function learnFromGuide(force) {
    if (!force && Date.now() - lastLearn < 15000) return;
    lastLearn = Date.now();
    // La section « Abonnements » est celle qui contient le plus de liens vers des chaînes
    let best = null, bestN = 0;
    for (const s of document.querySelectorAll('ytd-guide-renderer ytd-guide-section-renderer')) {
      const n = [...s.querySelectorAll('ytd-guide-entry-renderer a[href]')].filter((a) => keyFromHref(a.getAttribute('href'))).length;
      if (n > bestN) { best = s; bestN = n; }
    }
    if (!best || bestN < 2) return 0;
    let changed = 0;
    for (const [k, v] of scrapeChannels(best)) if (upsertChannel(k, v.name, v.avatar)) changed++;
    if (changed) save();
    return changed;
  }

  function startImport() {
    closeManager();
    sessionStorage.setItem('ytf-import', '1');
    if (isChannelsPage()) return runImport();
    location.assign('/feed/channels');
  }

  async function runImport() {
    sessionStorage.removeItem('ytf-import');
    toast('Importation de tes abonnements…', 0);
    let browse = null;
    for (let i = 0; i < 40 && !browse; i++) {
      browse = document.querySelector('ytd-browse[page-subtype="channels"]:not([hidden])');
      if (!browse) await sleep(250);
    }
    if (!browse) return toast('⚠️ Impossible de lire la liste des abonnements.');
    let last = -1, stable = 0;
    for (let i = 0; i < 120 && stable < 4; i++) {
      const n = scrapeChannels(browse).size;
      toast(`Importation… ${n} chaîne${n > 1 ? 's' : ''} trouvée${n > 1 ? 's' : ''}`, 0);
      stable = n === last ? stable + 1 : 0;
      last = n;
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(700);
    }
    const found = scrapeChannels(browse);
    let added = 0;
    for (const [k, v] of found) { if (!data.channels[k]) added++; upsertChannel(k, v.name, v.avatar, v.desc); }
    await save();
    window.scrollTo(0, 0);
    toast(`✅ ${found.size} abonnements importés${added ? ` (${added} nouveaux)` : ''}`);
    openManager('none');
  }

  // ───────────────────────── Toast ─────────────────────────
  let toastBox = null, toastTimer = 0;
  function toast(msg, ms = 3500) {
    if (!toastBox) {
      toastBox = makeHost('ytf-toast', `:host{position:fixed!important;left:24px;bottom:24px;z-index:2500}
        .t{background:#323232;color:#fff;padding:12px 18px;border-radius:8px;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.3)}`);
      document.documentElement.appendChild(toastBox.host);
    }
    toastBox.r.innerHTML = `<div class="t">${esc(msg)}</div>`;
    toastBox.host.style.setProperty('display', 'block', 'important');
    clearTimeout(toastTimer);
    if (ms) toastTimer = setTimeout(() => toastBox.host.style.setProperty('display', 'none', 'important'), ms);
  }

  // ───────────────────────── Boucle principale ─────────────────────────
  function setDark() {
    const dark = document.documentElement.hasAttribute('dark');
    for (const h of [bar, side, cb, pop, mgr]) if (h) h.host.toggleAttribute('dark', dark);
  }

  function renderAll() {
    renderBar();
    renderSide();
    if (cb) { cbSig = ''; ensureChanBtn(); }
    renderPopover();
    if (mgr?.open) renderManager();
    applyFilter();
  }

  function refresh() {
    if (!ready) return;
    if (!alive()) { observer.disconnect(); return; }
    ensureSidebar();
    if (isSubsPage()) ensureBar();
    applyFilter();
    ensureChanBtn();
    learnFromGuide(false);
    setDark();
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; refresh(); }, 250);
  };
  const observer = new MutationObserver(schedule);

  function checkHash() {
    const h = location.hash;
    if (!h.startsWith('#ytf-')) return;
    history.replaceState(history.state, '', location.pathname + location.search);
    if (h.startsWith('#ytf-folder=')) goFolder(decodeURIComponent(h.slice(12)));
    else if (h === '#ytf-manage') openManager();
  }

  function onNavigate() {
    closePopover();
    sideSig = '';
    schedule();
    checkHash();
    if (sessionStorage.getItem('ytf-import') && isChannelsPage()) runImport();
  }

  document.addEventListener('yt-navigate-finish', onNavigate);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (mgr?.open) { closeManager(); e.stopPropagation(); }
    else if (pop?.open) { closePopover(); e.stopPropagation(); }
  }, true);
  window.addEventListener('hashchange', checkHash);

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg?.type === 'manage') openManager();
    else if (msg?.type === 'folder') goFolder(msg.id);
    reply({ ok: true });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(changes.folders || changes.channels)) return;
    chrome.storage.local.get(['folders', 'channels']).then((raw) => {
      data = sanitize(raw);
      rebuildIndex();
      renderAll();
    });
  });

  chrome.storage.local.get(['folders', 'channels']).then((raw) => {
    data = sanitize(raw);
    rebuildIndex();
    ready = true;
    observer.observe(document.documentElement, { childList: true, subtree: true });
    refresh();
    onNavigate();
  });
})();
