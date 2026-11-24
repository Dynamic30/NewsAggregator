function ribbonFor(a, rank) {
  if (a.hoursAgo < 3) return '<span class="ribbon breaking">Breaking</span>';
  if (rank === 0) return '<span class="ribbon top-story">Top story</span>';
  return '';
}
function tnCard(a, rank, variant) {
  const c = catVar(a.category);
  const photo = (variant !== 'mini')
    ? '<div class="tn-photo" style="--c:' + c + '">' + svgIcon(a.category) + mediaImg(a) + '<span class="save-dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v16l-6-4-6 4V4z"/></svg></span></div>'
    : '';
  return '<a class="tn-card tn-' + variant + '" href="' + ARTICLE_PATH + a.id + '" style="--c:' + c + '">' +
    photo + ribbonFor(a, rank) +
    '<p class="tn-eyebrow" style="--c:' + c + '">' + catLabel(a.category) + ' &middot; ' + sourceLabel(a) + '</p>' +
    '<h3>' + esc(a.title) + '</h3>' +
    '<p class="desc">' + esc(a.description) + '</p>' +
    '<div class="tn-byline"><span class="tn-avatar">' + esc(a.source.charAt(0)) + '</span><span><strong>' + esc(a.source) + '</strong>' + agoSuffix(a) + '</span></div>' +
  '</a>';
}
function tnMoreCard(a) {
  return '<a class="tn-more-card" href="' + ARTICLE_PATH + a.id + '">' +
    '<div class="tn-more-thumb" style="background:' + catVar(a.category) + '">' + svgIcon(a.category) + mediaImg(a) + '</div>' +
    '<div><p class="tn-more-eyebrow">' + catLabel(a.category) + agoSuffix(a) + sourcesBadge(a) + '</p><h4>' + esc(a.title) + '</h4></div>' +
  '</a>';
}
async function renderTopNews() {
  const grid = document.getElementById('topGrid'), more = document.getElementById('topMore');
  grid.innerHTML = skeletonTopGrid();
  more.innerHTML = skeletonTopMore();
  let top;
  try {
    top = (await getJSON('/top_news?limit=10')).map(normaliseArticle);
  } catch (e) {
    grid.innerHTML = errorNote();
    more.innerHTML = '';
    return;
  }
  if (!top.length) { grid.innerHTML = emptyNote('No top stories yet.'); more.innerHTML = ''; return; }
  const hero = top[0], left1 = top[1], left2 = top[2], right1 = top[3];
  const accent =
    '<div class="tn-accent"><p class="label">Top stories today</p><div class="rule"></div>' +
    '<div class="big">' + top.length + '</div>' +
    '<p class="copy">Ranked by how many outlets are covering each story.</p></div>';
  grid.innerHTML =
    '<div class="tn-col">' + (left1 ? tnCard(left1, 1, 'med') : '') + (left2 ? tnCard(left2, 2, 'mini') : '') + '</div>' +
    '<div class="tn-col tn-center">' + tnCard(hero, 0, 'hero') + '</div>' +
    '<div class="tn-col">' + accent + (right1 ? tnCard(right1, 3, 'med') : '') + '</div>';
  more.innerHTML = top.slice(4, 10).map(tnMoreCard).join('');
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) renderTopNews();
});

renderChrome('top');
document.getElementById('dateText').textContent = dateText();
renderTopNews();
