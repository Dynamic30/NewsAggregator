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
function agoSuffix(a) { return timeAgo(a) ? ' &middot; ' + timeAgo(a) : ''; }
function sourceLabel(a) { return a.impact + (a.impact === 1 ? ' source' : ' sources'); }
function sourcesBadge(a) {
  return '<span class="card-sources' + (a.impact > 1 ? ' multi' : '') + '" title="Covered by ' + sourceLabel(a) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>' + sourceLabel(a) + '</span>';
}
function emptyNote(text) { return '<p class="fallback-note">' + text + '</p>'; }
function errorNote() { return '<p class="fallback-note">Could not load this right now. <button class="retry-btn" data-retry>Retry</button></p>'; }
function catLabel(cat) { return esc(CAT_LABEL[cat] || cat); }

const SK_STATUS = '<span class="sr-only" role="status">Loading</span>';
function sk(width, height, style) {
  return '<i class="skeleton" aria-hidden="true" style="width:' + width + ';height:' + height + ';' + (style || '') + '"></i>';
}
function skc(cls) { return '<i class="skeleton ' + cls + '" aria-hidden="true"></i>'; }
function skLines(count, height, gap, lastWidth) {
  let html = '';
  for (let i = 0; i < count; i++) html += sk(i === count - 1 ? lastWidth : '100%', height, 'margin-bottom:' + gap + 'px');
  return html;
}
function repeatHTML(count, html) { return Array(count).fill(html).join(''); }

function skeletonTopGrid() {
  const byline = '<div class="tn-byline">' + skc('tn-avatar') + sk('45%', '10px') + '</div>';
  const card = (variant, withPhoto, titleLines, descLines) =>
    '<div class="tn-card tn-' + variant + '">' + (withPhoto ? skc('tn-photo') : '') + sk('45%', '10px', 'margin-bottom:8px') +
      (variant === 'hero' ? skLines(titleLines, '24px', 6, '70%') : skLines(titleLines, '17px', 5, '70%')) +
      skLines(descLines, '12px', 9, '85%') + byline + '</div>';
  return SK_STATUS +
    '<div class="tn-col">' + card('med', true, 2, 4) + card('mini', false, 2, 3) + '</div>' +
    '<div class="tn-col tn-center">' + card('hero', true, 3, 3) + '</div>' +
    '<div class="tn-col">' + sk('100%', '170px', 'border-radius:14px') + card('med', true, 2, 4) + '</div>';
}
function skeletonTopMore() {
  const card = '<div class="tn-more-card">' + skc('tn-more-thumb') + '<div style="flex:1">' + sk('40%', '9px', 'margin-bottom:6px') + skLines(2, '15px', 5, '65%') + '</div></div>';
  return repeatHTML(6, card);
}
function skeletonCards(count) {
  const card = '<div class="card">' + skc('thumb') + '<div class="card-body" style="flex:1">' + sk('40%', '11px', 'margin-bottom:6px') + sk('80%', '18px', 'margin-bottom:6px') + skLines(2, '12px', 6, '60%') + '</div></div>';
  return repeatHTML(count, card);
}
function skeletonList() { return SK_STATUS + skeletonCards(8); }
function skeletonTopics() {
  const card = '<div class="ov-card">' + skc('ov-photo') + sk('35%', '10px', 'margin-bottom:6px') + skLines(2, '15px', 5, '70%') + '</div>';
  const block = '<section class="topics-ov-block"><div class="topics-ov-head"><span class="topics-ov-h2">' + sk('10px', '10px', 'border-radius:50%') + sk('180px', '22px') + '</span>' + sk('70px', '12px') + '</div>' +
    '<div class="topics-ov-grid">' + repeatHTML(3, card) + '</div></section>';
  return SK_STATUS + repeatHTML(4, block);
}
function skeletonCarousel() {
  return SK_STATUS + '<div class="carousel-viewport"><div class="car-slide">' + skc('slide-image') +
    '<div class="slide-content" style="flex:1">' + sk('40%', '10px', 'margin-bottom:10px') + skLines(2, '26px', 6, '65%') + skLines(3, '12px', 8, '80%') + '</div></div></div>';
}
function skeletonSources() {
  const card = '<div class="src-card">' + sk('38px', '38px', 'border-radius:50%;flex:none') + '<div class="src-card-main">' + sk('55%', '14px', 'margin-bottom:6px') + sk('35%', '11px') + '</div>' +
    '<div class="src-lean">' + sk('120px', '11px', 'margin-bottom:8px') + sk('150px', '5px') + '</div></div>';
  return SK_STATUS + '<div class="lean-summary"><div class="lean-summary-top">' + sk('240px', '20px') + sk('200px', '12px') + '</div>' +
    sk('100%', '10px', 'border-radius:999px;margin-bottom:14px') + '<div class="lean-chips">' + repeatHTML(6, sk('96px', '30px', 'border-radius:999px')) + '</div></div>' +
    '<div class="src-grid">' + repeatHTML(8, card) + '</div>';
}

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
