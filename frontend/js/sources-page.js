document.addEventListener('click', (e) => {
  const leanBtn = e.target.closest('[data-lean]');
  if (leanBtn) { leanFilter = leanBtn.dataset.lean; renderSourceList(); }
  else if (e.target.closest('[data-retry]')) renderSources();
});

renderChrome('sources');
renderSources();
