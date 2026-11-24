let pager;

function renderAllNews() {
  pager = newPager({ path: '/latest_news?', listId: 'allList', moreId: 'allMore', emptyText: 'No stories yet.' });
  loadMore(pager);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) renderAllNews();
  else if (e.target.closest('[data-more]')) loadMore(pager);
});

renderChrome('latest');
renderAllNews();
