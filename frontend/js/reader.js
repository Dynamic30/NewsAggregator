let readerToken = 0;

function sourcesHTML(card) {
  const a = card.article, list = card.cluster.sources;
  const item = s => {
    const scored = s.political_lean_score !== null;
    const score = Math.round(s.political_lean_score);
    return '<li><button class="src-item src-open' + (s.article_id === a.id ? ' current' : '') + '" data-open-id="' + s.article_id + '">' +
      '<span class="src-badge">' + esc(s.source.charAt(0)) + '</span>' +
      '<span class="src-main"><span class="src-name">' + esc(s.source) + (s.is_default ? '<span class="src-primary">Primary</span>' : '') + '</span>' +
        (scored ? scoreTrack(score) : '<span class="src-unscored">Not scored yet</span>') + '</span>' +
      (scored ? '<span class="src-score" style="color:var(--lean-' + scoreBucket(score) + ')">' + score + '</span>' : '') +
    '</button></li>';
  };
  return '<div class="sources-head"><span class="sources-label">Sources we found it on</span><span class="sources-count">' + list.length + '</span></div>' +
    '<ul class="sources-list">' + list.map(item).join('') + '</ul><p class="sources-key"><span>Opposition</span><span>Neutral 50</span><span>Government</span></p>';
}
function leadSplit(card) {
  const summary = card.cluster.summary;
  return '<div class="lead-split">' +
    '<div class="lead-col"><p class="lead-desc">' + esc(card.article.description) + '</p>' +
      (summary ? '<p class="cluster-summary"><span class="sources-label">How outlets covered it</span>' + esc(summary) + '</p>' : '') + '</div>' +
    '<div class="lead-col">' + sourcesHTML(card) + '</div>' +
  '</div>';
}
function textBox(a) {
  const body = a.markdown ? renderMarkdown(a.markdown) : emptyNote('The full text is not available yet.');
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
    '<div class="text-content" id="articleContent">' + body + '</div>' +
  '</div>';
}
function renderReaderBody(card) {
  currentArticle = card;
  const a = card.article;
  const original = safeUrl(a.url);
  const metaTitle =
    '<div class="reader-meta"><span class="cat-label" style="color:' + catVar(a.category) + '">' + catLabel(a.category) + '</span><span>&middot;</span><span>' + esc(a.source) + '</span>' +
      (timeAgo(a) ? '<span>&middot;</span><span>' + timeAgo(a) + '</span>' : '') +
      (original ? '<span>&middot;</span><a class="reader-original" href="' + esc(original) + '" target="_blank" rel="noopener noreferrer">Original</a>' : '') + '</div>' +
    '<h2 class="reader-title">' + esc(a.title) + '</h2>';
  const img = '<div class="reader-image" style="background:' + catVar(a.category) + '">' + svgIcon(a.category) + mediaImg(a) + '</div>';
  const imgSmall = '<div class="reader-image small" style="background:' + catVar(a.category) + '">' + svgIcon(a.category) + mediaImg(a) + '</div>';
  let html;
  if (layout === 'classic') {
    html = img + metaTitle + leadSplit(card) + textBox(a);
  } else if (layout === 'compact') {
    html = metaTitle + imgSmall + leadSplit(card) + textBox(a);
  } else {
    html = metaTitle + img + leadSplit(card) + textBox(a);
  }
  document.getElementById('readerBody').innerHTML = html;
  applyFontSize(); applyReadingTheme();
}
function setLayout(l) {
  layout = l; savePref('layout', l); updateLayoutButtons();
  if (!document.getElementById('articleView').hidden && currentArticle) renderReaderBody(currentArticle);
}
function updateLayoutButtons() {
  document.querySelectorAll('.layout-btn').forEach(b => {
    const on = b.dataset.layout === layout;
    b.classList.toggle('active', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}
async function openArticle(id) {
  const token = ++readerToken;
  stopAuto();
  try { speechSynthesis.cancel(); } catch (e) {}
  ['topView', 'allView', 'topicsView', 'topicView', 'sourcesView'].forEach(v => { document.getElementById(v).hidden = true; });
  document.getElementById('articleView').hidden = false;
  document.getElementById('readerBody').innerHTML = emptyNote('Loading…');
  window.scrollTo(0, 0);

  let card;
  try {
    card = await getJSON('/news_card/' + id);
  } catch (e) {
    if (token === readerToken) document.getElementById('readerBody').innerHTML = '<p class="fallback-note">Could not load this article. <button class="retry-btn" data-open-id="' + id + '">Retry</button></p>';
    return;
  }
  if (token !== readerToken) return;
  card.article = normaliseArticle(card.article);
  renderReaderBody(card);
  announce('Opened: ' + card.article.title);
}
function closeArticle() {
  readerToken++;
  try { speechSynthesis.cancel(); } catch (e) {}
  document.getElementById('articleView').hidden = true;
  showView(currentView, currentCat);
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
