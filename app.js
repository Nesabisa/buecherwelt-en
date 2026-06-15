/* ===== CONSTANTS ===== */
const SUGGESTED_AUTHORS = [
  'Sadhguru', 'Rick Rubin', 'Malcolm Gladwell',
  'James Clear', 'Ryan Holiday', 'Mark Manson', 'Yuval Noah Harari',
];
// Genres that are too generic to be useful for recommendations
const SKIP_GENRES = new Set(['Fiction','Juvenile Fiction','Nonfiction','Juvenile Nonfiction',
  'Literary Collections','Literary Criticism','General','Short Stories','Classics']);

// Genre name → API query
const GENRE_API_MAP = {
  'Self-Help':       'self help personal development',
  'Spirituality':    'spirituality mindfulness consciousness',
  'Psychology':      'psychology behavior mind',
  'Business':        'business entrepreneurship leadership',
  'Philosophy':      'philosophy stoicism wisdom',
  'History':         'history civilization world',
  'Science':         'science popular physics biology',
  'Biography':       'biography memoir autobiography',
  'Thriller':        'thriller suspense crime',
  'Mystery':         'mystery detective crime',
  'Fantasy':         'fantasy epic magic',
  'Sci-Fi':          'science fiction future space',
  'Horror':          'horror supernatural dark',
  'Adventure':       'adventure travel exploration',
  'New Releases':    'NEW:bestseller nonfiction',
  'NYT-Bestseller':  'NYT-Bestseller',
};
const GENRE_EN_MAP = {
  'Self-Help':                 'self help personal development',
  'Body, Mind & Spirit':       'spirituality mindfulness consciousness',
  'Psychology':                'psychology behavior mind',
  'Business & Economics':      'business entrepreneurship leadership',
  'Philosophy':                'philosophy stoicism wisdom',
  'History':                   'history civilization',
  'Science':                   'science popular',
  'Biography & Autobiography': 'biography memoir',
  'True Crime':                'true crime',
  'Thriller':                  'thriller suspense',
  'Mystery & Detective':       'mystery detective',
  'Fantasy':                   'fantasy epic',
  'Science Fiction':           'science fiction',
  'Horror':                    'horror supernatural',
  'Adventure':                 'adventure travel',
  'Music':                     'music creativity',
  'Sports & Recreation':       'sports athletes',
  'Literary Fiction':          'literary fiction',
};
function genreForApi(g) { return GENRE_API_MAP[g] || GENRE_EN_MAP[g] || g; }
function isKnownGenre(g) { return !!(GENRE_API_MAP[g] || GENRE_EN_MAP[g] || GENRE_AUTHORS[g]); }
function buildAuthorGenreMap() {
  const map = {};
  for (const [genre, authors] of Object.entries(GENRE_AUTHORS))
    for (const a of authors) (map[a.toLowerCase()] = map[a.toLowerCase()]||[]).push(genre);
  return map;
}
function limitPerAuthor(books, max=2) {
  const counts = {};
  return books.filter(b => {
    const a = (b.authors?.[0]||'unknown').toLowerCase();
    counts[a] = (counts[a]||0)+1;
    return counts[a] <= max;
  });
}

// Returns true if a Google Books item is an English-language book
function isEnglish(i) {
  const lang = i.volumeInfo?.language;
  return !lang || lang === 'en';
}

// Returns true if a genre string looks like a German label (umlauts, known German words)
function isGermanGenre(g) {
  if (/[äöüÄÖÜß]/.test(g)) return true;
  const germanWords = /^(Ratgeber|Sachbuch|Belletristik|Verhalten|Sozial|Persönlich|Lebenshilfe|Wirtschaft|Gesellschaft|Politik|Kriminal|Historisch|Liebes|Abenteuer|Unterhalt|Technik|Medizin|Erziehung|Reise|Humor|Natur|Roman|Krimi|Klassiker|Biografie)/i;
  return germanWords.test(g);
}

