function openDrawer() { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerBackdrop').hidden = false; }
function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerBackdrop').hidden = true; }
function toggleDrawer() { document.getElementById('drawer').classList.contains('open') ? closeDrawer() : openDrawer(); }

function openSettings() { document.getElementById('settingsModal').hidden = false; document.getElementById('settingsCloseBtn').focus(); }
function closeSettings() { document.getElementById('settingsModal').hidden = true; const g = document.getElementById('settingsGearBtn'); if (g) g.focus(); }

function setAppTheme(t) {
  theme = t; document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('.seg-btn[data-theme]').forEach(b => {
    const on = b.dataset.theme === t;
    b.classList.toggle('active', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  const sw = document.getElementById('themeSwitch');
  if (sw) sw.setAttribute('aria-checked', t === 'dark' ? 'true' : 'false');
  savePref('theme', t);
}
function toggleTheme() { setAppTheme(theme === 'dark' ? 'light' : 'dark'); }

function updateLayoutButtons() {
  document.querySelectorAll('.layout-btn').forEach(b => {
    const on = b.dataset.layout === layout;
    b.classList.toggle('active', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}
function setLayout(l) {
  layout = l; savePref('layout', l); updateLayoutButtons();
  if (typeof renderReaderBody === 'function' && currentArticle) renderReaderBody(currentArticle);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#menuBtn')) { toggleDrawer(); return; }
  if (e.target.closest('#drawerCloseBtn')) { closeDrawer(); return; }
  if (e.target.classList && e.target.classList.contains('drawer-backdrop')) { closeDrawer(); return; }
  if (e.target.closest('#themeSwitch')) { toggleTheme(); return; }
  if (e.target.closest('#settingsGearBtn') || e.target.closest('#settingsOpenBtn')) { openSettings(); return; }
  if (e.target.closest('#settingsCloseBtn')) { closeSettings(); return; }
  if (e.target.classList && e.target.classList.contains('modal-backdrop')) { closeSettings(); return; }

  const seg = e.target.closest('.seg-btn[data-theme]');
  if (seg) { setAppTheme(seg.dataset.theme); return; }
  const layoutBtn = e.target.closest('.layout-btn');
  if (layoutBtn) { setLayout(layoutBtn.dataset.layout); return; }

  const navBtn = e.target.closest('[data-view]');
  if (navBtn) navigateTo(navBtn.dataset.view, navBtn.dataset.cat);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('settingsModal').hidden) { closeSettings(); return; }
  if (document.getElementById('drawer').classList.contains('open')) closeDrawer();
});

window.addEventListener('DOMContentLoaded', () => {
  setAppTheme(theme);
  updateLayoutButtons();
});

window.addEventListener('pageshow', (e) => {
  if (e.persisted) setAppTheme(loadPref('theme', 'light'));
});

window.addEventListener('storage', (e) => {
  if (e.key === 'skimfeed_theme') setAppTheme(loadPref('theme', 'light'));
});
