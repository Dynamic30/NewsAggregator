// ---------- paged lists (latest news, topic list) ----------
let latestPager = null, topicPager = null;
let topToken = 0, topicsToken = 0;

function newPager(options) {
  return Object.assign({ items: [], done: false, loading: false, stale: false }, options);
}

async function loadMore(pager) {
  if (pager.loading) return;
  pager.loading = true;
  const list = document.getElementById(pager.listId), more = document.getElementById(pager.moreId);
  const first = !pager.items.length;
  more.innerHTML = '';
  if (first) list.innerHTML = skeletonList();
  else list.insertAdjacentHTML('beforeend', '<div class="sk-more">' + skeletonCards(3) + '</div>');

  let page;
  try {
    page = (await getJSON(pager.path + 'limit=' + PAGE_SIZE + '&offset=' + pager.items.length)).map(normaliseArticle);
  } catch (e) {
    pager.loading = false;
    if (pager.stale) return;
    list.querySelectorAll('.sk-more').forEach(node => node.remove());
    if (first) {
      list.innerHTML = errorNote();
      if (pager.onFirstPage) pager.onFirstPage([]);
    }
    else more.innerHTML = emptyNote('Could not load more.') + '<button class="load-more-btn" data-more="' + pager.listId + '">Try again</button>';
    return;
  }
  pager.loading = false;
  if (pager.stale) return;

  list.querySelectorAll('.sk-more').forEach(node => node.remove());
  pager.items = pager.items.concat(page);
  pager.done = page.length < PAGE_SIZE;
  if (first) list.innerHTML = page.length ? page.map(cardHTML).join('') : emptyNote(pager.emptyText);
  else list.insertAdjacentHTML('beforeend', page.map(cardHTML).join(''));
  more.innerHTML = pager.done ? '' : '<button class="load-more-btn" data-more="' + pager.listId + '">Load more</button>';
  if (first && pager.onFirstPage) pager.onFirstPage(pager.items);
}

// ---------- TOP NEWS (replicable priority layout) ----------
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
  document.getElementById('dateText').textContent = dateText();
  const grid = document.getElementById('topGrid'), more = document.getElementById('topMore');
  const token = ++topToken;
  grid.innerHTML = skeletonTopGrid();
  more.innerHTML = skeletonTopMore();
  let top;
  try {
    top = (await getJSON('/top_news?limit=10')).map(normaliseArticle);
  } catch (e) {
    if (token !== topToken) return;
    grid.innerHTML = errorNote();
    more.innerHTML = '';
    return;
  }
  if (token !== topToken) return;
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

// ---------- plain list card ----------
function cardHTML(a) {
  return '<a class="card" href="' + ARTICLE_PATH + a.id + '">' +
    '<div class="thumb" style="background:' + catVar(a.category) + '">' + svgIcon(a.category) + mediaImg(a) + '</div>' +
    '<div class="card-body">' +
      '<div class="card-meta"><span class="cat-label" style="color:' + catVar(a.category) + '">' + catLabel(a.category) + '</span><span>&middot;</span><span>' + esc(a.source) + '</span>' + (timeAgo(a) ? '<span>&middot;</span><span>' + timeAgo(a) + '</span>' : '') + sourcesBadge(a) + '</div>' +
      '<h3 class="card-title">' + esc(a.title) + '</h3>' +
      '<p class="card-snippet">' + esc(a.description) + '</p>' +
    '</div>' +
  '</a>';
}
function renderAllNews() {
  if (latestPager) latestPager.stale = true;
  latestPager = newPager({ path: '/latest_news?', listId: 'allList', moreId: 'allMore', emptyText: 'No stories yet.' });
  loadMore(latestPager);
}

