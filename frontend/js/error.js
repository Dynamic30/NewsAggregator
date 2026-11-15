function loadPref(k, f) { try { const v = localStorage.getItem('skimfeed_' + k); return v !== null ? JSON.parse(v) : f; } catch (e) { return f; } }
function savePref(k, v) { try { localStorage.setItem('skimfeed_' + k, JSON.stringify(v)); } catch (e) {} }

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeSwitch').setAttribute('aria-checked', t === 'dark' ? 'true' : 'false');
  savePref('theme', t);
}

setTheme(loadPref('theme', 'light'));

document.getElementById('themeSwitch').addEventListener('click', () => {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
document.getElementById('homeBtn').addEventListener('click', () => {
  savePref('view', 'top');
  savePref('viewCat', null);
});
document.getElementById('backBtn').addEventListener('click', () => {
  if (history.length > 1) history.back(); else location.href = '/';
});

const path = location.pathname;
if (path && path !== '/' && !path.endsWith('/error.html')) {
  const el = document.getElementById('errorPath');
  el.textContent = path;
  el.hidden = false;
}
