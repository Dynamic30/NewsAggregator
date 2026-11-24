let readerToken = 0;
const readerCards = new Map();
const PANEL_MIN_MS = 500;

const LEAN_GROUPS = [['government', 'Government'], ['opposition', 'Opposition'], ['public', 'Public'], ['business', 'Business']];

function reasonsHTML(breakdown) {
  return LEAN_GROUPS.map(([key, label]) => {
    const group = breakdown && breakdown[key];
    if (!group || (group.score == null && !group.reason)) return '';
    const score = group.score == null ? '' : Math.round(group.score);
    return '<div class="why-row"><span class="why-group">' + label + '</span>' +
      (score === '' ? '' : '<span class="why-score" style="color:var(--lean-' + scoreBucket(score) + ')">' + score + '</span>') +
      (group.reason ? '<span class="why-text">' + esc(group.reason) + '</span>' : '') + '</div>';
  }).join('');
}
function sourcesHTML(card) {
  const a = card.article, list = card.cluster.sources;
  const item = s => {
    const scored = s.political_lean_score !== null;
    const score = Math.round(s.political_lean_score);
    const reasons = scored ? reasonsHTML(s.lean_breakdown) : '';
    const panelId = 'why-' + s.article_id;
    const original = safeUrl(s.url);
    return '<li><div class="src-row"><button class="src-item src-open' + (s.article_id === a.id ? ' current' : '') + '" data-switch-id="' + s.article_id + '">' +
      '<span class="src-badge">' + esc(s.source.charAt(0)) + '</span>' +
      '<span class="src-main"><span class="src-name">' + esc(s.source) + (s.is_default ? '<span class="src-primary">Primary</span>' : '') + '</span>' +
        (scored ? scoreTrack(score) : '<span class="src-unscored">Not scored yet</span>') + '</span>' +
      (scored ? '<span class="src-score" style="color:var(--lean-' + scoreBucket(score) + ')">' + score + '</span>' : '') +
    '</button>' +
    (reasons ? '<button class="src-why" data-why aria-expanded="false" aria-controls="' + panelId + '" aria-label="Why ' + esc(s.source) + ' scored ' + score + '">Why?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>' : '') +
    (original ? '<a class="src-ext" href="' + esc(original) + '" target="_blank" rel="noopener noreferrer" aria-label="Open original at ' + esc(s.source) + '" title="Open original"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="rotate(-45 12 12)"><rect x="1.5" y="8" width="12" height="8" rx="4"/><rect x="10.5" y="8" width="12" height="8" rx="4"/></g></svg></a>' : '') +
    '</div>' + (reasons ? '<div class="src-reasons" id="' + panelId + '" hidden>' + reasons + '</div>' : '') + '</li>';
  };
  return '<div class="sources-head"><span class="sources-label">Sources we found it on</span><span class="sources-count">' + list.length + '</span></div>' +
    '<ul class="sources-list">' + list.map(item).join('') + '</ul>' +
    (list.some(s => s.political_lean_score !== null) ? '<p class="sources-key"><span>Opposition</span><span>Neutral 50</span><span>Government</span></p>' : '');
}
function toggleWhy(button) {
  const open = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', open);
  document.getElementById(button.getAttribute('aria-controls')).hidden = !open;
}
function leadSplit(card) {
  const description = card.article.description, summary = card.cluster.summary;
  const main = description || summary
    ? '<div class="lead-col lead-main" tabindex="0" role="region" aria-label="Story description">' +
        (description ? '<p class="lead-desc">' + esc(description) + '</p>' : '') +
        (summary ? '<p class="cluster-summary"><span class="sources-label">How outlets covered it</span>' + esc(summary) + '</p>' : '') +
      '</div>'
    : '';
  return '<div class="lead-split' + (main ? '' : ' single') + '">' + main + '<div class="lead-col lead-sources">' + sourcesHTML(card) + '</div></div>';
}
function textBox() {
  return '<div class="text-box" id="textBox">' +
    '<div class="reader-controls">' +
      '<div class="text-toolbar">' +
        '<div class="tool-group">' +
          '<button class="tool-btn" data-delta="-2" aria-label="Decrease text size">A&minus;</button>' +
          '<button class="tool-btn" data-delta="2" aria-label="Increase text size">A+</button>' +
        '</div>' +
        '<div class="tool-group">' +
          '<div class="theme-swaps" role="radiogroup" aria-label="Reading theme">' +
            '<button class="theme-swap" role="radio" data-theme="light" aria-label="Light"><span class="swatch-dot swatch-light"></span><span class="swap-label">Light</span></button>' +
            '<button class="theme-swap" role="radio" data-theme="sepia" aria-label="Sepia"><span class="swatch-dot swatch-sepia"></span><span class="swap-label">Sepia</span></button>' +
            '<button class="theme-swap" role="radio" data-theme="dark" aria-label="Dark"><span class="swatch-dot swatch-dark"></span><span class="swap-label">Dark</span></button>' +
          '</div>' +
          '<button class="dots-btn" id="intensityToggle" aria-label="Adjust depth"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button>' +
        '</div>' +
        '<button id="speechBtn" class="tool-btn-wide">Listen</button>' +
      '</div>' +
      '<div class="intensity-row" id="intensityRow" hidden>' +
        '<span class="intensity-label" id="intensityLabel">Depth</span>' +
        '<input type="range" min="0" max="100" class="intensity-slider" id="intensitySlider" aria-label="Theme depth">' +
        '<span class="intensity-val" id="intensityVal"></span>' +
      '</div>' +
    '</div>' +
    '<div class="text-content" id="articleContent"></div>' +
  '</div>';
}
function readerHeadHTML(a) {
  const original = safeUrl(a.url);
  return '<div class="reader-meta"><span class="cat-label" style="color:' + catVar(a.category) + '">' + catLabel(a.category) + '</span><span>&middot;</span><span>' + esc(a.source) + '</span>' +
      (timeAgo(a) ? '<span>&middot;</span><span>' + timeAgo(a) + '</span>' : '') +
      (original ? '<span>&middot;</span><a class="reader-original" href="' + esc(original) + '" target="_blank" rel="noopener noreferrer">Original</a>' : '') + '</div>' +
    '<h2 class="reader-title">' + esc(a.title) + '</h2>';
}
function readerPhotoHTML(a) {
  const size = layout === 'compact' ? ' small' : '';
  const src = safeUrl(a.image_url);
  return src
    ? '<figure class="reader-photo' + size + '"><img src="' + esc(src) + '" alt="" referrerpolicy="no-referrer" onerror="this.closest(\'figure\').remove()"></figure>'
    : '<div class="reader-image' + size + '" style="background:' + catVar(a.category) + '">' + svgIcon(a.category) + '</div>';
}
function fillReader(card) {
  currentArticle = card;
  const a = card.article;
  document.getElementById('rdHead').innerHTML = readerHeadHTML(a);
  document.getElementById('rdPhoto').innerHTML = readerPhotoHTML(a);
  document.getElementById('rdLead').innerHTML = leadSplit(card);
  document.getElementById('articleContent').innerHTML = a.markdown ? renderMarkdown(a.markdown) : emptyNote('The full text is not available yet.');
  applyFontSize();
  ['rdHead', 'rdPhoto', 'rdLead', 'articleContent'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('reader-fade');
    void el.offsetWidth;
    el.classList.add('reader-fade');
  });
}
function renderReaderBody(card) {
  const head = '<div id="rdHead"></div>', photo = '<div id="rdPhoto"></div>';
  document.getElementById('readerBody').innerHTML =
    '<div id="rdNotice"></div>' + (layout === 'classic' ? photo + head : head + photo) + '<div id="rdLead"></div>' + textBox();
  fillReader(card);
  applyReadingTheme();
}
function loadCard(id) {
  if (!readerCards.has(id)) {
    const request = getJSON('/news_card/' + id).then(card => {
      card.article = normaliseArticle(card.article);
      return card;
    });
    readerCards.set(id, request);
    request.catch(() => readerCards.delete(id));
  }
  return readerCards.get(id);
}
function readerSkeleton() {
  const colors = readingColors(readingTheme, currentIntensity());
  const small = layout === 'compact';
  const head = '<div style="margin-bottom:12px">' + sk('45%', '11px', 'margin-bottom:10px') + skLines(2, '32px', 12, '60%') + '</div>';
  const photo = sk(small ? '240px' : '100%', small ? '170px' : '240px', 'border-radius:18px;margin-bottom:' + (small ? '20px' : '24px'));
  const source = '<div class="src-item" style="margin-bottom:11px">' + sk('24px', '24px', 'border-radius:50%;flex-shrink:0') + '<span class="src-main">' + sk('50%', '12px', 'margin-bottom:6px') + sk('100%', '5px') + '</span></div>';
  const lead = '<div class="lead-split"><div class="lead-col lead-main">' + skLines(4, '16px', 10, '55%') + '</div>' +
    '<div class="lead-col"><div class="sources-head">' + sk('140px', '11px') + sk('24px', '18px', 'border-radius:999px') + '</div>' + repeatHTML(3, source) + '</div></div>';
  const box = '<div class="text-box" style="--rt-bg:' + colors.bg + ';--rt-fg:' + colors.fg + ';--rt-line:' + colors.line + '">' +
    '<div class="reader-controls"><div class="text-toolbar">' + sk('96px', '38px', 'border-radius:999px') + sk('230px', '38px', 'border-radius:999px') + sk('74px', '38px', 'border-radius:999px') + '</div></div>' +
    '<div class="text-content">' + repeatHTML(3, '<div style="margin-bottom:18px">' + skLines(5, '14px', 16, '70%') + '</div>') + '</div></div>';
  return SK_STATUS + (layout === 'classic' ? photo + head : head + photo) + lead + box;
}
function stopSpeech() {
  try { speechSynthesis.cancel(); } catch (e) {}
  const btn = document.getElementById('speechBtn');
  if (btn) btn.textContent = 'Listen';
}
function showPanels() {
  hidePanels();
  const hosts = [
    document.querySelector('#rdPhoto > *'),
    document.querySelector('#rdLead .lead-main'),
    document.getElementById('articleContent')
  ];
  hosts.forEach((host, index) => {
    if (host) host.insertAdjacentHTML('beforeend', '<div class="load-panel' + (index === 2 ? ' top' : '') + '"><i class="spinner"></i></div>');
  });
}
function hidePanels() { document.querySelectorAll('.load-panel').forEach(panel => panel.remove()); }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function openArticle(id) {
  const token = ++readerToken;
  const body = document.getElementById('readerBody');
  stopSpeech();
  body.innerHTML = readerSkeleton();

  let card;
  try {
    card = await loadCard(id);
  } catch (e) {
    if (token !== readerToken) return;
    body.innerHTML = e.status === 404
      ? '<p class="fallback-note">Article not found.</p><button class="load-more-btn" data-go-top>Back to Top News</button>'
      : '<p class="fallback-note">Could not load this article. <button class="retry-btn" data-open-id="' + id + '">Retry</button></p>';
    return;
  }
  if (token !== readerToken) return;
  renderReaderBody(card);
  document.title = card.article.title + ' · SkimFeed';
  announce('Opened: ' + card.article.title);
  card.cluster.sources.filter(s => s.article_id !== id).slice(0, 8).forEach(s => loadCard(s.article_id).catch(() => {}));
}
async function switchSource(id) {
  if (currentArticle && currentArticle.article.id === id) return;
  const token = ++readerToken;
  const started = Date.now();
  stopSpeech();
  document.getElementById('rdNotice').innerHTML = '';
  document.querySelectorAll('.src-open.loading').forEach(b => b.classList.remove('loading'));
  const clicked = document.querySelector('.src-open[data-switch-id="' + id + '"]');
  if (clicked) clicked.classList.add('loading');
  showPanels();

  let card;
  try {
    card = await loadCard(id);
  } catch (e) {
    if (token !== readerToken) return;
    hidePanels();
    if (clicked) clicked.classList.remove('loading');
    document.getElementById('rdNotice').innerHTML = '<p class="fallback-note">Could not load that source. <button class="retry-btn" data-switch-id="' + id + '">Retry</button></p>';
    return;
  }
  await wait(PANEL_MIN_MS - (Date.now() - started));
  if (token !== readerToken) return;
  fillReader(card);
  document.title = card.article.title + ' · SkimFeed';
  announce('Opened: ' + card.article.title);
}
function applyFontSize() { const el = document.getElementById('articleContent'); if (el) el.style.fontSize = fontSize + 'px'; }
function changeFontSize(d) { fontSize = Math.min(26, Math.max(14, fontSize + d)); applyFontSize(); savePref('fontSize', fontSize); }
function readingColors(name, intensity) {
  const r = READ_RAMP[name] || READ_RAMP.light;
  const t = Math.max(0, Math.min(100, intensity)) / 100;
  const mix = (i) => Math.round(r.from[i] + (r.to[i] - r.from[i]) * t);
  return { bg: 'rgb(' + mix(0) + ',' + mix(1) + ',' + mix(2) + ')', fg: r.fg, line: r.line };
}
function currentIntensity() {
  return (readingIntensity && readingIntensity[readingTheme] != null) ? readingIntensity[readingTheme] : 50;
}
function applyReadingTheme() {
  const box = document.getElementById('textBox');
  const inten = currentIntensity();
  const c = readingColors(readingTheme, inten);
  if (box) {
    box.style.setProperty('--rt-bg', c.bg);
    box.style.setProperty('--rt-fg', c.fg);
    box.style.setProperty('--rt-line', c.line);
  }
  document.querySelectorAll('.theme-swap').forEach(b => {
    const on = b.dataset.theme === readingTheme;
    b.classList.toggle('active', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  const slider = document.getElementById('intensitySlider');
  if (slider) slider.value = inten;
  const lbl = document.getElementById('intensityLabel');
  if (lbl) lbl.textContent = readingTheme.charAt(0).toUpperCase() + readingTheme.slice(1) + ' depth';
  const val = document.getElementById('intensityVal');
  if (val) val.textContent = inten + '%';
}
function setReadingTheme(t) { readingTheme = t; applyReadingTheme(); savePref('readingTheme', t); }
function setReadingIntensity(v) {
  if (!readingIntensity || typeof readingIntensity !== 'object') readingIntensity = {};
  readingIntensity[readingTheme] = v;
  applyReadingTheme();
  savePref('readingIntensity', readingIntensity);
}
function toggleIntensity() {
  const row = document.getElementById('intensityRow');
  const btn = document.getElementById('intensityToggle');
  if (!row) return;
  const show = row.hidden;
  row.hidden = !show;
  if (btn) btn.classList.toggle('active', show);
}
function toggleSpeech() {
  if (!('speechSynthesis' in window)) { alert('Text-to-speech is not supported in this browser.'); return; }
  const btn = document.getElementById('speechBtn');
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); btn.textContent = 'Listen'; return; }
  if (!currentArticle) return;
  const a = currentArticle.article;
  const utter = new SpeechSynthesisUtterance(a.title + '. ' + a.description + ' ' + document.getElementById('articleContent').textContent);
  utter.onend = () => { btn.textContent = 'Listen'; };
  speechSynthesis.speak(utter);
  btn.textContent = 'Stop';
}
