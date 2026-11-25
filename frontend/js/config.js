const MAX_OFFSET = 500;
const ARTICLE_PATH = '/news/';
const PAGES = {home: '/', top: '/top-news', latest: '/latest-news', topics: '/topics', sources: '/source', topic: '/topic/'};

const ICONS = {
  National: '<path d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  Business: '<path d="M5 19V11M12 19V5M19 19v-6"/>',
  Tech: '<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M8 20h8M8 9h8M8 13h5"/>',
  Sports: '<path d="M8 4h8v5a4 4 0 01-8 0V4zM8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3M12 13v4M9 20h6"/>',
  Entertainment: '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4l-5.2 2.8 1-5.9L3.5 9.2l5.9-.8L12 3z"/>',
  Science: '<path d="M10 3h4M11 3v6l-5.2 9.2A1.6 1.6 0 007.2 21h9.6a1.6 1.6 0 001.4-2.8L13 9V3"/>',
  Education: '<path d="M3 9l9-4 9 4-9 4-9-4zM7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4M21 9v5"/>',
  Climate: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c3-4 6-6 9-8"/>',
  Markets: '<path d="M3 17l5-5 4 4 8-9M15 7h5v5"/>',
  Politics: '<path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>'
};
const CAT_VAR = {National: 'var(--cat-national)', Business: 'var(--cat-business)', Tech: 'var(--cat-tech)', Sports: 'var(--cat-sports)', Entertainment: 'var(--cat-entertainment)', Science: 'var(--cat-science)', Education: 'var(--cat-education)', Climate: 'var(--cat-climate)', Markets: 'var(--cat-markets)', Politics: 'var(--cat-politics)'};
const CAT_LABEL = {National: 'National/India', Business: 'Business/Economy', Tech: 'Technology', Sports: 'Sports', Entertainment: 'Entertainment', Science: 'Science & Health', Education: 'Education', Climate: 'Environment/Climate', Markets: 'Markets/Stocks', Politics: 'Politics'};
const TOPICS = ['National', 'Business', 'Tech', 'Sports', 'Entertainment', 'Science', 'Education', 'Climate', 'Markets', 'Politics'];

// API topic name -> short key used by the CSS classes, colours and icons (CAT_LABEL is the reverse)
const TOPIC_KEY = {'National/India': 'National', 'Business/Economy': 'Business', 'Technology': 'Tech', 'Sports': 'Sports', 'Entertainment': 'Entertainment', 'Science & Health': 'Science', 'Education': 'Education', 'Environment/Climate': 'Climate', 'Markets/Stocks': 'Markets', 'Politics': 'Politics'};

const LEAN_LABELS = ['Strong opposition', 'Leans opposition', 'Neutral', 'Leans government', 'Strong government'];

// Reading surface ramps: each theme interpolates between a light and a
// deep endpoint, so the intensity slider sets the "depth" of that mode.
const READ_RAMP = {
  light: { from: [255,255,255], to: [226,206,170], fg: '#1A1A1A', line: 'rgba(0,0,0,0.12)' },
  dark: { from: [40,36,33],    to: [12,10,9],     fg: '#ECEAE4', line: 'rgba(255,255,255,0.16)' }
};
