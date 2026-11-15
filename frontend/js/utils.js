let theme = loadPref('theme', 'light');
let readingTheme = loadPref('readingTheme', 'light');
let readingIntensity = loadPref('readingIntensity', { light: 30, sepia: 50, dark: 50 });
let fontSize = loadPref('fontSize', 18);
let layout = loadPref('layout', 'standard');
let currentView = loadPref('view', 'top');
let currentCat = loadPref('viewCat', null);
let currentArticle = null;

function savePref(k, v) { try { localStorage.setItem('skimfeed_' + k, JSON.stringify(v)); } catch (e) {} }
function loadPref(k, f) { try { const v = localStorage.getItem('skimfeed_' + k); return v !== null ? JSON.parse(v) : f; } catch (e) { return f; } }
function announce(t) { const el = document.getElementById('liveRegion'); if (el) el.textContent = t; }
function svgIcon(cat) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[cat] || ICONS.National) + '</svg>'; }
function catVar(cat) { return CAT_VAR[cat] || 'var(--accent)'; }
function dateText() { return new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
function timeAgo(a) {
  const h = a.hoursAgo;
  if (h >= 1e6) return '';
  const minutes = Math.floor(h * 60);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  if (h < 24) return Math.floor(h) + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}
function sourceLabel(a) { return a.impact + (a.impact === 1 ? ' source' : ' sources'); }
function emptyNote(text) { return '<p class="fallback-note">' + text + '</p>'; }
function errorNote() { return '<p class="fallback-note">Could not load this right now. <button class="retry-btn" data-retry>Retry</button></p>'; }
function catLabel(cat) { return esc(CAT_LABEL[cat] || cat); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function plainText(s) {
  return s ? new DOMParser().parseFromString(s, 'text/html').body.textContent.trim() : '';
}
function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
function mediaImg(a) {
  const src = safeUrl(a.image_url);
  return src ? '<img class="media-img" src="' + esc(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '';
}
function renderMarkdown(md) {
  if (window.marked && window.DOMPurify) return DOMPurify.sanitize(marked.parse(md));
  return md.split(/\n{2,}/).filter(p => p.trim()).map(p => '<p>' + esc(p) + '</p>').join('');
}
if (window.DOMPurify) {
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
  });
}

// 5 bands around 50: <30, 30-44, 45-55, 56-70, >70
function scoreBucket(v) { return v < 30 ? 0 : v < 45 ? 1 : v <= 55 ? 2 : v <= 70 ? 3 : 4; }
// little 0-100 track: tick at 50, dot at the score
function scoreTrack(v) {
  return '<span class="score-track" title="' + v + ' / 100"><i class="score-mid"></i><i class="score-dot" style="left:' + v + '%;background:var(--lean-' + scoreBucket(v) + ')"></i></span>';
}
