function newPager(options) {
  return Object.assign({ items: [], done: false, loading: false }, options);
}

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
    list.querySelectorAll('.sk-more').forEach(node => node.remove());
    if (first) {
      list.innerHTML = errorNote();
      if (pager.onFirstPage) pager.onFirstPage([]);
    }
    else more.innerHTML = emptyNote('Could not load more.') + '<button class="load-more-btn" data-more>Try again</button>';
    return;
  }
  pager.loading = false;

  list.querySelectorAll('.sk-more').forEach(node => node.remove());
  pager.items = pager.items.concat(page);
  pager.done = page.length < PAGE_SIZE || pager.items.length > MAX_OFFSET;
  if (first) list.innerHTML = page.length ? page.map(cardHTML).join('') : emptyNote(pager.emptyText);
  else list.insertAdjacentHTML('beforeend', page.map(cardHTML).join(''));
  more.innerHTML = pager.done ? '' : '<button class="load-more-btn" data-more>Load more</button>';
  if (first && pager.onFirstPage) pager.onFirstPage(pager.items);
}
