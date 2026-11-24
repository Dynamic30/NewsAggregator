let pager;
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
  document.getElementById('topicCarousel').innerHTML = skeletonCarousel();
  carCount = 0;
  stopAuto();
  pager = newPager({
    path: topicPath(cat),
    listId: 'topicList',
    moreId: 'topicMore',
    emptyText: 'No stories here yet.',
    onFirstPage: items => buildCarousel(items.slice(0, 5))
  });
  loadMore(pager);
}

const topicCat = TOPICS.find(c => c.toLowerCase() === location.pathname.slice(PAGES.topic.length));
if (!topicCat) location.replace(PAGES.topics);
else {
  renderChrome('topic', topicCat);
  document.title = CAT_LABEL[topicCat] + ' · SkimFeed';
  document.getElementById('topicTitle').textContent = CAT_LABEL[topicCat];
  document.getElementById('topicName').textContent = CAT_LABEL[topicCat];
  renderTopic(topicCat);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) renderTopic(topicCat);
  else if (e.target.closest('[data-more]')) loadMore(pager);
  else if (e.target.closest('.car-prev')) { stopAuto(); prevSlide(); }
  else if (e.target.closest('.car-next')) { stopAuto(); nextSlide(); }
  else if (e.target.closest('.car-dot')) { stopAuto(); goSlide(parseInt(e.target.closest('.car-dot').dataset.slide, 10)); }
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
