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
function navigateTo(view, cat) { showView(view, cat); }

document.addEventListener('click', (e) => {
  const leanBtn = e.target.closest('[data-lean]');
  if (leanBtn) { leanFilter = leanBtn.dataset.lean; renderSourceList(); return; }

  if (e.target.closest('[data-retry]')) { showView(currentView, currentCat); return; }
  const moreBtn = e.target.closest('[data-more]');
  if (moreBtn) { loadMore(moreBtn.dataset.more === 'allList' ? latestPager : topicPager); return; }

  if (e.target.closest('.car-prev')) { stopAuto(); prevSlide(); return; }
  if (e.target.closest('.car-next')) { stopAuto(); nextSlide(); return; }
  const dot = e.target.closest('.car-dot');
  if (dot) { stopAuto(); goSlide(parseInt(dot.dataset.slide, 10)); return; }
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
  showView(currentView || 'top', currentCat);
});