// Normalize a book title for deduplication: lowercase, strip parentheticals + punctuation
function normTitle(t) {
  return String(t||'').toLowerCase()
    .replace(/\s*[\(\[].+?[\)\]]/g, '') // strip "(Reprint)", "[Kindle Edition]" etc.
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Deduplicate raw Google Books API items by normalized title.
// Prefers items that have a cover image.
function dedupeRaw(items) {
  const seen = new Map(); // normTitle → index in result
  const result = [];
  for (const i of items) {
    const key = normTitle(i.volumeInfo?.title || '');
    if (!key) continue;
    if (!seen.has(key)) {
      seen.set(key, result.length);
      result.push(i);
    } else {
      // Upgrade to this item if it has a cover and the stored one doesn't
      const idx = seen.get(key);
      const hasCover = !!i.volumeInfo?.imageLinks?.thumbnail;
      const existingHasCover = !!result[idx].volumeInfo?.imageLinks?.thumbnail;
      if (hasCover && !existingHasCover) result[idx] = i;
    }
  }
  return result;
}

// Deduplicate already-mapped book objects by normalized title.
function dedupeBooks(books) {
  const seen = new Set();
  return books.filter(b => {
    const key = normTitle(b.title || '');
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// Curated international authors per genre
const GENRE_AUTHORS = {
  'Self-Help':                 ['James Clear', 'Mark Manson', 'Ryan Holiday'],
  'Spirituality':              ['Sadhguru', 'Eckhart Tolle', 'Thich Nhat Hanh'],
  'Body, Mind & Spirit':       ['Sadhguru', 'Eckhart Tolle', 'Deepak Chopra'],
  'Psychology':                ['Daniel Kahneman', 'Robert Cialdini', 'Jordan Peterson'],
  'Business':                  ['Malcolm Gladwell', 'Adam Grant', 'Simon Sinek'],
  'Business & Economics':      ['Malcolm Gladwell', 'Adam Grant', 'Simon Sinek'],
  'Philosophy':                ['Ryan Holiday', 'Alain de Botton', 'Naval Ravikant'],
  'History':                   ['Yuval Noah Harari', 'Robert Greene', 'Nassim Taleb'],
  'Science':                   ['Carl Sagan', 'Richard Dawkins', 'Bill Bryson'],
  'Biography':                 ['Walter Isaacson', 'Robert Caro', 'David Grann'],
  'Biography & Autobiography': ['Walter Isaacson', 'David Grann', 'Erik Larson'],
  'Music':                     ['Rick Rubin', 'Bruce Springsteen', 'Bob Dylan'],
  'Thriller':                  ['Gillian Flynn', 'Dennis Lehane', 'Lee Child'],
  'Mystery':                   ['Tana French', 'Michael Connelly', 'James Patterson'],
  'Mystery & Detective':       ['Tana French', 'Michael Connelly', 'Gillian Flynn'],
  'Fantasy':                   ['Brandon Sanderson', 'Patrick Rothfuss', 'Joe Abercrombie'],
  'Science Fiction':           ['Andy Weir', 'Liu Cixin', 'Isaac Asimov'],
  'Sci-Fi':                    ['Andy Weir', 'Liu Cixin', 'Blake Crouch'],
  'Horror':                    ['Stephen King', 'Paul Tremblay', 'Josh Malerman'],
  'Adventure':                 ['Jon Krakauer', 'Sebastian Junger', 'Erik Larson'],
  'Literary Fiction':          ['Cormac McCarthy', 'Don DeLillo', 'Jeffrey Eugenides'],
};

/* ===== STATE ===== */
const S = {
  code:                  null,
  authors:               [],
  books:                 {},
  genreStats:            {},
  expandedBook:          null,
  editingBook:           null,
  bookFilter:            'alle',
  selectedRating:        null,
  selectedReadYear:      null,
  selectedDiscoverGenre: null,
  favSearch:             '',
  wishlist:              [],
  newReleasesAll:        [],
  suggestions:           [],
  authorBookFilter:      {},
  dismissedAuthors:      new Set(),
  customSuggestedAuthors: [],
};

/* ===== FIREBASE ===== */
let db = null;
function initFirebase() {
  try { firebase.initializeApp(window.FIREBASE_CONFIG); db = firebase.firestore(); return true; }
  catch(e) { console.error('Firebase init failed', e); return false; }
}
function col(path) { return db.collection(`buecherwelt-en/${S.code}/${path}`); }

async function loadAllData() {
  const [authSnap, genreSnap, wishSnap] = await Promise.all([
    col('authors').orderBy('addedAt').get(),
    col('meta').doc('genres').get(),
    col('wishlist').orderBy('addedAt').get(),
  ]);
  S.authors    = authSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  S.genreStats = genreSnap.exists ? genreSnap.data() : {};
  S.wishlist   = wishSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const snaps  = await Promise.all(S.authors.map(a => col('books').where('authorId','==',a.id).get()));
  S.books = {};
  S.authors.forEach((a,i) => { S.books[a.id] = snaps[i].docs.map(d => ({ id: d.id, ...d.data() })); });
}

async function saveAuthor(a)       { await col('authors').doc(a.id).set(a); }
async function saveBook(b)         { await col('books').doc(b.id).set(b); }
async function updateBook(id,up)   { await col('books').doc(id).update(up); }
async function updateAuthorMeta(id,up) { await col('authors').doc(id).update(up); }
async function saveGenreStats(s)   { await col('meta').doc('genres').set(s); }
async function saveWishItem(w)     { await col('wishlist').doc(w.id).set(w); }
async function deleteWishItem(id)  { await col('wishlist').doc(id).delete(); }
async function deleteAuthorFromDb(authorId) {
  const books = S.books[authorId] || [];
  await Promise.all(books.map(b => col('books').doc(b.id).delete()));
  await col('authors').doc(authorId).delete();
}

let _deleteTimer = null;
let _deletePending = null;

function startDeleteAuthor(authorId, name) {
  if (_deleteTimer) { clearTimeout(_deleteTimer); commitDelete(); }
  _deletePending = { authorId, author: S.authors.find(a=>a.id===authorId), books: S.books[authorId]||[] };
  S.authors = S.authors.filter(a=>a.id!==authorId);
  delete S.books[authorId];
  renderAutoren(); renderAlleBuecher(); renderFavorites();
  showDeleteToast(name);
  _deleteTimer = setTimeout(commitDelete, 5000);
}

function undoDelete() {
  if (!_deletePending) return;
  clearTimeout(_deleteTimer); _deleteTimer = null;
  S.authors.push(_deletePending.author);
  S.books[_deletePending.authorId] = _deletePending.books;
  _deletePending = null;
  hideDeleteToast();
  renderAutoren(); renderAlleBuecher(); renderFavorites();
}

async function commitDelete() {
  if (!_deletePending) return;
  const {authorId} = _deletePending;
  _deletePending = null; _deleteTimer = null;
  hideDeleteToast();
  try { await deleteAuthorFromDb(authorId); } catch(e) { console.error(e); }
}

function showDeleteToast(name) {
  const t = document.getElementById('delete-toast');
  document.getElementById('delete-toast-name').textContent = name;
  t.classList.remove('hidden');
  t.classList.add('visible');
}
function hideDeleteToast() {
  const t = document.getElementById('delete-toast');
  t.classList.remove('visible');
  setTimeout(()=>t.classList.add('hidden'), 300);
}

/* ===== GOOGLE BOOKS API ===== */
const API = 'https://www.googleapis.com/books/v1/volumes';
const BOOKS_KEY = 'AIzaSyD50NVJzvuje5QWECItyUBAu3wbBsWB0_s';
async function fetchJson(url) { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'key=' + BOOKS_KEY); if (!r.ok) throw new Error(r.status); return r.json(); }

/* ===== INLINE AUTHOR SEARCH ===== */
let _inlineAuthorTimer = null;
function debouncedInlineAuthorSearch(v) {
  const clear = document.getElementById('ias-clear');
  const res   = document.getElementById('inline-author-results');
  if (clear) clear.classList.toggle('hidden', !v.trim());
  if (!v.trim()) { res.classList.add('hidden'); res.innerHTML=''; return; }
  res.classList.remove('hidden');
  res.innerHTML = '<p class="btr-status">Searching …</p>';
  clearTimeout(_inlineAuthorTimer);
  _inlineAuthorTimer = setTimeout(() => _doInlineAuthorSearch(v.trim()), 420);
}

async function _doInlineAuthorSearch(q) {
  const res = document.getElementById('inline-author-results');
  try {
    const data = await fetchJson(`${API}?q=inauthor:${encodeURIComponent('"'+q+'"')}&maxResults=20&fields=items(volumeInfo(authors,imageLinks))`);
    const seen = new Map();
    (data.items||[]).forEach(item => (item.volumeInfo?.authors||[]).forEach(n => {
      if (!seen.has(n)) seen.set(n, item.volumeInfo?.imageLinks?.thumbnail||null);
    }));
    const ql = q.toLowerCase();
    const matched = [...seen.entries()]
      .filter(([n]) => n.toLowerCase().includes(ql) || ql.split(' ').every(w => n.toLowerCase().includes(w)))
      .slice(0,8);
    if (!matched.length) { res.innerHTML = '<p class="btr-status">No results – try a different name?</p>'; return; }
    res.innerHTML = matched.map(([name, img]) => {
      const already = S.authors.some(a => a.name.toLowerCase() === name.toLowerCase());
      const av = img ? `<img class="author-result-avatar" src="${img.replace('http://','https://')}" alt="">` : `<div class="author-result-ph">✍️</div>`;
      return `<div class="author-result ${already?'already-added':''}">
        ${av}<div><div class="author-result-name">${esc(name)}</div></div>
        ${already ? `<span class="already-label">✓ Saved</span>`
                  : `<button class="author-result-add" data-name="${esc(name)}" data-img="${esc(img||'')}">+ Add</button>`}
      </div>`;
    }).join('');
    res.onclick = e => {
      const btn = e.target.closest('.author-result-add');
      if (!btn) return;
      addAuthor(btn.dataset.name, btn.dataset.img || null);
      clearInlineAuthorSearch();
    };
  } catch { res.innerHTML = '<p class="btr-status">Error – please try again.</p>'; }
}

function clearInlineAuthorSearch() {
  const input = document.getElementById('inline-author-search');
  const res   = document.getElementById('inline-author-results');
  const clear = document.getElementById('ias-clear');
  if (input) input.value = '';
  if (res)   { res.classList.add('hidden'); res.innerHTML = ''; }
  if (clear) clear.classList.add('hidden');
}

function renderInlineSuggestedChips() {
  const container = document.getElementById('inline-suggested-chips');
  if (!container) return;
  const allSuggestions = [...new Set([...S.customSuggestedAuthors, ...SUGGESTED_AUTHORS])];
  const visible = allSuggestions.filter(n => !S.dismissedAuthors.has(n));
  const hasDismissed = S.dismissedAuthors.size > 0 || S.customSuggestedAuthors.some(n => S.dismissedAuthors.has(n));
  container.innerHTML = visible.map(name => {
    const added = S.authors.some(a => !a.hidden && a.name.toLowerCase()===name.toLowerCase());
    if (added) return '';
    return `<button class="suggested-chip has-x" data-name="${esc(name)}">
      <span class="chip-name">${esc(name)}</span>
      <span class="chip-sep"></span>
      <span class="chip-x" onclick="event.stopPropagation();dismissSuggestedAuthor('${esc(name)}')">✕</span>
    </button>`;
  }).join('') + (hasDismissed ? `<button class="author-tips-reset" onclick="resetDismissedAuthors()">Reset</button>` : '');
  container.onclick = e => {
    if (e.target.classList.contains('chip-x')) return;
    const btn = e.target.closest('button[data-name]');
    if (!btn || btn.disabled) return;
    addAuthor(btn.dataset.name, null);
  };
}

async function fetchBooksForAuthor(name) {
  const data = await fetchJson(`${API}?q=inauthor:${encodeURIComponent('"'+name+'"')}&maxResults=40&orderBy=newest&langRestrict=en`);
  const last  = name.split(' ').slice(-1)[0].toLowerCase();
  return dedupeRaw((data.items||[])
    .filter(i => isEnglish(i) && (i.volumeInfo?.authors||[]).some(a => a.toLowerCase().includes(last))))
    .map(i => ({
      id: i.id, googleId: i.id,
      title:   i.volumeInfo?.title   || 'Unknown',
      subtitle:i.volumeInfo?.subtitle|| '',
      authors: i.volumeInfo?.authors || [name],
      coverId: i.volumeInfo?.imageLinks?.thumbnail?.replace('http://','https://')||null,
      year:   (i.volumeInfo?.publishedDate||'').slice(0,4),
      genres:  i.volumeInfo?.categories||[],
      description: stripHtml(i.volumeInfo?.description||'').slice(0,500),
      rating: null, note:'', isFavorite:false, isNew:false, addedAt:Date.now(),
    }));
}

async function checkNewBooksForAuthor(author) {
  // Only books from the current or last year (e.g. 2025 or 2026)
  const cutoffYear = new Date().getFullYear() - 1;
  const last = author.name.split(' ').slice(-1)[0].toLowerCase();
  const data  = await fetchJson(`${API}?q=inauthor:${encodeURIComponent('"'+author.name+'"')}&maxResults=20&orderBy=newest&langRestrict=en`);
  return dedupeRaw((data.items||[])
    .filter(i => {
      const yr = parseInt((i.volumeInfo?.publishedDate||'').slice(0,4));
      const authorsOk = (i.volumeInfo?.authors||[]).some(a=>a.toLowerCase().includes(last));
      return yr && yr >= cutoffYear && authorsOk && isEnglish(i);
    }))
    .map(i => ({ id:i.id, googleId:i.id, title:i.volumeInfo?.title||'?',
      authors:i.volumeInfo?.authors||[author.name],
      coverId:i.volumeInfo?.imageLinks?.thumbnail?.replace('http://','https://')||null,
      year:(i.volumeInfo?.publishedDate||'').slice(0,4),
      genres:i.volumeInfo?.categories||[], authorName:author.name, authorId:author.id }));
}

// Maps raw Google Books items → our book objects
function mapBookItems(items) {
  return items.map(i => ({
    id:i.id, title:i.volumeInfo?.title||'?', authors:i.volumeInfo?.authors||[],
    coverId:i.volumeInfo?.imageLinks?.thumbnail?.replace('http://','https://')||null,
    year:(i.volumeInfo?.publishedDate||'').slice(0,4),
    description:stripHtml(i.volumeInfo?.description||'').slice(0,500),
  }));
}

// Shared helper: fetch books for a genre, sorted newest first.
// genreName = original genre label → checked against GENRE_AUTHORS (array of authors, queried individually)
// apiQuery  = fallback; "NEW:" prefix = free-text + newest + langRestrict=de
async function fetchBooksForGenre(apiQuery, genreName = '') {
  const authors = GENRE_AUTHORS[genreName];
  if (authors) {
    // Query each author individually (OR doesn't work in Google Books API), merge + dedupe
    const results = await Promise.all(
      authors.slice(0, 3).map(name =>
        fetchJson(`${API}?q=inauthor:${encodeURIComponent('"'+name+'"')}&orderBy=newest&langRestrict=en&maxResults=15`)
          .then(d => d.items || []).catch(() => [])
      )
    );
    const seenId = new Set();
    const merged = results.flat().filter(i => {
      if (seenId.has(i.id)) return false;
      seenId.add(i.id);
      return isEnglish(i);
    });
    return dedupeRaw(merged)
      .sort((a,b) => {
        const ya = parseInt((a.volumeInfo?.publishedDate||'0000').slice(0,4)) || 0;
        const yb = parseInt((b.volumeInfo?.publishedDate||'0000').slice(0,4)) || 0;
        return yb - ya;
      })
      .slice(0, 16)
      .map(i => mapBookItems([i])[0]);
  }

  let url, filterYear = false;
  if (apiQuery.startsWith('NEW:')) {
    url = `${API}?q=${encodeURIComponent(apiQuery.slice(4))}&maxResults=40&orderBy=newest&langRestrict=en`;
    filterYear = true;
  } else {
    url = `${API}?q=subject:${encodeURIComponent(apiQuery)}&maxResults=40&orderBy=relevance&langRestrict=en`;
  }
  const data = await fetchJson(url);
  return mapBookItems(
    dedupeRaw((data.items||[])
      .filter(i => {
        if (!isEnglish(i)) return false;
        if (!filterYear) return true;
        const yr = parseInt((i.volumeInfo?.publishedDate||'').slice(0,4));
        return !yr || yr >= 2018;
      }))
      .sort((a,b) => {
        const ya = parseInt((a.volumeInfo?.publishedDate||'0000').slice(0,4)) || 0;
        const yb = parseInt((b.volumeInfo?.publishedDate||'0000').slice(0,4)) || 0;
        return yb - ya;
      })
      .slice(0, 16)
  );
}

async function fetchPersonalizedSuggestions() {
  const knownAuthors = new Set(S.authors.map(a => a.name.toLowerCase()));
  const ownedGoogleIds = new Set();
  S.authors.forEach(a => (S.books[a.id]||[]).forEach(b => ownedGoogleIds.add(b.googleId)));

  const likedAuthors = S.authors.filter(a =>
    !a.hidden && (S.books[a.id]||[]).some(b => b.rating === 'liked' && !b.hiddenFromList)
  );

  if (likedAuthors.length > 0) {
    const authorGenreMap = buildAuthorGenreMap();
    const genreScore = {};
    const genreBecause = {};
    for (const a of likedAuthors) {
      for (const g of (authorGenreMap[a.name.toLowerCase()]||[])) {
        genreScore[g] = (genreScore[g]||0)+2;
        if (!genreBecause[g]) genreBecause[g] = a.name;
      }
      (S.books[a.id]||[]).filter(b => b.rating==='liked' && !b.hiddenFromList).forEach(b => {
        (b.genres||[]).filter(g => !SKIP_GENRES.has(g) && !isGermanGenre(g) && (GENRE_AUTHORS[g]||isKnownGenre(g))).forEach(g => {
          genreScore[g] = (genreScore[g]||0)+1;
          if (!genreBecause[g]) genreBecause[g] = a.name;
        });
      });
    }
    const rankedGenres = Object.keys(genreScore).sort((a,b)=>genreScore[b]-genreScore[a]);
    // Step 1: similar authors
    const sugAuthors = [];
    const seen = new Set();
    for (const genre of rankedGenres)
      for (const sug of (GENRE_AUTHORS[genre]||[]))
        if (!seen.has(sug.toLowerCase()) && !knownAuthors.has(sug.toLowerCase())) {
          seen.add(sug.toLowerCase());
          sugAuthors.push({ name: sug, because: genreBecause[genre]||likedAuthors[0].name });
        }
    if (sugAuthors.length > 0) {
      const books = [];
      for (const { name: sugName, because } of sugAuthors.slice(0,8)) {
        try {
          const ab = await fetchBooksForAuthor(sugName);
          ab.filter(b => !ownedGoogleIds.has(b.googleId)).slice(0,3)
            .forEach(b => books.push({...b, _because: because}));
        } catch {}
        if (books.length >= 16) break;
      }
      if (books.length >= 1) return limitPerAuthor(dedupeBooks(books), 3).slice(0,16);
    }
    // Step 2: genre bestseller search
    const because = likedAuthors[0]?.name;
    const searchGenres = rankedGenres.filter(g => GENRE_API_MAP[g]||GENRE_EN_MAP[g]).slice(0,3);
    if (searchGenres.length > 0) {
      const books = [];
      for (const genre of searchGenres) {
        const gb = await fetchBooksForGenre(genreForApi(genre), genre);
        gb.filter(b => !knownAuthors.has((b.authors?.[0]||'').toLowerCase()) && !ownedGoogleIds.has(b.googleId))
          .slice(0,6).forEach(b => books.push({...b, _because: because}));
        if (books.length >= 16) break;
      }
      if (books.length >= 1) return limitPerAuthor(dedupeBooks(books), 3).slice(0,16);
    }
  }
  // No liked books → use genres from ALL books
  const allGenres = {};
  S.authors.filter(a=>!a.hidden).forEach(a => {
    (S.books[a.id]||[]).filter(b=>!b.hiddenFromList).forEach(b => {
      (b.genres||[]).filter(g=>!SKIP_GENRES.has(g)&&!isGermanGenre(g)&&isKnownGenre(g)&&GENRE_API_MAP[g]).forEach(g => {
        allGenres[g] = (allGenres[g]||0)+1;
      });
    });
  });
  const topGenres = Object.entries(allGenres).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([g])=>g);
  if (topGenres.length > 0) {
    const books = [];
    for (const genre of topGenres) {
      const gb = await fetchBooksForGenre(genreForApi(genre), genre);
      gb.filter(b=>!knownAuthors.has((b.authors?.[0]||'').toLowerCase())&&!ownedGoogleIds.has(b.googleId))
        .slice(0,6).forEach(b=>books.push(b));
      if (books.length >= 16) break;
    }
    if (books.length >= 1) return limitPerAuthor(dedupeBooks(books),3).slice(0,16);
  }
  return fetchNYTBestsellers();
}

async function fetchGenreSuggestions(stats) {
  // Prefer genres from liked books, fall back to any genre from saved authors' books
  let top = Object.entries(stats).filter(([g])=>!SKIP_GENRES.has(g) && !isGermanGenre(g)).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([g])=>g);
  if (!top.length) {
    const fromBooks = new Set();
    S.authors.forEach(a => (S.books[a.id]||[]).forEach(b =>
      (b.genres||[]).filter(g=>!SKIP_GENRES.has(g) && !isGermanGenre(g)).forEach(g=>fromBooks.add(g))
    ));
    top = [...fromBooks].slice(0,3);
  }
  // Fallback: beliebte deutsche Genres wenn noch keine Daten vorhanden
  if (!top.length) top = ['Self-Help', 'Thriller', 'Biography'];
  return await fetchBooksForGenre(genreForApi(top[0]), top[0]);
}

/* ===== BOOK TITLE SEARCH ===== */
let _bookTimer = null;
function onBookTitleInput(v) {
  document.getElementById('bts-clear').classList.toggle('hidden', !v.trim());
  const res = document.getElementById('book-title-results');
  if (!v.trim()) { res.classList.add('hidden'); res.innerHTML=''; return; }
  res.classList.remove('hidden');
  res.innerHTML = '<p class="btr-status">Searching …</p>';
  clearTimeout(_bookTimer);
  _bookTimer = setTimeout(() => searchBookByTitle(v.trim()), 420);
}

function clearBookTitleSearch() {
  document.getElementById('book-title-search').value='';
  document.getElementById('book-title-results').classList.add('hidden');
  document.getElementById('book-title-results').innerHTML='';
  document.getElementById('bts-clear').classList.add('hidden');
}

async function searchBookByTitle(query) {
  const res = document.getElementById('book-title-results');
  const ql  = query.toLowerCase();
  const local = [];
  S.authors.forEach(a => (S.books[a.id]||[]).forEach(b => {
    if (b.title.toLowerCase().includes(ql)) local.push({...b, _authorName:a.name, _local:true});
  }));
  let api = [];
  try {
    const data = await fetchJson(`${API}?q=${encodeURIComponent(query)}&maxResults=8&langRestrict=en&fields=items(id,volumeInfo(title,authors,imageLinks,publishedDate))`);
    api = (data.items||[]).map(i => ({
      id:i.id, title:i.volumeInfo?.title||'', _local:false,
      _authorName:(i.volumeInfo?.authors||[]).join(', '),
      coverId:i.volumeInfo?.imageLinks?.thumbnail?.replace('http://','https://')||null,
      year:(i.volumeInfo?.publishedDate||'').slice(0,4),
    })).filter(b => b.title.toLowerCase().includes(ql)||query.length<5);
  } catch {}
  const seen = new Set(local.map(b=>b.title.toLowerCase()));
  const all  = [...local, ...api.filter(b=>!seen.has(b.title.toLowerCase()))].slice(0,9);
  if (!all.length) { res.innerHTML='<p class="btr-status">No books found.</p>'; return; }
  res.innerHTML = all.map(book => {
    const savedAuthor     = S.authors.find(a => a.name.toLowerCase()===(book._authorName||'').toLowerCase());
    const bookAlreadySaved = savedAuthor && (S.books[savedAuthor.id]||[]).some(b => b.googleId===book.id);
    const isRated          = book._local && !!book.rating;
    const cov              = book.coverId ? `<img class="btr-cover" src="${book.coverId}" alt="" loading="lazy">` : `<div class="btr-cover-ph">📖</div>`;
    const onWish           = !book._local && S.wishlist.some(w => w.googleId === book.id);
    let badge = '';
    if (book._local || bookAlreadySaved) {
      badge = `<span class="btr-saved">${isRated?ratingEmoji(book.rating)+' Rated':'✓ In list'}</span>`;
    } else {
      const wishBtn   = `<button class="btn-wish-sm${onWish?' on-wish':''}" data-gid="${esc(book.id)}" data-title="${esc(book.title)}" data-author="${esc(book._authorName||'')}" data-cover="${esc(book.coverId||'')}" data-year="${esc(book.year||'')}" onclick="event.stopPropagation();addToWishlistFromBtn(this)">${onWish?'✓🛒':'🛒'}</button>`;
      const bookBtn   = book._authorName
        ? `<button class="btn-add-from-search" data-gid="${esc(book.id)}" data-title="${esc(book.title)}" data-author="${esc(book._authorName||'')}" data-cover="${esc(book.coverId||'')}" data-year="${esc(book.year||'')}" onclick="event.stopPropagation();addBookDirectFromBtn(this)">+ Book</button>`
        : '';
      badge = `<div class="btr-badge-row">${bookBtn}${wishBtn}</div>`;
    }
    return `<div class="btr-item${isRated?' already-read':''}" ${(book._local||bookAlreadySaved) ? `onclick="jumpToBook('${book.authorId||savedAuthor?.id}','${book._local?book.id:(savedAuthor?.id+'_'+book.id)}')"` : ''}>
      ${cov}<div class="btr-info"><div class="btr-title">${esc(book.title)}</div><div class="btr-author">${esc(book._authorName)}${book.year?' · '+book.year:''}</div></div>${badge}
    </div>`;
  }).join('');
}

function jumpToBook(authorId, bookId) {
  clearBookTitleSearch();
  const card = document.getElementById(`author-${authorId}`);
  if (card && !card.classList.contains('expanded')) card.classList.add('expanded');
  setTimeout(() => { toggleBookExpand(authorId, bookId); document.getElementById(`bc-${bookId}`)?.scrollIntoView({behavior:'smooth',block:'center'}); }, 100);
}
async function addAuthorFromSearch(name) { await addAuthor(name, null); }
function addBookDirectFromBtn(btn) {
  addBookDirect(btn.dataset.gid, btn.dataset.title, btn.dataset.author, btn.dataset.cover, btn.dataset.year);
}

/* ===== PER-AUTHOR BOOK FILTER ===== */
function filterAuthorBooks(authorId, query) {
  S.authorBookFilter[authorId] = query;
  const books = dedupeBooks((S.books[authorId]||[]).filter(b => !query || b.title.toLowerCase().includes(query.toLowerCase())));
  const grid  = document.getElementById(`grid-${authorId}`);
  const count = document.getElementById(`count-${authorId}`);
  if (grid)  grid.innerHTML  = renderBooksGrid(books, authorId);
  if (count) count.textContent = `${books.length} ${books.length===1?'book':'books'}`;
}

/* ===== LOGIN ===== */
function doLogin() {
  const code = document.getElementById('login-code').value.trim();
  if (code.length < 3) { document.getElementById('login-error').classList.remove('hidden'); return; }
  S.code = code.toLowerCase().replace(/\s+/g,'-');
  localStorage.setItem('bw_code', S.code);
  startApp();
}
function startApp() {
  S.dismissedAuthors = loadDismissedAuthors();
  S.customSuggestedAuthors = loadCustomSuggestions();
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  loadAndRender();
}

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', () => {
  if (!initFirebase()) {
    document.querySelector('.login-sub').textContent = 'Firebase is not set up yet – please read SETUP.md.';
    return;
  }
  const saved = localStorage.getItem('bw_code');
  if (saved) { S.code = saved; startApp(); }
});

