const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SUBS = 'https://www.youtube.com/feed/subscriptions';

// Essaie de parler à l'onglet YouTube actif ; sinon ouvre un nouvel onglet.
async function sendOrOpen(msg, url) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const r = await chrome.tabs.sendMessage(tab.id, msg);
      if (r?.ok) return window.close();
    }
  } catch { /* pas un onglet YouTube */ }
  await chrome.tabs.create({ url });
  window.close();
}

function render({ folders = [], channels = {} }) {
  const n = Object.keys(channels).length;
  $('sum').textContent = `${folders.length} dossier${folders.length > 1 ? 's' : ''} · ${n} chaîne${n > 1 ? 's' : ''} connue${n > 1 ? 's' : ''}`;
  $('list').innerHTML = folders.length
    ? folders.map((f) => `<button class="f" data-id="${esc(f.id)}"><span class="e">${esc(f.emoji)}</span><span class="n">${esc(f.name)}</span>
        <span class="c">${f.channels.length}</span><span class="d" style="background:${esc(f.color)}"></span></button>`).join('')
    : `<div class="empty">Aucun dossier pour l'instant.<br>Clique sur « Gérer les dossiers » pour créer le premier.</div>`;
}

$('list').addEventListener('click', (e) => {
  const b = e.target.closest('.f');
  if (b) sendOrOpen({ type: 'folder', id: b.dataset.id }, `${SUBS}#ytf-folder=${encodeURIComponent(b.dataset.id)}`);
});
$('manage').onclick = () => sendOrOpen({ type: 'manage' }, `${SUBS}#ytf-manage`);
$('subs').onclick = () => sendOrOpen({ type: 'folder', id: 'all' }, SUBS);

chrome.storage.local.get(['folders', 'channels']).then(render);
