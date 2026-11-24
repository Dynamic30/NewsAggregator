const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
const GEAR_PATH = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.04.05a2 2 0 11-2.83 2.83l-.05-.04a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.05.04a2 2 0 11-2.83-2.83l.04-.05a1.65 1.65 0 00.33-1.82V15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1V9a1.65 1.65 0 00-.33-1.82l-.04-.05a2 2 0 112.83-2.83l.05.04a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.05-.04a2 2 0 112.83 2.83l-.04.05a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>';
const CLOSE_ICON = SVG_OPEN + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const SUN_PATH = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const MOON_PATH = '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>';

const NAV_ITEMS = [
  {key: 'top', label: 'Top News', icon: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'},
  {key: 'latest', label: 'Latest News', icon: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'},
  {key: 'topics', label: 'Topics', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'},
  {key: 'sources', label: 'Sources', icon: '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 006 0L7 7zM17 7l-3 7a3 3 0 006 0l-3-7z"/>'}
];

function navLink(cls, href, active, inner) {
  return '<a class="' + cls + (active ? ' active" aria-current="page"' : '"') + ' href="' + href + '">' + inner + '</a>';
}

function brandHTML() {
  return '<a class="brand-mark" href="' + PAGES.home + '"><span class="brand-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.5L19 9l-5.1 1.5L12 16l-1.9-5.5L5 9l5.1-1.5L12 2z"/></svg></span><span>SkimFeed</span></a>';
}

function headerHTML(page) {
  const section = page === 'topic' ? 'topics' : page;
  return '<header class="topnav">' +
    '<button class="menu-btn" id="menuBtn" aria-label="Open menu">' + SVG_OPEN + '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>' +
    brandHTML() +
    '<nav class="topnav-links">' + NAV_ITEMS.map(n => navLink('navbtn', PAGES[n.key], n.key === section, n.label)).join('') + '</nav>' +
    '<div class="topnav-right">' +
      '<button class="theme-btn" id="themeSwitch" role="switch" aria-checked="false" aria-label="Toggle dark mode">' +
        '<svg class="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + SUN_PATH + '</svg>' +
        '<svg class="ic-moon" viewBox="0 0 24 24" fill="currentColor">' + MOON_PATH + '</svg>' +
      '</button>' +
      '<button class="gear-btn" id="settingsGearBtn" aria-label="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + GEAR_PATH + '</svg></button>' +
    '</div>' +
  '</header>';
}

function drawerHTML(page, cat) {
  const navs = NAV_ITEMS.map(n => navLink('nav-link', PAGES[n.key], n.key === page, SVG_OPEN + n.icon + '</svg><span>' + n.label + '</span>')).join('');
  const topics = TOPICS.map(c => navLink('topic-link', topicPageUrl(c), page === 'topic' && c === cat, '<span class="topic-dot ' + c + '"></span><span>' + catLabel(c) + '</span>')).join('');
  return '<div class="drawer-backdrop" id="drawerBackdrop" hidden></div>' +
  '<aside class="drawer" id="drawer" aria-label="Navigation menu">' +
    '<div class="drawer-head">' + brandHTML() + '<button class="drawer-close" id="drawerCloseBtn" aria-label="Close menu">' + CLOSE_ICON + '</button></div>' +
    '<nav class="nav-list">' + navs + '</nav>' +
    '<div class="sidebar-section"><span class="sidebar-label">All topics</span><div class="topic-list">' + topics + '</div></div>' +
    '<div class="drawer-bottom"><button class="settings-toggle" id="settingsOpenBtn"><svg class="gear-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + GEAR_PATH + '</svg><span>Settings</span></button></div>' +
  '</aside>';
}

function settingsHTML() {
  return '<div class="modal-backdrop" id="settingsModal" hidden>' +
    '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">' +
      '<div class="modal-header">' +
        '<div><h2 class="modal-title" id="settingsTitle">Settings</h2><p class="modal-sub">Personalize your SkimFeed.</p></div>' +
        '<button class="modal-close" id="settingsCloseBtn" aria-label="Close settings">' + CLOSE_ICON + '</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="setting-row"><span class="setting-label" id="regionLabel">Region</span><select class="region" disabled aria-labelledby="regionLabel"><option selected>India</option></select><p class="setting-hint">More regions coming soon.</p></div>' +
        '<div class="setting-row"><span class="setting-label" id="appearanceLabel">Appearance</span>' +
          '<div class="segmented" role="radiogroup" aria-labelledby="appearanceLabel">' +
            '<button class="seg-btn" role="radio" data-theme="light">' + SVG_OPEN + SUN_PATH + '</svg>Light</button>' +
            '<button class="seg-btn" role="radio" data-theme="dark"><svg viewBox="0 0 24 24" fill="currentColor">' + MOON_PATH + '</svg>Dark</button>' +
          '</div></div>' +
        '<div class="setting-row"><span class="setting-label" id="layoutLabel">Article layout</span>' +
          '<div class="layout-options" role="radiogroup" aria-labelledby="layoutLabel">' +
            '<button class="layout-btn" role="radio" data-layout="standard"><span class="layout-radio"></span><span class="lo-text"><span class="lo-name">Standard</span><span class="lo-desc">Title, image, then description</span></span></button>' +
            '<button class="layout-btn" role="radio" data-layout="classic"><span class="layout-radio"></span><span class="lo-text"><span class="lo-name">Classic</span><span class="lo-desc">Image first, then title</span></span></button>' +
            '<button class="layout-btn" role="radio" data-layout="compact"><span class="layout-radio"></span><span class="lo-text"><span class="lo-name">Compact</span><span class="lo-desc">Description beside a smaller image</span></span></button>' +
          '</div></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function renderChrome(page, cat) {
  document.getElementById('app').insertAdjacentHTML('afterbegin', headerHTML(page) + drawerHTML(page, cat));
  document.body.insertAdjacentHTML('beforeend', settingsHTML());
}