async function loadAndRender() {
  showLoading('Loading books …');
  try { await loadAllData(); renderAutoren(); renderAlleBuecher(); renderFavorites(); renderMerkliste(); renderStatistik(); await loadDiscover(); }
  catch(e) { console.error(e); }
  finally { hideLoading(); }
}

/* ===== NAVIGATION ===== */
const DISCOVER_REFRESH_MS = 6 * 60 * 60 * 1000; // 6 hours
let _lastDiscoverLoad = 0;

function switchTab(tab) {
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.toggle('nav-active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id===`tab-${tab}`));
  if (tab==='statistik') renderStatistik();
  if (tab==='merkliste') renderMerkliste();
  if (tab==='entdecken') {
    if (Date.now() - _lastDiscoverLoad > DISCOVER_REFRESH_MS) loadDiscover();
    else renderDiscover();
  }
}

function goToNewBook(authorId) {
  switchTab('entdecken');
  // Give the tab a moment to become visible, then scroll to the author's new book
  requestAnimationFrame(() => {
    const nrl = document.getElementById('new-releases-list');
    if (!nrl) return;
    const cards = nrl.querySelectorAll('.disc-card');
    for (const card of cards) {
      try {
        const book = JSON.parse(card.dataset.book.replace(/&#39;/g,"'"));
        if (book.authorId === authorId) {
          card.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
          card.style.outline = '2.5px solid var(--rose)';
          card.style.borderRadius = '13px';
          setTimeout(() => { card.style.outline = ''; }, 2000);
          break;
        }
      } catch {}
    }
  });
}

/* ===== LOADING ===== */
function showLoading(text='Loading …') {
  document.getElementById('loading-text').textContent=text;
  document.getElementById('loading-overlay').classList.remove('hidden');
}
function hideLoading() { document.getElementById('loading-overlay').classList.add('hidden'); }

/* ===== MODALS ===== */
function handleModalClick(e, modalId) {
  if (e.target.id === modalId) {
    if (modalId==='modal-edit-book')   closeEditBookModal();
    if (modalId==='modal-disc-detail') closeDiscDetail();
  }
}

async function addAuthor(name, imgUrl) {
  const existingHidden = S.authors.find(a => a.hidden && a.name.toLowerCase()===name.toLowerCase());
  if (existingHidden) {
    existingHidden.hidden = false;
    showLoading(`Loading books by ${name} …`);
    try {
      const books  = await fetchBooksForAuthor(name);
      const genres = [...new Set(books.flatMap(b=>b.genres))].slice(0,5);
      const withAuth = books.map(b => ({...b, authorId: existingHidden.id, id:`${existingHidden.id}_${b.googleId}`}));
      if (genres.length) existingHidden.genres = genres;
      S.books[existingHidden.id] = withAuth;
      await col('authors').doc(existingHidden.id).update({ hidden: false, genres: existingHidden.genres });
      await Promise.all(withAuth.map(b => saveBook(b)));
    } catch { await col('authors').doc(existingHidden.id).update({ hidden: false }); }
    hideLoading();
    renderAutoren(); renderAlleBuecher();
    return;
  }
  if (S.authors.some(a => a.name.toLowerCase()===name.toLowerCase())) return;
  clearInlineAuthorSearch();
  showLoading(`Loading books by ${name} …`);
  let author, withAuth;
  try {
    const books  = await fetchBooksForAuthor(name);
    const genres = [...new Set(books.flatMap(b=>b.genres))].slice(0,5);
    const authorId = `a_${Date.now()}`;
    author   = { id:authorId, name, imageUrl:imgUrl?imgUrl.replace('http://','https://'):null, genres, addedAt:Date.now(), lastChecked:Date.now(), newCount:0 };
    withAuth = books.map(b => ({...b, authorId, id:`${authorId}_${b.googleId}`}));
  } catch(e) { console.error(e); hideLoading(); return; }
  S.authors.push(author);
  S.books[author.id] = withAuth;
  hideLoading();
  renderAutoren(); renderAlleBuecher();
  try {
    await saveAuthor(author);
    await Promise.all(withAuth.map(b => saveBook(b)));
  } catch(e) { console.error('Firestore save error:', e); }
}

/* ===== RENDER: AUTOREN ===== */
function renderAutoren() {
  renderInlineSuggestedChips();
  const list = document.getElementById('authors-list');
  if (!S.authors.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🍁</div><p>No authors saved yet.</p><p class="empty-hint">Search for an author above!</p></div>`;
    return;
  }
  list.innerHTML = S.authors.map(author => {
    const books    = S.books[author.id]||[];
    const readCount= books.filter(b=>b.rating).length;
    const av = author.imageUrl
      ? `<img class="author-avatar" src="${author.imageUrl}" alt="${esc(author.name)}">`
      : `<div class="author-avatar-placeholder">✍️</div>`;
    const genres = (author.genres||[]).slice(0,4).map(g=>`<span class="genre-tag">${esc(g)}</span>`).join('');
    const newB   = (author.newCount||0)>0 ? `<span class="author-new-badge" onclick="event.stopPropagation();goToNewBook('${author.id}')">🆕 ${author.newCount} new</span>` : '';
    return `<div class="author-card" id="author-${author.id}">
      <div class="author-header" onclick="toggleAuthor('${author.id}')">
        ${av}
        <div class="author-info">
          <div class="author-name">${esc(author.name)}</div>
          <div class="author-meta">${books.length} books · ${readCount} rated</div>
          <div class="author-genres">${genres}</div>
        </div>
        <div class="author-actions">${newB}<button class="author-delete-btn" onclick="event.stopPropagation();startDeleteAuthor('${author.id}','${esc(author.name)}')">🗑</button><span class="author-toggle">▼</span></div>
      </div>
      <div class="author-books">
        <div class="author-book-filter">
          <input type="text" placeholder="🔍 Search books …"
                 value="${esc(S.authorBookFilter[author.id]||'')}"
                 oninput="filterAuthorBooks('${author.id}',this.value)">
          <span class="author-books-count" id="count-${author.id}">${books.length} books</span>
        </div>
        <div class="books-grid" id="grid-${author.id}">${renderBooksGrid(books,author.id)}</div>
        <div id="expand-${author.id}"></div>
      </div>
    </div>`;
  }).join('');
}

function toggleAuthor(id) { document.getElementById(`author-${id}`)?.classList.toggle('expanded'); }

function renderBooksGrid(books, authorId) {
  books = dedupeBooks(books);
  if (!books.length) return `<p style="color:var(--tl);font-size:13px;padding:8px 0;grid-column:1/-1;font-family:'Cormorant Garamond',serif;font-style:italic">No books found.</p>`;
  return books.map(book => {
    const badge   = book.rating ? `<div class="book-rating-badge">${ratingEmoji(book.rating)}</div>` : '';
    const ribbon  = book.isNew  ? `<div class="book-new-ribbon">New</div>` : '';
    const isExp   = S.expandedBook?.bookId===book.id;
    const cover   = book.coverId
      ? `<img class="book-cover" src="${book.coverId}" alt="${esc(book.title)}" loading="lazy">`
      : `<div class="book-cover-placeholder"><span class="ph-icon">📖</span><span class="ph-title">${esc(book.title)}</span></div>`;
    return `<div class="book-card ${isExp?'expanded-active':''} ${book.rating?'is-read':''}" id="bc-${book.id}" onclick="toggleBookExpand('${authorId}','${book.id}')">
      <div class="book-cover-wrap">${cover}${badge}${ribbon}</div>
      <div class="book-card-label">${esc(book.title)}</div>
    </div>`;
  }).join('');
}

async function toggleBookExpand(authorId, bookId) {
  const container = document.getElementById(`expand-${authorId}`);
  if (S.expandedBook?.bookId===bookId) { openEditBookModal(authorId,bookId); return; }
  S.expandedBook = {authorId,bookId};
  document.querySelectorAll(`#grid-${authorId} .book-card`).forEach(c => c.classList.toggle('expanded-active', c.id===`bc-${bookId}`));
  const book   = getBook(authorId,bookId);
  const author = S.authors.find(a=>a.id===authorId);
  if (!book) return;
  container.innerHTML = renderBookExpand(book, author?.name||'');
  container.scrollIntoView({behavior:'smooth',block:'nearest'});
  if (book.googleId) {
    // Always fetch full description (cached version may be truncated)
    try {
      const data = await fetchJson(`${API}/${book.googleId}?fields=volumeInfo(description)`);
      const desc = stripHtml(data.volumeInfo?.description||'');
      if (desc && desc !== book.description) {
        book.description = desc;
        updateBook(bookId, {description: desc});
        const descEl = container.querySelector('.expand-description-wrap');
        if (descEl) descEl.innerHTML = `<div class="expand-description">${esc(desc)}</div>`;
      }
    } catch {}
  }
}

function closeBookExpand(authorId) {
  const c = document.getElementById(`expand-${authorId}`);
  if (c) c.innerHTML='';
  document.querySelectorAll(`#grid-${authorId} .book-card`).forEach(c=>c.classList.remove('expanded-active'));
  if (S.expandedBook?.authorId===authorId) S.expandedBook=null;
}

function renderBookExpand(book, authorName) {
  const emoji = book.rating ? ratingEmoji(book.rating) : null;
  const label = {liked:'Love it!',neutral:'Ok',disliked:'Not for me'}[book.rating]||'';
  const descContent = book.description ? `<div class="expand-description">${esc(book.description)}</div>` : `<div class="expand-desc-loading">Loading description …</div>`;
  return `<div class="book-expand">
    <div class="expand-title">${esc(book.title)}</div>
    <div class="expand-author">${esc(authorName)}${book.year?' · '+book.year:''}</div>
    <div class="expand-description-wrap">${descContent}</div>
    ${emoji ? `<div class="expand-rating"><span class="expand-emoji">${emoji}</span><span class="expand-rating-text">${label}</span></div>`
            : `<div class="expand-rating"><span class="expand-rating-text">Not rated yet – tap again to edit!</span></div>`}
    ${book.note ? `<div class="expand-note">${esc(book.note)}</div>`
                : `<div class="expand-note expand-note-empty">No note yet.</div>`}
    <div class="expand-actions">
      <button class="btn-edit" onclick="openEditBookModal('${book.authorId}','${book.id}')">✏️ Rate &amp; Note</button>
      <button class="btn-fav-toggle ${book.isFavorite?'is-fav':''}" onclick="quickToggleFavorite('${book.authorId}','${book.id}')">
        ${book.isFavorite?'⭐ Favorite':'☆ Favorite'}
      </button>
      <button class="btn-wish" onclick="addBookToWishlist('${book.authorId}','${book.id}')">🛒 Wishlist</button>
      <button class="btn-secondary" onclick="closeBookExpand('${book.authorId}')">Close</button>
    </div>
  </div>`;
}

/* ===== RENDER: ALLE BÜCHER ===== */
function renderAlleBuecher() {
  const list = document.getElementById('books-list');
  let all = [];
  S.authors.forEach(a => {
    const authorBooks = dedupeBooks(S.books[a.id]||[]).filter(b => !b.hiddenFromList);
    const globalSeen  = new Map();
    authorBooks.forEach(b => {
      const k = normTitle(b.title);
      const ex = globalSeen.get(k);
      if (!ex || (b.rating && !ex.rating)) globalSeen.set(k, b);
    });
    [...globalSeen.values()].forEach(b => all.push({...b, _authorName: a.name}));
  });
  const titleSeen = new Map();
  all.forEach(b => {
    const k = normTitle(b.title);
    const ex = titleSeen.get(k);
    if (!ex || (b.rating && !ex.rating)) titleSeen.set(k, b);
  });
  all = [...titleSeen.values()];
  if (S.bookFilter==='gelesen')   all = all.filter(b=>b.rating);
  if (S.bookFilter==='favoriten') all = all.filter(b=>b.isFavorite);
  all.sort((a,b) => { if(b.isFavorite!==a.isFavorite) return b.isFavorite?1:-1; if(!!b.rating!==!!a.rating) return b.rating?1:-1; return a._authorName.localeCompare(b._authorName); });
  if (!all.length) { list.innerHTML = `<div class="empty" id="books-empty"><div class="empty-icon">📖</div><p>No books yet.</p><p class="empty-hint">Add a favorite author first!</p></div>`; return; }
  list.innerHTML = all.map(book => {
    const emoji   = book.rating ? ratingEmoji(book.rating) : '';
    const preview = book.note ? book.note.slice(0,80)+(book.note.length>80?'…':'') : '';
    const rc      = {liked:'has-liked',neutral:'has-neutral',disliked:'has-disliked'}[book.rating]||'';
    const cover   = book.coverId ? `<img class="book-list-thumb" src="${book.coverId}" alt="" loading="lazy">` : `<div class="book-list-thumb-ph">📖</div>`;
    return `<div class="book-list-item ${rc}" id="li-${book.id}" data-author-id="${book.authorId}" data-book-id="${book.id}">
      <div class="book-list-row">
        ${cover}
        <div class="book-list-info">
          <div class="book-list-title">${esc(book.title)}</div>
          <div class="book-list-author">${esc(book._authorName)}${book.year?' · '+book.year:''}</div>
          ${preview?`<div class="book-list-note-preview">${esc(preview)}</div>`:''}
        </div>
        <div class="book-list-right">
          ${emoji?`<span class="book-list-emoji">${emoji}</span>`:''}
          ${book.isFavorite?`<span class="book-fav-star">⭐</span>`:''}
          <span class="book-expand-arrow">▼</span>
        </div>
      </div>
      <div class="book-list-expand">
        ${book.description
          ? `<div class="bl-desc">${esc(book.description)}</div>`
          : (book.googleId ? `<div class="bl-desc-loading">Loading description …</div>` : '')}
        ${book.note?`<div class="expand-note">${esc(book.note)}</div>`:''}
        <div class="expand-actions">
          <button class="btn-edit bl-edit">✏️ Edit</button>
          <button class="btn-fav-toggle ${book.isFavorite?'is-fav':''} bl-fav">
            ${book.isFavorite?'⭐ Favorite':'☆ Favorite'}
          </button>
          <button class="btn-wish bl-wish">🛒 Wishlist</button>
          <button class="btn-remove bl-hide">✕ Remove</button>
        </div>
      </div>
    </div>`;
  }).join('');
  list.onclick = e => {
    const item = e.target.closest('.book-list-item');
    if (!item) return;
    const authorId = item.dataset.authorId;
    const bookId   = item.dataset.bookId;
    if (e.target.closest('.bl-edit'))  { openEditBookModal(authorId, bookId); return; }
    if (e.target.closest('.bl-fav'))   { quickToggleFavorite(authorId, bookId); return; }
    if (e.target.closest('.bl-wish'))  { addBookToWishlist(authorId, bookId); return; }
    if (e.target.closest('.bl-hide'))  { hideBookFromList(authorId, bookId); return; }
    if (e.target.closest('.book-list-row')) {
      if (item.classList.contains('expanded')) { item.classList.remove('expanded'); return; }
      document.querySelectorAll('.book-list-item.expanded').forEach(i=>i.classList.remove('expanded'));
      item.classList.add('expanded');
      lazyLoadListDescription(authorId, bookId, item);
    }
  };
}

function hideBookFromList(authorId, bookId) {
  const book = getBook(authorId, bookId);
  if (!book) return;
  book.hiddenFromList = true;
  updateBook(bookId, { hiddenFromList: true });
  renderAlleBuecher();
  renderDiscover();
}

async function lazyLoadListDescription(authorId, bookId, item) {
  const book = getBook(authorId, bookId);
  if (!book || !book.googleId) return;
  // Always fetch full description — cached version may be truncated
  try {
    const data = await fetchJson(`${API}/${book.googleId}?fields=volumeInfo(description)`);
    const desc = stripHtml(data.volumeInfo?.description||'');
    if (desc) {
      book.description = desc;
      updateBook(bookId, {description: desc});
      const el = item.querySelector('.bl-desc-loading, .bl-desc');
      if (el && item.classList.contains('expanded')) { el.className='bl-desc'; el.textContent=desc; }
    } else {
      const el = item.querySelector('.bl-desc-loading');
      if (el) el.remove();
    }
  } catch { const el=item.querySelector('.bl-desc-loading'); if(el) el.remove(); }
}

function toggleListExpand(authorId, bookId) {
  const item = document.getElementById(`li-${bookId}`);
  if (!item) return;
  if (item.classList.contains('expanded')) { openEditBookModal(authorId,bookId); return; }
  document.querySelectorAll('.book-list-item.expanded').forEach(i=>i.classList.remove('expanded'));
  item.classList.add('expanded');
}

function setBookFilter(filter, btn) {
  S.bookFilter = filter;
  document.querySelectorAll('#tab-buecher .pill').forEach(b=>b.classList.toggle('active', b.dataset.filter===filter));
  renderAlleBuecher();
}

/* ===== RENDER: FAVORITEN ===== */
function filterFavorites(query) {
  S.favSearch = query;
  const clear = document.getElementById('fav-search-clear');
  if (clear) clear.classList.toggle('hidden', !query.trim());
  renderFavorites();
}
function clearFavSearch() {
  S.favSearch = '';
  const inp = document.getElementById('fav-search');
  if (inp) inp.value = '';
  document.getElementById('fav-search-clear')?.classList.add('hidden');
  renderFavorites();
}

function renderFavorites() {
  const grid = document.getElementById('favorites-grid');
  let favs = [];
  S.authors.forEach(a => dedupeBooks(S.books[a.id]||[]).filter(b=>b.isFavorite).forEach(b=>favs.push({...b,_authorName:a.name})));
  if (S.favSearch) {
    const ql = S.favSearch.toLowerCase();
    favs = favs.filter(b => b.title.toLowerCase().includes(ql) || b._authorName.toLowerCase().includes(ql));
  }
  if (!favs.length) {
    const msg = S.favSearch
      ? `<p>No favorite found for „${esc(S.favSearch)}".</p><p class="empty-hint">Try a different search term!</p>`
      : `<p>No favorites saved yet.</p><p class="empty-hint">Click a book and mark it as favorite!</p>`;
    grid.innerHTML = `<div class="empty"><div class="empty-icon">⭐</div>${msg}</div>`;
    return;
  }
  grid.innerHTML = favs.map(book => {
    const cover = book.coverId
      ? `<img class="fav-cover" src="${book.coverId}" alt="${esc(book.title)}" loading="lazy">`
      : `<div class="fav-cover-ph"><span class="ph-icon">📖</span><span class="ph-title">${esc(book.title)}</span></div>`;
    return `<div class="fav-card" data-author-id="${book.authorId}" data-book-id="${book.id}">
      <div class="fav-cover-wrap">${cover}</div>
      <div class="fav-info">
        <div class="fav-title">${esc(book.title)}</div>
        <div class="fav-author">${esc(book._authorName)}</div>
        ${book.note?`<div class="fav-note">${esc(book.note)}</div>`:''}
      </div>
    </div>`;
  }).join('');
  grid.onclick = e => {
    const card = e.target.closest('.fav-card');
    if (!card) return;
    openEditBookModal(card.dataset.authorId, card.dataset.bookId);
  };
}

/* ===== DISCOVER ===== */
async function loadDiscover() {
  const allNew = [];
  for (const author of S.authors.filter(a => !a.hidden)) {
    try {
      const nb = await checkNewBooksForAuthor(author);
      nb.forEach(b=>allNew.push(b));
      if (nb.length) {
        await updateAuthorMeta(author.id,{newCount:nb.length,lastChecked:Date.now()});
        const idx = S.authors.findIndex(a=>a.id===author.id);
        if (idx>=0) { S.authors[idx].newCount=nb.length; S.authors[idx].lastChecked=Date.now(); }
      }
    } catch {}
  }
  S.newReleasesAll = allNew;
  try { S.suggestions = await fetchPersonalizedSuggestions(); } catch { S.suggestions = []; }
  _lastDiscoverLoad = Date.now();
  renderDiscover();
  if (allNew.length) { document.getElementById('new-badge').classList.remove('hidden'); }
  renderAutoren();
}

function renderDiscover() {
  const nrl = document.getElementById('new-releases-list');
  nrl.innerHTML = S.newReleasesAll.length
    ? S.newReleasesAll.map(b=>discCardHtml(b,true)).join('')
    : '<p class="disc-empty">No new books found. Check back later!</p>';
  nrl.onclick = e => {
    const card = e.target.closest('.disc-card');
    if (!card) return;
    openDiscDetail(JSON.parse(card.dataset.book.replace(/&#39;/g,"'")), true);
  };

  renderGenreSelect();

  const sug  = document.getElementById('suggestions-list');
  const hint = document.getElementById('suggestions-hint');
  const ownedNow = new Set();
  S.authors.forEach(a => (S.books[a.id]||[]).forEach(b => { if (!b.hiddenFromList) ownedNow.add(b.googleId); }));
  const visibleSuggestions = S.suggestions.filter(b => !ownedNow.has(b.googleId||b.id));
  if (!visibleSuggestions.length) {
    hint.textContent = 'Rate books with 💚 or choose a genre!';
    sug.innerHTML    = '<p class="disc-empty">No recommendations yet.</p>';
  } else {
    const becauseAuthor = !S.selectedDiscoverGenre && visibleSuggestions.find(b=>b._because)?._because;
    hint.textContent = S.selectedDiscoverGenre
      ? (S.selectedDiscoverGenre.startsWith('AUTHOR:')
          ? `Books by ${S.selectedDiscoverGenre.slice(7)}`
          : `Genre: ${S.selectedDiscoverGenre}`)
      : (becauseAuthor ? `Because you like ${becauseAuthor} …` : 'Based on your ratings');
    sug.innerHTML = visibleSuggestions.map(b=>discCardHtml(b,false)).join('');
  }
  sug.onclick = e => {
    const card = e.target.closest('.disc-card');
    if (!card) return;
    openDiscDetail(JSON.parse(card.dataset.book.replace(/&#39;/g,"'")), false);
  };
}


function loadDismissedAuthors() {
  try { const r = localStorage.getItem(`bw_dismissed_${S.code}`); return new Set(r ? JSON.parse(r) : []); }
  catch { return new Set(); }
}
function saveDismissedAuthors() {
  localStorage.setItem(`bw_dismissed_${S.code}`, JSON.stringify([...S.dismissedAuthors]));
}
function dismissSuggestedAuthor(name) {
  S.dismissedAuthors.add(name);
  saveDismissedAuthors();
  renderInlineSuggestedChips();
}
function resetDismissedAuthors() {
  S.dismissedAuthors.clear();
  saveDismissedAuthors();
  renderInlineSuggestedChips();
}
function loadCustomSuggestions() {
  try { return JSON.parse(localStorage.getItem(`bw_custom_sug_${S.code}`) || '[]'); }
  catch { return []; }
}
function saveCustomSuggestions() {
  localStorage.setItem(`bw_custom_sug_${S.code}`, JSON.stringify(S.customSuggestedAuthors));
}
function addAuthorToSuggestions(name) {
  closeDiscDetail();
  if (!S.customSuggestedAuthors.includes(name)) {
    S.customSuggestedAuthors.unshift(name);
    saveCustomSuggestions();
    renderInlineSuggestedChips();
  }
  switchTab('autoren');
  flashWishBtn(`${name} added to suggestions ✓`);
}

function getDiscoverGenres() {
  const fromBooks = new Set();
  S.authors.forEach(a => (S.books[a.id]||[]).forEach(b =>
    (b.genres||[]).filter(g=>!SKIP_GENRES.has(g) && !isGermanGenre(g)).forEach(g => fromBooks.add(g))
  ));
  const defaults = ['NYT-Bestseller','Self-Help','Spirituality','Psychology','Business','Thriller','Mystery','Fantasy','Sci-Fi','Biography','History','Philosophy','Science','Adventure'];
  const all = [...fromBooks, ...defaults.filter(d => !fromBooks.has(d))];
  return [...new Set(all)].slice(0, 18);
}

function getSuggestedAuthorsForDropdown() {
  const alreadyAdded = new Set(S.authors.map(a => a.name.toLowerCase()));
  // Top genres from liked books
  const topGenres = Object.entries(S.genreStats || {})
    .filter(([g]) => !SKIP_GENRES.has(g) && !isGermanGenre(g))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([g]) => g);
  const seen = new Set();
  const result = [];
  const addAuthorsFromGenre = genre => {
    for (const author of (GENRE_AUTHORS[genre] || [])) {
      if (!seen.has(author) && !alreadyAdded.has(author.toLowerCase())) {
        seen.add(author); result.push(author);
      }
    }
  };
  topGenres.forEach(addAuthorsFromGenre);
  // Fallback defaults if not enough data
  if (result.length < 4) {
    ['Self-Help','Spirituality','Thriller','Biography','Philosophy','Business'].forEach(addAuthorsFromGenre);
  }
  return result.slice(0, 8);
}

function renderGenreSelect() {
  const el = document.getElementById('genre-select');
  if (!el) return;
  const genres = getDiscoverGenres();
  const sugAuthors = getSuggestedAuthorsForDropdown();
  const cur = S.selectedDiscoverGenre || '';
  let html = `<option value="">✨ For you (by ratings)</option>`;
  html += `<optgroup label="📚 Genres">`;
  html += genres.map(g => `<option value="${esc(g)}" ${cur===g?'selected':''}>${esc(g)}</option>`).join('');
  html += `</optgroup>`;
  if (sugAuthors.length) {
    html += `<optgroup label="✍️ Author suggestions for you">`;
    html += sugAuthors.map(a => `<option value="AUTHOR:${esc(a)}" ${cur==='AUTHOR:'+a?'selected':''}>✍️ ${esc(a)}</option>`).join('');
    html += `</optgroup>`;
  }
  el.innerHTML = html;
}

async function onGenreSelectChange(val) {
  S.selectedDiscoverGenre = val || null;
  const hint = document.getElementById('suggestions-hint');
  if (val && val.startsWith('AUTHOR:')) {
    if (hint) hint.textContent = `Books by ${val.slice(7)}`;
  } else {
    if (hint) hint.textContent = val ? `Genre: ${val}` : 'Based on your favorite genres';
  }
  await loadSuggestionsForGenre(S.selectedDiscoverGenre);
}

async function fetchNYTBestsellers() {
  const key = window.NYT_KEY;
  // Without key: use a curated Google Books approximation
  if (!key) {
    const data = await fetchJson(
      `${API}?q=new+york+times+bestseller&orderBy=newest&langRestrict=en&maxResults=40`
    );
    return mapBookItems(dedupeRaw(data.items||[]).filter(isEnglish).sort((a,b)=>{
      const ya=parseInt((a.volumeInfo?.publishedDate||'0').slice(0,4))||0;
      const yb=parseInt((b.volumeInfo?.publishedDate||'0').slice(0,4))||0;
      return yb-ya;
    }).slice(0,16));
  }
  // With key: fetch live NYT list, then find German editions on Google Books
  const nyt = await fetchJson(
    `https://api.nytimes.com/svc/books/v3/lists/current/combined-print-and-e-book-fiction.json?api-key=${key}`
  );
  const nytBooks = (nyt.results?.books || []).slice(0, 15);
  const results = await Promise.all(nytBooks.map(async b => {
    try {
      const q = `intitle:${encodeURIComponent(b.title)}+inauthor:${encodeURIComponent(b.author)}`;
      const gd = await fetchJson(`${API}?q=${q}&langRestrict=en&maxResults=3`);
      const item = (gd.items||[])[0];
      if (!item) return null;
      return {
        id: item.id,
        title: item.volumeInfo?.title || b.title,
        authors: item.volumeInfo?.authors || [b.author],
        coverId: item.volumeInfo?.imageLinks?.thumbnail?.replace('http://','https://') || null,
        year: (item.volumeInfo?.publishedDate||'').slice(0,4),
        description: stripHtml(item.volumeInfo?.description || b.description || '').slice(0,200),
        nytRank: b.rank,
      };
    } catch { return null; }
  }));
  return results.filter(Boolean);
}

async function loadSuggestionsForGenre(genre) {
  const sug  = document.getElementById('suggestions-list');
  const hint = document.getElementById('suggestions-hint');
  sug.innerHTML = '<p class="disc-empty">Loading …</p>';
  try {
    let books;
    if (!genre) {
      books = await fetchPersonalizedSuggestions();
    } else if (genre === 'NYT-Bestseller') {
      books = await fetchNYTBestsellers();
    } else if (genre.startsWith('AUTHOR:')) {
      const authorName = genre.slice(7);
      const data = await fetchJson(
        `${API}?q=inauthor:${encodeURIComponent('"'+authorName+'"')}&orderBy=newest&langRestrict=en&maxResults=40`
      );
      books = mapBookItems(dedupeRaw(data.items||[]).filter(isEnglish).sort((a,b)=>{
        const ya=parseInt((a.volumeInfo?.publishedDate||'0').slice(0,4))||0;
        const yb=parseInt((b.volumeInfo?.publishedDate||'0').slice(0,4))||0;
        return yb-ya;
      }).slice(0,16));
      if (hint) hint.textContent = `Books by ${authorName}`;
    } else {
      books = await fetchBooksForGenre(genreForApi(genre), genre);
    }
    S.suggestions = books;
    if (!books.length) {
      hint.textContent = genre ? `No books for "${genre.startsWith('AUTHOR:')?genre.slice(7):genre}" found` : 'No recommendations found';
      sug.innerHTML = '<p class="disc-empty">Nothing found – try another genre!</p>';
    } else {
      const topG = genre || Object.entries(S.genreStats||{}).filter(([g])=>!SKIP_GENRES.has(g)).sort((a,b)=>b[1]-a[1])[0]?.[0];
      hint.textContent = genre
        ? (genre.startsWith('AUTHOR:') ? `Books by ${genre.slice(7)}` : `Genre: ${genre}`)
        : (topG ? `Because you love ${topG} books …` : 'Popular books');
      sug.innerHTML = books.map(b=>discCardHtml(b,false)).join('');
    }
    sug.onclick = e => {
      const card = e.target.closest('.disc-card');
      if (!card) return;
      openDiscDetail(JSON.parse(card.dataset.book.replace(/&#39;/g,"'")), false);
    };
  } catch { sug.innerHTML = '<p class="disc-empty">Error loading – please try again!</p>'; }
}

function discCardHtml(book, isNew) {
  const authors = Array.isArray(book.authors) ? book.authors.join(', ') : (book.authorName||'');
  const cover   = book.coverId
    ? `<img class="disc-cover" src="${book.coverId}" alt="${esc(book.title)}" loading="lazy">`
    : `<div class="disc-cover-ph"><span class="ph-icon">📚</span><span class="ph-title">${esc(book.title)}</span></div>`;
  const descSnip = book.description ? book.description.slice(0,85)+'…' : '';
  // Status badge on cover
  let statusBadge = '';
  let alreadyRated = false;
  if (isNew && book.authorId) {
    const existing = S.books[book.authorId]?.find(b => b.googleId === (book.googleId||book.id));
    if (existing?.rating) { alreadyRated = true; statusBadge = `<div class="disc-status">${ratingEmoji(existing.rating)}</div>`; }
    else if (existing)    { statusBadge = `<div class="disc-status">📌</div>`; }
  }
  const onWishlist = S.wishlist.some(w => w.googleId === (book.googleId||book.id));
  if (onWishlist) statusBadge = `<div class="disc-status">🛒</div>`;
  const bookData = JSON.stringify(book).replace(/'/g,'&#39;');
  // New releases: show only cover + badge (no text below)
  if (isNew) {
    return `<div class="disc-card${alreadyRated?' already-rated':''}${onWishlist?' on-wishlist':''}" data-book='${bookData}' data-is-new="true">
      <div class="disc-cover-wrap">${cover}${statusBadge}</div>
    </div>`;
  }
  return `<div class="disc-card${onWishlist?' on-wishlist':''}" data-book='${bookData}' data-is-new="false">
    <div class="disc-cover-wrap">${cover}${statusBadge}</div>
    <div class="disc-info">
      <div class="disc-title">${esc(book.title)}</div>
      <div class="disc-author">${esc(authors)}</div>
      ${descSnip?`<div class="disc-desc">${esc(descSnip)}</div>`:''}
    </div>
  </div>`;
}

/* ===== DISC DETAIL MODAL ===== */
let _discBook = null;
let _discIsNew = false;

function openDiscDetail(book, isNew) {
  _discBook = book; _discIsNew = isNew;
  // Cover
  const wrap = document.getElementById('disc-detail-cover-wrap');
  wrap.innerHTML = book.coverId
    ? `<img class="disc-detail-img" src="${book.coverId}" alt="">`
    : `<div class="disc-detail-ph">📚</div>`;
  // Title & author
  const authors = Array.isArray(book.authors) ? book.authors.join(', ') : (book.authorName||'');
  document.getElementById('disc-detail-title').textContent  = book.title;
  document.getElementById('disc-detail-author').textContent = authors + (book.year ? ' · ' + book.year : '');
  // Description — always fetch full text from API (cached version may be truncated)
  const descEl = document.getElementById('disc-detail-desc');
  const gid = book.googleId || book.id;
  if (book.description) {
    descEl.textContent = stripHtml(book.description);
    descEl.classList.remove('hidden');
  } else {
    descEl.textContent = 'Loading description …';
    descEl.classList.remove('hidden');
  }
  if (gid) {
    fetchJson(`${API}/${gid}?fields=volumeInfo(description)`).then(data => {
      const desc = stripHtml(data.volumeInfo?.description||'');
      if (desc) { book.description = desc; descEl.textContent = desc; descEl.classList.remove('hidden'); }
      else if (!book.description) descEl.classList.add('hidden');
    }).catch(()=>{ if (!book.description) descEl.classList.add('hidden'); });
  }
  renderDiscDetailActions(book, isNew);
  // Always show wishlist button
  const wishBtn = document.getElementById('disc-detail-wish');
  if (wishBtn) {
    const gid = book.googleId || book.id;
    const onList = S.wishlist.some(w => w.googleId === gid);
    wishBtn.textContent = onList ? '✓ On Wishlist' : '🛒 Add to Wishlist';
    wishBtn.onclick = () => { addToWishlist(book); wishBtn.textContent='✓ On Wishlist'; };
  }
  document.getElementById('modal-disc-detail').classList.remove('hidden');
}

function renderDiscDetailActions(book, isNew) {
  const el = document.getElementById('disc-detail-actions');
  if (!el) return;
  const bData = JSON.stringify(book).replace(/'/g,"&#39;");

  if (isNew && book.authorId) {
    const existing = S.books[book.authorId]?.find(b => b.googleId === (book.googleId||book.id));
    if (existing) {
      el.innerHTML = existing.rating
        ? `<div class="disc-detail-status">${ratingEmoji(existing.rating)} Already rated</div>
           <button class="disc-detail-btn-primary" onclick="closeDiscDetail();openEditBookModal('${existing.authorId}','${existing.id}')">✏️ Change rating</button>`
        : `<button class="disc-detail-btn-primary" onclick="closeDiscDetail();openEditBookModal('${existing.authorId}','${existing.id}')">✏️ Rate now</button>`;
    } else {
      el.innerHTML = `
        <button class="disc-detail-btn-sage" data-book='${bData}' onclick="addDiscoverBook(this,false);closeDiscDetail()">✓ Already know this</button>
        <button class="disc-detail-btn-primary" data-book='${bData}' onclick="addDiscoverBook(this,true);closeDiscDetail()">✏️ I know this & rate</button>`;
    }
  } else {
    // Suggestion – check if author/book is already known
    const authorName = (Array.isArray(book.authors) ? book.authors[0] : '') || '';
    const knownAuthor = S.authors.find(a => a.name.toLowerCase() === authorName.toLowerCase());
    const gid = book.googleId || book.id;
    const existingBook = knownAuthor ? S.books[knownAuthor.id]?.find(b => b.googleId === gid && !b.hiddenFromList) : null;
    if (existingBook) {
      el.innerHTML = existingBook.rating
        ? `<div class="disc-detail-status">${ratingEmoji(existingBook.rating)} Already rated</div>
           <button class="disc-detail-btn-primary" onclick="closeDiscDetail();openEditBookModal('${existingBook.authorId}','${existingBook.id}')">✏️ Change rating</button>`
        : `<button class="disc-detail-btn-primary" onclick="closeDiscDetail();openEditBookModal('${existingBook.authorId}','${existingBook.id}')">✏️ Rate now</button>`;
    } else if (authorName) {
      const gidE   = esc(book.googleId||book.id||'');
      const titleE = esc(book.title||'');
      const coverE = esc(book.coverId||'');
      const yearE  = esc(book.year||'');
      el.innerHTML = `
        <p class="disc-choice-label">What would you like to do?</p>
        <button class="disc-detail-btn-primary" data-author="${esc(authorName)}" onclick="addAuthorFromDisc(this)">📚 Add author</button>
        <button class="disc-detail-btn-amber"
          data-gid="${gidE}" data-title="${titleE}" data-author="${esc(authorName)}" data-cover="${coverE}" data-year="${yearE}"
          onclick="addSingleBookFromDisc(this)">📖 Add this book</button>
        <button class="disc-detail-btn-sage" data-author="${esc(authorName)}" onclick="addAuthorToSuggestions(this.dataset.author)">⭐ Add to suggestions</button>`;
    } else { el.innerHTML = ''; }
  }
}

function closeDiscDetail() {
  document.getElementById('modal-disc-detail').classList.add('hidden');
  _discBook = null;
}
async function addBookToExistingAuthor(googleId, title, authorName, coverId, year) {
  const author = S.authors.find(a => a.name.toLowerCase()===authorName.toLowerCase());
  if (!author) return;
  const bookId = `${author.id}_${googleId}`;
  const existingInAuthor = (S.books[author.id]||[]).find(b => b.id===bookId);
  if (existingInAuthor) {
    if (existingInAuthor.hiddenFromList) {
      existingInAuthor.hiddenFromList = false;
      await updateBook(bookId, { hiddenFromList: false });
      renderAutoren(); renderAlleBuecher();
      switchTab('books');
      setTimeout(() => document.getElementById(`li-${bookId}`)?.scrollIntoView({behavior:'smooth',block:'center'}), 200);
    } else { jumpToBook(author.id, bookId); }
    return;
  }
  const newBook = {
    id: bookId, googleId, authorId: author.id,
    title, subtitle: '', authors: [authorName],
    coverId: coverId||null, year, genres: [],
    description: '', rating: null, note: '', isFavorite: false, isNew: true, addedAt: Date.now(),
  };
  await saveBook(newBook);
  if (!S.books[author.id]) S.books[author.id] = [];
  S.books[author.id].push(newBook);
  renderAutoren(); renderAlleBuecher();
  if (!author.hidden) {
    switchTab('autoren');
    setTimeout(() => {
      const card = document.getElementById(`author-${author.id}`);
      if (card && !card.classList.contains('expanded')) card.classList.add('expanded');
      setTimeout(() => document.getElementById(`bc-${bookId}`)?.scrollIntoView({behavior:'smooth',block:'center'}), 300);
    }, 100);
  } else {
    switchTab('books');
    setTimeout(() => document.getElementById(`li-${bookId}`)?.scrollIntoView({behavior:'smooth',block:'center'}), 200);
  }
}

async function addBookDirect(googleId, title, authorName, coverId, year) {
  const existing = S.authors.find(a => a.name.toLowerCase()===authorName.toLowerCase());
  if (existing) { await addBookToExistingAuthor(googleId, title, authorName, coverId, year); return; }
  const authorId = 'a_' + Date.now();
  const newAuthor = { id: authorId, name: authorName, genres: [], hidden: true, addedAt: Date.now() };
  await col('authors').doc(authorId).set(newAuthor);
  S.authors.push(newAuthor);
  S.books[authorId] = [];
  await addBookToExistingAuthor(googleId, title, authorName, coverId, year);
}

async function addSingleBookFromDisc(btn) {
  const { gid, title, author: authorName, cover, year } = btn.dataset;
  closeDiscDetail();
  await addBookDirect(gid, title, authorName, cover, year);
  renderDiscover();
}

async function addAuthorFromDisc(btn) {
  const name = btn.dataset.author;
  closeDiscDetail();
  await addAuthor(name, null);
  renderDiscover();
}

async function addDiscoverBook(btn, openRating) {
  const book    = JSON.parse(btn.dataset.book);
  const authorId = book.authorId;
  const bookId   = `${authorId}_${book.googleId||book.id}`;
  const newBook  = {...book, id:bookId, authorId, addedAt:Date.now(), rating:null, note:'', isFavorite:false};
  try {
    await saveBook(newBook);
    if (!S.books[authorId]) S.books[authorId] = [];
    S.books[authorId].push(newBook);
    renderAutoren(); renderAlleBuecher(); renderDiscover();
    if (openRating) openEditBookModal(authorId, bookId);
  } catch(e) { console.error(e); }
}

/* ===== EDIT BOOK MODAL ===== */
function openEditBookModal(authorId, bookId) {
  const book = getBook(authorId,bookId);
  if (!book) return;
  S.editingBook={authorId,bookId}; S.selectedRating=book.rating;
  document.getElementById('edit-modal-title').textContent = book.title;
  document.getElementById('edit-note').value      = book.note||'';
  document.getElementById('edit-favorite').checked= !!book.isFavorite;
  document.querySelectorAll('.rating-opt').forEach(b=>b.classList.toggle('selected',b.dataset.r===book.rating));
  buildYearPicker(book.readYear||null);
  // Description — show cached, then always fetch full from API
  const descEl = document.getElementById('edit-modal-desc');
  if (descEl) {
    if (book.description) {
      descEl.textContent = stripHtml(book.description);
      descEl.classList.remove('hidden');
    } else {
      descEl.textContent = '';
      descEl.classList.add('hidden');
    }
  }
  document.getElementById('modal-edit-book').classList.remove('hidden');
  if (book.googleId) {
    fetchJson(`${API}/${book.googleId}?fields=volumeInfo(description)`).then(data => {
      const desc = stripHtml(data.volumeInfo?.description||'');
      if (desc && descEl) {
        book.description = desc;
        updateBook(bookId, {description: desc});
        descEl.textContent = desc;
        descEl.classList.remove('hidden');
      }
    }).catch(()=>{});
  }
}

function buildYearPicker(selectedYear) {
  const picker = document.getElementById('year-picker');
  if (!picker) return;
  S.selectedReadYear = selectedYear || null;
  const curYear = new Date().getFullYear();
  const years = [];
  for (let y = curYear + 1; y >= 2010; y--) years.push(y);
  picker.innerHTML = `<button class="year-chip ${!selectedYear?'active':''}" data-year="">No year</button>` +
    years.map(y => `<button class="year-chip ${selectedYear==y?'active':''}" data-year="${y}">${y}</button>`).join('');
  picker.onclick = e => {
    const btn = e.target.closest('.year-chip');
    if (!btn) return;
    picker.querySelectorAll('.year-chip').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    S.selectedReadYear = btn.dataset.year ? parseInt(btn.dataset.year) : null;
  };
}

function closeEditBookModal() {
  document.getElementById('modal-edit-book').classList.add('hidden');
  S.editingBook=null; S.selectedRating=null; S.selectedReadYear=null;
}

function pickRating(r) {
  S.selectedRating=r;
  document.querySelectorAll('.rating-opt').forEach(b=>b.classList.toggle('selected',b.dataset.r===r));
}

async function saveBookEdit() {
  const {authorId,bookId} = S.editingBook;
  const updates = {
    rating:     S.selectedRating,
    note:       document.getElementById('edit-note').value.trim(),
    isFavorite: document.getElementById('edit-favorite').checked,
    readYear:   S.selectedReadYear || null,
  };
  const idx = S.books[authorId]?.findIndex(b=>b.id===bookId);
  if (idx>=0) Object.assign(S.books[authorId][idx], updates);
  if (updates.rating==='liked') {
    const book = getBook(authorId,bookId);
    const stats = S.genreStats||{};
    (book?.genres||[]).filter(g=>!SKIP_GENRES.has(g)).forEach(g=>{stats[g]=(stats[g]||0)+1;});
    S.genreStats = stats;
  }
  // Remember what was open before re-render
  const wasExpanded = S.expandedBook ? {...S.expandedBook} : null;
  closeEditBookModal();
  renderAutoren(); renderAlleBuecher(); renderFavorites(); renderStatistik(); renderGenreSelect();
  // Silently update recommendations after a rating
  if (updates.rating === 'liked' && !S.selectedDiscoverGenre) {
    fetchGenreSuggestions(S.genreStats).then(books => { if (books.length) S.suggestions = books; }).catch(()=>{});
  }

  // Restore expanded author + book detail without closing anything
  if (wasExpanded) {
    document.getElementById(`author-${wasExpanded.authorId}`)?.classList.add('expanded');
    const book   = getBook(wasExpanded.authorId, wasExpanded.bookId);
    const author = S.authors.find(a => a.id === wasExpanded.authorId);
    const container = document.getElementById(`expand-${wasExpanded.authorId}`);
    if (book && container) container.innerHTML = renderBookExpand(book, author?.name||'');
  }

  try {
    await updateBook(bookId, updates);
    if (updates.rating==='liked') await saveGenreStats(S.genreStats);
  } catch(e) { console.error('Save error:', e); }
}

/* ===== QUICK FAVORITE ===== */
async function quickToggleFavorite(authorId, bookId) {
  const book = getBook(authorId,bookId); if (!book) return;
  const newFav = !book.isFavorite;
  const idx = S.books[authorId]?.findIndex(b=>b.id===bookId);
  if (idx>=0) {
    S.books[authorId][idx].isFavorite = newFav;
    if (S.expandedBook?.bookId===bookId) {
      const a=S.authors.find(a=>a.id===authorId);
      const c=document.getElementById(`expand-${authorId}`);
      if (c) c.innerHTML=renderBookExpand(S.books[authorId][idx],a?.name||'');
    }
  }
  renderFavorites(); renderAlleBuecher(); renderStatistik();
  try { await updateBook(bookId,{isFavorite:newFav}); } catch(e) { console.error(e); }
}

/* ===== MERKLISTE ===== */
function addToWishlist(book) {
  const gid = book.googleId || book.id;
  if (!gid) return;
  if (S.wishlist.some(w => w.googleId === gid)) {
    flashWishBtn('Already on wishlist ✓'); return;
  }
  const item = {
    id: `wl_${Date.now()}`,
    googleId: gid,
    title: book.title || '',
    authors: Array.isArray(book.authors) ? book.authors : (book.authorName ? [book.authorName] : []),
    coverId: book.coverId || null,
    year: book.year || '',
    addedAt: Date.now(),
  };
  S.wishlist.push(item);
  renderMerkliste();
  updateWishBadge();
  renderDiscover();
  flashWishBtn('Added to wishlist ✓');
  saveWishItem(item).catch(e=>console.error(e));
}

function addBookToWishlist(authorId, bookId) {
  const book = getBook(authorId, bookId);
  if (book) addToWishlist(book);
}

function addToWishlistFromBtn(btn) {
  addToWishlist({
    googleId: btn.dataset.gid, id: btn.dataset.gid,
    title:    btn.dataset.title,
    authors:  [btn.dataset.author],
    coverId:  btn.dataset.cover || null,
    year:     btn.dataset.year || '',
  });
}

function removeFromWishlist(itemId) {
  S.wishlist = S.wishlist.filter(w => w.id !== itemId);
  renderMerkliste();
  updateWishBadge();
  deleteWishItem(itemId).catch(e=>console.error(e));
}

function updateWishBadge() {
  const el = document.getElementById('wish-badge');
  if (!el) return;
  if (S.wishlist.length) { el.textContent=S.wishlist.length; el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}

let _wishFlashTimer = null;
function flashWishBtn(msg) {
  const toast = document.getElementById('wish-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(_wishFlashTimer);
  _wishFlashTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

function renderMerkliste() {
  const list = document.getElementById('wish-list');
  if (!list) return;
  updateWishBadge();
  if (!S.wishlist.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🛒</div><p>Your wishlist is empty.</p><p class="empty-hint">Tap 🛒 on any book to add it!</p></div>`;
    return;
  }
  const sorted = [...S.wishlist].sort((a,b) => b.addedAt - a.addedAt);
  list.innerHTML = sorted.map(item => {
    const authors = Array.isArray(item.authors) ? item.authors.join(', ') : (item.authors||'');
    const cover   = item.coverId
      ? `<img class="wish-cover" src="${item.coverId}" alt="" loading="lazy">`
      : `<div class="wish-cover-ph">📖</div>`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(item.title+' '+authors+' buy')}`;
    return `<div class="wish-item" data-gid="${esc(item.googleId||'')}" onclick="toggleWishDesc(this,event)">
      ${cover}
      <div class="wish-info">
        <div class="wish-title">${esc(item.title)}</div>
        <div class="wish-author">${esc(authors)}${item.year?' · '+item.year:''}</div>
      </div>
      <div class="wish-btns">
        <a class="wish-buy" href="${searchUrl}" target="_blank" rel="noopener" title="Search online">🔍 Buy</a>
        <button class="wish-del" data-id="${esc(item.id)}" onclick="event.stopPropagation();removeFromWishlist(this.dataset.id)" title="Remove">✕</button>
      </div>
      <div class="wish-desc">Loading …</div>
    </div>`;
  }).join('');
}

async function toggleWishDesc(item, e) {
  if (e.target.closest('.wish-btns') || e.target.closest('a')) return;
  const descEl = item.querySelector('.wish-desc');
  if (!descEl) return;
  if (item.classList.contains('expanded')) {
    item.classList.remove('expanded'); return;
  }
  item.classList.add('expanded');
  if (descEl.dataset.loaded) return;
  const gid = item.dataset.gid;
  if (!gid) { descEl.textContent = 'No description available.'; descEl.dataset.loaded = '1'; return; }
  try {
    const data = await fetchJson(`${API}/${gid}?fields=volumeInfo(description)`);
    const desc = stripHtml(data.volumeInfo?.description || '');
    descEl.textContent = desc || 'No description available.';
  } catch { descEl.textContent = 'Could not load description.'; }
  descEl.dataset.loaded = '1';
}

/* ===== STATISTIK ===== */
function renderStatistik() {
  const overviewEl = document.getElementById('stats-overview');
  const timelineEl = document.getElementById('stats-timeline');
  const hintEl     = document.getElementById('stats-hint');
  if (!overviewEl || !timelineEl) return;

  const allBooks = [];
  S.authors.forEach(a => (S.books[a.id]||[]).forEach(b => {
    if (b.rating) allBooks.push({...b, _authorName: a.name});
  }));

  const total    = allBooks.length;
  const favs     = allBooks.filter(b=>b.isFavorite).length;
  const liked    = allBooks.filter(b=>b.rating==='liked').length;
  const neutral  = allBooks.filter(b=>b.rating==='neutral').length;
  const disliked = allBooks.filter(b=>b.rating==='disliked').length;
  const authorCounts = {};
  allBooks.forEach(b => { authorCounts[b._authorName]=(authorCounts[b._authorName]||0)+1; });
  const topAuthor = Object.entries(authorCounts).sort((a,b)=>b[1]-a[1])[0];
  const topGenre  = Object.entries(S.genreStats||{}).sort((a,b)=>b[1]-a[1])[0];

  overviewEl.innerHTML = `
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-number">${total}</div>
        <div class="stat-label">Read</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${favs}</div>
        <div class="stat-label">Favorites</div>
      </div>
      <div class="stat-card stat-ratings">
        <div class="stat-rating-row"><span>💚</span><span class="stat-rating-count">${liked}</span></div>
        <div class="stat-rating-row"><span>😐</span><span class="stat-rating-count">${neutral}</span></div>
        <div class="stat-rating-row"><span>❌</span><span class="stat-rating-count">${disliked}</span></div>
      </div>
    </div>
    ${topAuthor?`<div class="stat-highlight">⭐ Favorite author: <strong>${esc(topAuthor[0])}</strong> (${topAuthor[1]} books)</div>`:''}
    ${topGenre ?`<div class="stat-highlight">📚 Favorite genre: <strong>${esc(topGenre[0])}</strong></div>`:''}
  `;

  if (!total) {
    if (hintEl) hintEl.textContent = 'Rate books to see your reading stats!';
    timelineEl.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>No rated books yet.</p><p class="empty-hint">Go to a book and rate it!</p></div>`;
    return;
  }
  if (hintEl) hintEl.textContent = 'Tap a book to assign the reading year';

  const byYear = {};
  const unassigned = [];
  allBooks.forEach(b => {
    if (b.readYear) { if (!byYear[b.readYear]) byYear[b.readYear]=[]; byYear[b.readYear].push(b); }
    else unassigned.push(b);
  });
  const years = Object.keys(byYear).map(Number).sort((a,b)=>b-a);
  let html = '';
  years.forEach(y => { html += renderYearSection(y, byYear[y]); });
  if (unassigned.length) html += renderYearSection(null, unassigned);
  timelineEl.innerHTML = html;

  timelineEl.onclick = e => {
    const chip = e.target.closest('.stat-book-chip');
    if (!chip) return;
    openYearReassign(chip.dataset.authorId, chip.dataset.bookId);
  };
}

function renderYearSection(year, books) {
  const title = year ? `📅 ${year}` : '📌 No year yet';
  return `<div class="stat-year-section">
    <div class="stat-year-header">${title}<span class="stat-year-count">${books.length} ${books.length===1?'book':'books'}</span></div>
    <div class="stat-books-strip">
      ${books.map(b => {
        const cover = b.coverId
          ? `<img src="${b.coverId}" alt="" class="stat-book-cover" loading="lazy">`
          : `<div class="stat-book-cover-ph">${esc(b.title.slice(0,2))}</div>`;
        return `<div class="stat-book-chip" data-author-id="${b.authorId}" data-book-id="${b.id}" title="${esc(b.title)}">
          ${cover}
          <div class="stat-rating-badge">${ratingEmoji(b.rating)}</div>
          <div class="stat-book-title">${esc(b.title.length>18?b.title.slice(0,17)+'…':b.title)}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function openYearReassign(authorId, bookId) {
  const book = getBook(authorId, bookId);
  if (!book) return;
  document.querySelectorAll('.year-reassign-popup').forEach(p=>p.remove());
  const curYear = new Date().getFullYear();
  const years = [null, ...Array.from({length: curYear-2009}, (_,i)=>curYear-i)];
  const popup = document.createElement('div');
  popup.className = 'year-reassign-popup';
  popup.innerHTML = `
    <div class="yrp-header">
      <div class="yrp-title">${esc(book.title.length>40?book.title.slice(0,39)+'…':book.title)}</div>
      <button class="yrp-close">✕</button>
    </div>
    <div class="yrp-chips">
      ${years.map(y=>`<button class="yrp-chip ${(book.readYear||null)==y?'active':''}" data-year="${y===null?'':y}">${y||'No year'}</button>`).join('')}
    </div>`;
  document.body.appendChild(popup);
  popup.querySelector('.yrp-close').onclick = () => popup.remove();
  popup.querySelector('.yrp-chips').onclick = async e => {
    const btn = e.target.closest('.yrp-chip');
    if (!btn) return;
    const newYear = btn.dataset.year ? parseInt(btn.dataset.year) : null;
    const idx = S.books[authorId]?.findIndex(b=>b.id===bookId);
    if (idx>=0) S.books[authorId][idx].readYear = newYear;
    popup.remove();
    renderStatistik();
    try { await updateBook(bookId, {readYear: newYear}); } catch {}
  };
  setTimeout(() => {
    document.addEventListener('click', function closePopup(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', closePopup); }
    });
  }, 50);
}

/* ===== HELPERS ===== */
function getBook(authorId,bookId)  { return S.books[authorId]?.find(b=>b.id===bookId)||null; }
function ratingEmoji(r)            { return {liked:'💚',neutral:'😐',disliked:'❌'}[r]||''; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function jstr(v) { return JSON.stringify(v); }
function stripHtml(s) {
  return String(s||'')
    .replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
    .trim();
}

/* ===== DELETE ALL DATA ===== */
async function confirmDeleteAllData() {
  const ok = confirm('⚠️ All authors, books, favorites and wishlist will be permanently deleted!\n\nReally delete everything?');
  if (!ok) return;
  showLoading('Deleting data …');
  try {
    const [authSnap, bookSnap, wishSnap, metaSnap] = await Promise.all([
      col('authors').get(),
      col('books').get(),
      col('wishlist').get(),
      col('meta').get(),
    ]);
    await Promise.all([
      ...authSnap.docs.map(d => d.ref.delete()),
      ...bookSnap.docs.map(d => d.ref.delete()),
      ...wishSnap.docs.map(d => d.ref.delete()),
      ...metaSnap.docs.map(d => d.ref.delete()),
    ]);
    S.authors = []; S.books = {}; S.genreStats = {}; S.wishlist = [];
    S.suggestions = []; S.newReleasesAll = []; S.expandedBook = null;
    S.selectedDiscoverGenre = null;
    renderAutoren(); renderAlleBuecher(); renderFavorites();
    renderStatistik(); renderMerkliste(); renderGenreSelect();
    document.getElementById('new-badge').classList.add('hidden');
    document.getElementById('wish-badge').classList.add('hidden');
  } catch(e) { alert('Error deleting: ' + e.message); }
  finally { hideLoading(); }
}

/* ===== IMPORT / EXPORT ===== */
async function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    authors: S.authors,
    books: S.books,
    wishlist: S.wishlist,
    genreStats: S.genreStats,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `buecherwelt-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  flashWishBtn('Data exported ✓');
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  let payload;
  try { payload = JSON.parse(text); } catch { alert('Invalid file – please choose a My Reading World backup file.'); return; }
  if (!payload.version || !payload.authors) { alert('Invalid format.'); return; }

  const ok = confirm(`Backup from ${payload.exportedAt?.slice(0,10)||'?'} import?\n${payload.authors?.length||0} authors, ${Object.values(payload.books||{}).flat().length} books.\n\nExisting data is kept – new data will be added.`);
  if (!ok) return;

  showLoading('Importing data …');
  try {
    // Authors
    for (const a of (payload.authors||[])) {
      const exists = S.authors.find(x=>x.id===a.id);
      if (!exists) {
        await col('authors').doc(a.id).set(a);
        S.authors.push(a);
        S.books[a.id] = S.books[a.id] || [];
      }
    }
    // Books
    for (const [authorId, books] of Object.entries(payload.books||{})) {
      for (const b of (books||[])) {
        const existing = (S.books[authorId]||[]).find(x=>x.id===b.id);
        if (!existing) {
          await col('books').doc(b.id).set(b);
          if (!S.books[authorId]) S.books[authorId]=[];
          S.books[authorId].push(b);
        }
      }
    }
    // Wishlist
    for (const w of (payload.wishlist||[])) {
      if (!S.wishlist.find(x=>x.id===w.id)) {
        await saveWishItem(w);
        S.wishlist.push(w);
      }
    }
    // Genre stats (merge)
    const merged = {...(payload.genreStats||{})};
    Object.entries(S.genreStats||{}).forEach(([g,n])=>{ merged[g]=(merged[g]||0)+n; });
    S.genreStats = merged;
    await col('meta').doc('genres').set(merged);

    renderAutoren(); renderAlleBuecher(); renderFavorites(); renderMerkliste(); renderStatistik();
    flashWishBtn('Import successful ✓');
  } catch(e) {
    alert('Error importing: ' + e.message);
  } finally {
    hideLoading();
    event.target.value = '';
  }
}