// ---------- TOPICS overview: every section with its top 3 ----------
function overviewCard(a) {
  return '<a class="ov-card" href="' + ARTICLE_PATH + a.id + '">' +
    '<div class="ov-photo" style="background:' + catVar(a.category) + '">' + svgIcon(a.category) + mediaImg(a) + '</div>' +
    '<p class="ov-eyebrow">' + esc(a.source) + agoSuffix(a) + sourcesBadge(a) + '</p>' +
    '<h4>' + esc(a.title) + '</h4>' +
  '</a>';
}
async function renderTopicsOverview() {
  const box = document.getElementById('topicsList');
  const token = ++topicsToken;
  box.innerHTML = skeletonTopics();
  let sections;
  try {
    sections = await getJSON('/news/all_topics');
  } catch (e) {
    if (token !== topicsToken) return;
    box.innerHTML = errorNote();
    return;
  }
  if (token !== topicsToken) return;
  const byCat = {};
  sections.forEach(s => { byCat[TOPIC_KEY[s.topic]] = s.articles.map(normaliseArticle); });
  box.innerHTML = TOPICS.map(cat => {
    const items = byCat[cat] || [];
    return '<section class="topics-ov-block">' +
      '<button class="topics-ov-head" data-view="topic" data-cat="' + cat + '">' +
        '<span class="topics-ov-h2"><span class="topic-dot ' + cat + '"></span>' + catLabel(cat) + '</span>' +
        '<span class="topics-ov-more">View all &rarr;</span>' +
      '</button>' +
      '<div class="topics-ov-grid">' + (items.length ? items.map(overviewCard).join('') : emptyNote('No stories yet.')) + '</div>' +
    '</section>';
  }).join('');
}

// ---------- TOPIC view: carousel of the latest 5 + full list ----------
let carIndex = 0, carCount = 0, carTimer = null;
const carReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function slideHTML(a) {
  const c = catVar(a.category);
  return '<a class="car-slide" href="' + ARTICLE_PATH + a.id + '">' +
    '<div class="slide-image" style="background:' + c + '">' + svgIcon(a.category) + mediaImg(a) + '</div>' +
    '<div class="slide-content">' +
      '<p class="eyebrow" style="color:' + c + '">' + catLabel(a.category) + ' &middot; ' + sourceLabel(a) + '</p>' +
      '<h3>' + esc(a.title) + '</h3>' +
      '<p class="slide-desc">' + esc(a.description) + '</p>' +
      '<div class="tn-byline"><span class="tn-avatar" style="--c:' + c + '">' + esc(a.source.charAt(0)) + '</span><span><strong>' + esc(a.source) + '</strong>' + agoSuffix(a) + '</span></div>' +
    '</div>' +
  '</a>';
}
function buildCarousel(items) {
  carCount = items.length; carIndex = 0;
  if (!carCount) { document.getElementById('topicCarousel').innerHTML = ''; return; }
  const slides = items.map(slideHTML).join('');
  const controls = carCount > 1
    ? '<button class="car-arrow car-prev" aria-label="Previous story">&lsaquo;</button>' +
      '<button class="car-arrow car-next" aria-label="Next story">&rsaquo;</button>' +
      '<div class="carousel-dots">' + items.map((_, i) => '<button class="car-dot' + (i === 0 ? ' active' : '') + '" data-slide="' + i + '" aria-label="Go to story ' + (i + 1) + '"></button>').join('') + '</div>'
    : '';
  document.getElementById('topicCarousel').innerHTML =
    '<div class="carousel-viewport"><div class="carousel-track" id="carTrack">' + slides + '</div></div>' + controls;
  updateCarousel();
  startAuto();
}
function updateCarousel() {
  const track = document.getElementById('carTrack');
  if (track) track.style.transform = 'translateX(-' + (carIndex * 100) + '%)';
  document.querySelectorAll('.car-dot').forEach((d, i) => d.classList.toggle('active', i === carIndex));
}
function goSlide(i) { if (carCount) { carIndex = (i + carCount) % carCount; updateCarousel(); } }
function nextSlide() { goSlide(carIndex + 1); }
function prevSlide() { goSlide(carIndex - 1); }
function startAuto() { stopAuto(); if (!carReduced && carCount > 1) carTimer = setInterval(nextSlide, 5000); }
function stopAuto() { if (carTimer) { clearInterval(carTimer); carTimer = null; } }

function renderTopic(cat) {
  document.getElementById('topicEyebrow').textContent = 'Section';
  document.getElementById('topicTitle').textContent = CAT_LABEL[cat];
  document.getElementById('topicName').textContent = CAT_LABEL[cat];
  document.getElementById('topicCarousel').innerHTML = skeletonCarousel();
  carCount = 0;
  stopAuto();
  if (topicPager) topicPager.stale = true;
  topicPager = newPager({
    path: topicPath(cat),
    listId: 'topicList',
    moreId: 'topicMore',
    emptyText: 'No stories here yet.',
    onFirstPage: items => buildCarousel(items.slice(0, 5))
  });
  loadMore(topicPager);
}
