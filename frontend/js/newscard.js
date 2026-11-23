function navigateTo(view, cat) {
  savePref('view', view);
  savePref('viewCat', cat || null);
  location.href = '/';
}

function goBack() {
  const cameFromSite = document.referrer && new URL(document.referrer).origin === location.origin;
  if (cameFromSite) history.back(); else location.href = '/';
}

document.addEventListener('click', (e) => {
  const switchBtn = e.target.closest('[data-switch-id]');
  if (switchBtn) { switchSource(parseInt(switchBtn.dataset.switchId, 10)); return; }

  const openBtn = e.target.closest('[data-open-id]');
  if (openBtn) { openArticle(parseInt(openBtn.dataset.openId, 10)); return; }

  if (e.target.closest('[data-go-top]')) { navigateTo('top'); return; }
  if (e.target.closest('.back-btn')) { goBack(); return; }

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

window.addEventListener('DOMContentLoaded', () => {
  openArticle(parseInt(location.pathname.slice(ARTICLE_PATH.length), 10));
});
