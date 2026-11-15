const PAGE_SIZE = 30;

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Request failed (' + res.status + ')');
  return res.json();
}

function normaliseArticle(a) {
  const published = a.published_at ? new Date(a.published_at).getTime() : null;
  return Object.assign({}, a, {
    title: plainText(a.title),
    description: plainText(a.description),
    category: TOPIC_KEY[a.topic] || 'National',
    hoursAgo: published ? Math.max(0, (Date.now() - published) / 3600000) : 1e6,
    impact: a.source_count || 1
  });
}

function topicPath(cat) {
  return '/news/topic/' + encodeURIComponent(CAT_LABEL[cat]).replace(/%2F/g, '/') + '?';
}
