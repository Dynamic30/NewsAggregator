// ---------- drawer ----------
function openDrawer() { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerBackdrop').hidden = false; }
function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerBackdrop').hidden = true; }
function toggleDrawer() { document.getElementById('drawer').classList.contains('open') ? closeDrawer() : openDrawer(); }
// ---------- view switching ----------
function setActiveNav(view, cat) {
  const topKey = view === 'topic' ? 'topics' : view;
  document.querySelectorAll('.topnav-links .navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === topKey));
  document.querySelectorAll('.drawer [data-view]').forEach(b => {
    const match = b.dataset.view === view && (view !== 'topic' || b.dataset.cat === cat);
    b.classList.toggle('active', match);
  });
}
function showView(view, cat) {
  if (view === 'topic' && TOPICS.indexOf(cat) < 0) { view = 'top'; cat = null; }
  stopAuto();
  closeDrawer();
  document.getElementById('articleView').hidden = true;
  document.getElementById('topView').hidden = view !== 'top';
  document.getElementById('allView').hidden = view !== 'all';
  document.getElementById('topicsView').hidden = view !== 'topics';
  document.getElementById('topicView').hidden = view !== 'topic';
  document.getElementById('sourcesView').hidden = view !== 'sources';
  if (view === 'sources') renderSources();
  else if (view === 'top') renderTopNews();
  else if (view === 'all') renderAllNews();
  else if (view === 'topics') renderTopicsOverview();
  else if (view === 'topic') renderTopic(cat);
  currentView = view; currentCat = cat || null;
  setActiveNav(view, cat);
  savePref('view', view); savePref('viewCat', currentCat);
  window.scrollTo(0, 0);
  announce((view === 'topic' ? CAT_LABEL[cat] : view) + ' view');
}
// ---------- settings modal ----------
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
// ---------- delegated events ----------
document.addEventListener('click', (e) => {
  if (e.target.closest('#menuBtn')) { toggleDrawer(); return; }
  if (e.target.closest('#drawerCloseBtn')) { closeDrawer(); return; }
  if (e.target.classList && e.target.classList.contains('drawer-backdrop')) { closeDrawer(); return; }
  if (e.target.closest('#themeSwitch')) { toggleTheme(); return; }
  if (e.target.closest('#settingsGearBtn')) { openSettings(); return; }

  const leanBtn = e.target.closest('[data-lean]');
  if (leanBtn) { leanFilter = leanBtn.dataset.lean; renderSourceList(); return; }

  const openBtn = e.target.closest('[data-open-id]');
  if (openBtn) { openArticle(parseInt(openBtn.dataset.openId, 10)); return; }

  if (e.target.closest('[data-retry]')) { showView(currentView, currentCat); return; }
  const moreBtn = e.target.closest('[data-more]');
  if (moreBtn) { loadMore(moreBtn.dataset.more === 'allList' ? latestPager : topicPager); return; }

  // any nav target (top bar, drawer, topics-overview heading)
  const navBtn = e.target.closest('[data-view]');
  if (navBtn) { showView(navBtn.dataset.view, navBtn.dataset.cat); return; }

  if (e.target.closest('.car-prev')) { stopAuto(); prevSlide(); return; }
  if (e.target.closest('.car-next')) { stopAuto(); nextSlide(); return; }
  const dot = e.target.closest('.car-dot');
  if (dot) { stopAuto(); goSlide(parseInt(dot.dataset.slide, 10)); return; }

  const story = e.target.closest('.tn-card, .tn-more-card, .car-slide, .card, .ov-card');
  if (story) { e.preventDefault(); openArticle(parseInt(story.dataset.id, 10)); return; }

  if (e.target.closest('#settingsOpenBtn')) { openSettings(); return; }
  if (e.target.closest('#settingsCloseBtn')) { closeSettings(); return; }
  if (e.target.classList && e.target.classList.contains('modal-backdrop')) { closeSettings(); return; }

  const seg = e.target.closest('.seg-btn[data-theme]');
  if (seg) { setAppTheme(seg.dataset.theme); return; }
  const layoutBtn = e.target.closest('.layout-btn');
  if (layoutBtn) { setLayout(layoutBtn.dataset.layout); return; }

  if (e.target.closest('.back-btn')) { closeArticle(); return; }
  const fontBtn = e.target.closest('.tool-btn[data-delta]');
  if (fontBtn) { changeFontSize(parseInt(fontBtn.dataset.delta, 10)); return; }
  const themeSwap = e.target.closest('.theme-swap');
  if (themeSwap) { setReadingTheme(themeSwap.dataset.theme); return; }
  if (e.target.closest('#intensityToggle')) { toggleIntensity(); return; }
  if (e.target.closest('#speechBtn')) { toggleSpeech(); return; }
});

document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'intensitySlider') setReadingIntensity(parseInt(e.target.value, 10));
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('settingsModal').hidden) { closeSettings(); return; }
  if (document.getElementById('drawer').classList.contains('open')) closeDrawer();
});

// pause carousel auto-rotate while hovered
const carEl = document.getElementById('topicCarousel');
carEl.addEventListener('mouseenter', stopAuto);
carEl.addEventListener('mouseleave', startAuto);

// touch swipe (mobile has no arrows) — horizontal drag flips the slide
let touchStartX = 0, touchStartY = 0;
carEl.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; stopAuto(); }, { passive: true });
carEl.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? nextSlide() : prevSlide(); }
}, { passive: true });

window.addEventListener('DOMContentLoaded', () => {
  setAppTheme(theme);
  updateLayoutButtons();
  showView(currentView || 'top', currentCat);
});
