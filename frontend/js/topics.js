function overviewCard(a) {
  return '<a class="ov-card" href="' + ARTICLE_PATH + a.id + '">' +
    '<div class="ov-photo" style="background:' + catVar(a.category) + '">' + svgIcon(a.category) + mediaImg(a) + '</div>' +
    '<p class="ov-eyebrow">' + esc(a.source) + agoSuffix(a) + sourcesBadge(a) + '</p>' +
    '<h4>' + esc(a.title) + '</h4>' +
  '</a>';
}
async function renderTopicsOverview() {
  const box = document.getElementById('topicsList');
  box.innerHTML = skeletonTopics();
  let sections;
  try {
    sections = await getJSON('/news/all_topics');
  } catch (e) {
    box.innerHTML = errorNote();
    return;
  }
  const byCat = {};
  sections.forEach(s => { byCat[TOPIC_KEY[s.topic]] = s.articles.map(normaliseArticle); });
  box.innerHTML = TOPICS.map(cat => {
    const items = byCat[cat] || [];
    return '<section class="topics-ov-block">' +
      '<a class="topics-ov-head" href="' + topicPageUrl(cat) + '">' +
        '<span class="topics-ov-h2"><span class="topic-dot ' + cat + '"></span>' + catLabel(cat) + '</span>' +
        '<span class="topics-ov-more">View all &rarr;</span>' +
      '</a>' +
      '<div class="topics-ov-grid">' + (items.length ? items.map(overviewCard).join('') : emptyNote('No stories yet.')) + '</div>' +
    '</section>';
  }).join('');
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) renderTopicsOverview();
});

renderChrome('topics');
renderTopicsOverview();
