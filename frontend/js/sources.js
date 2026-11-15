let leanFilter = 'all';
let sourceData = [];

async function renderSources() {
  const body = document.getElementById('sourcesBody');
  body.innerHTML = emptyNote('Loading…');
  try {
    sourceData = await getJSON('/sources');
  } catch (e) {
    body.innerHTML = errorNote();
    return;
  }
  renderSourceList();
}

function renderSourceList() {
  const body = document.getElementById('sourcesBody');
  if (!sourceData.length) { body.innerHTML = emptyNote('No sources tracked yet.'); return; }

  const scored = sourceData.filter(s => s.political_score !== null);
  const counts = [0, 0, 0, 0, 0];
  scored.forEach(s => counts[scoreBucket(s.political_score)]++);
  const bar = scored.length
    ? '<div class="lean-bar">' + counts.map((c, i) => '<i style="flex-grow:' + c + ';background:var(--lean-' + i + ')" title="' + LEAN_LABELS[i] + ': ' + c + '"></i>').join('') + '</div>'
    : '';
  const chip = (key, label, n, dot) =>
    '<button class="lean-chip' + (String(leanFilter) === String(key) ? ' active' : '') + '" data-lean="' + key + '">' +
    (dot !== undefined ? '<span class="dot" style="background:var(--lean-' + dot + ')"></span>' : '') + label + ' <span class="n">' + n + '</span></button>';
  const chips = chip('all', 'All', sourceData.length) + LEAN_LABELS.map((l, i) => chip(i, l, counts[i], i)).join('');

  const shown = leanFilter === 'all' ? sourceData : scored.filter(s => scoreBucket(s.political_score) === Number(leanFilter));
  const cards = shown.map(s => {
    const lean = s.political_score === null
      ? '<div class="src-lean-label">Not scored yet</div>'
      : '<div class="src-lean-label"><b>' + Math.round(s.political_score) + '</b> · ' + LEAN_LABELS[scoreBucket(s.political_score)] + '</div>' + scoreTrack(Math.round(s.political_score));
    return '<div class="src-card"><span class="src-badge">' + esc(s.name.charAt(0)) + '</span>' +
      '<div class="src-card-main"><p class="src-card-name">' + esc(s.name) + '</p><p class="src-card-meta">' + s.story_count + (s.story_count === 1 ? ' story' : ' stories') + ' tracked</p></div>' +
      '<div class="src-lean">' + lean + '</div></div>';
  }).join('');

  body.innerHTML =
    '<div class="lean-summary"><div class="lean-summary-top"><h2>' + sourceData.length + ' tracked sources, ' + scored.length + ' scored</h2><span>0 opposition · 50 neutral · 100 government</span></div>' +
    bar + '<div class="lean-chips">' + chips + '</div></div>' +
    '<div class="src-grid">' + (cards || emptyNote('No sources in this group.')) + '</div>' +
    '<p class="lean-note">Sources closest to 50 are shown first.</p>';
}
