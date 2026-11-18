'use strict';

const wikiDocs = 'https://wikidocs.net';
const sections = catalog.map(section => ({ ...section, ...studyNotes[section.id] }));
const sectionById = new Map(sections.map(section => [section.id, section]));
const uniqueBooks = new Set(sections.flatMap(section => section.books.map(([, path]) => path))).size;
const expanded = new Set([sections[0].id]);

const content = document.getElementById('content');
const tree = document.getElementById('tree');
const search = document.getElementById('search-input');
const clearSearch = document.getElementById('clear-search');
const status = document.getElementById('search-status');
const toggleAll = document.getElementById('toggle-all');
const menu = document.getElementById('menu-button');
const sidebar = document.getElementById('sidebar');
const scrim = document.getElementById('scrim');
const qaLink = document.getElementById('qa-link');
const reader = document.getElementById('book-reader');
const readerTitle = document.getElementById('reader-title');
const readerFrame = document.getElementById('reader-frame');
const readerSource = document.getElementById('reader-source');
const readerSize = document.getElementById('reader-size');
const compactLayout = matchMedia('(max-width: 760px)');

function icon(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, character => entities[character]);
}

function normalize(value) {
  return value.normalize('NFKC').toLowerCase();
}

function matchable(value) {
  return normalize(value).replace(/[^\p{L}\p{N}]/gu, '');
}

function sectionHref(section) {
  return `#section=${section.id}`;
}

function bookId(path) {
  return path.split('/').at(-1);
}

function entryId(section, path) {
  return `entry-${section.id}-${bookId(path)}`;
}

function readRoute() {
  const hash = location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return {
    hash,
    section: sectionById.get(params.get('section')),
    item: params.get('item'),
    qa: hash === 'qa',
  };
}

function renderTree() {
  tree.innerHTML = `
    <a class="tree-home" href="#all">${icon('library')}<span>전체 자료</span><small>${uniqueBooks}</small></a>
    <ul class="tree-list">
      ${sections.map(section => `
        <li class="branch" data-branch="${section.id}">
          <div class="branch-row">
            <button type="button" class="tree-toggle" data-toggle="${section.id}" aria-controls="branch-${section.id}" aria-expanded="false" aria-label="${escapeHtml(section.name)} 펼치기">${icon('chevron')}</button>
            <a href="${sectionHref(section)}" class="branch-link">
              <span class="closed-folder">${icon('folder')}</span><span class="open-folder">${icon('folder-open')}</span>
              <span class="branch-name">${escapeHtml(section.name)}</span><small>${section.books.length}</small>
            </a>
          </div>
          <ul class="leaves" id="branch-${section.id}" hidden>
            ${section.books.map(([title, path]) => `<li><a title="${escapeHtml(title)}" href="${sectionHref(section)}&amp;item=${bookId(path)}" ${readerLink(title, path)}>${icon('file')}<span>${escapeHtml(title)}</span></a></li>`).join('')}
          </ul>
        </li>`).join('')}
    </ul>`;
}

function updateTree(route, searching = false) {
  const home = tree.querySelector('.tree-home');
  if (!route.section && !route.qa && !searching) home.setAttribute('aria-current', 'page');
  else home.removeAttribute('aria-current');
  for (const branch of tree.querySelectorAll('[data-branch]')) {
    const section = sectionById.get(branch.dataset.branch);
    const open = expanded.has(section.id);
    const active = section === route.section && !searching;
    const button = branch.querySelector('button');
    branch.toggleAttribute('data-open', open);
    branch.toggleAttribute('data-current', active);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', `${section.name} ${open ? '접기' : '펼치기'}`);
    branch.querySelector('.leaves').hidden = !open;
    const sectionLink = branch.querySelector('.branch-link');
    if (active) sectionLink.setAttribute('aria-current', 'page');
    else sectionLink.removeAttribute('aria-current');
    for (const link of branch.querySelectorAll('.leaves a')) {
      if (active && link.hash === `#section=${section.id}&item=${route.item}`) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }
  const label = expanded.size ? '모든 분야 접기' : '모든 분야 펼치기';
  toggleAll.title = label;
  toggleAll.setAttribute('aria-label', label);
  toggleAll.innerHTML = icon(expanded.size ? 'collapse' : 'expand');
  if (route.qa && !searching) qaLink.setAttribute('aria-current', 'page');
  else qaLink.removeAttribute('aria-current');
}

function markMatches(value, terms) {
  if (!terms.length) return escapeHtml(value);
  const escaped = terms.map(term => term.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'giu');
  return value.split(pattern).map((part, index) => index % 2
    ? `<mark>${escapeHtml(part)}</mark>`
    : escapeHtml(part)).join('');
}

function readerLink(title, path) {
  return `data-book-path="${path}" data-book-title="${escapeHtml(title)}" aria-haspopup="dialog"`;
}

function bookCard(section, [title, path], terms = [], showSection = false) {
  const type = path.startsWith('/book/') ? '위키독스 책' : '위키독스 페이지';
  return `<a class="book-card palette-${section.color}" id="${entryId(section, path)}" href="${wikiDocs}${path}" target="_blank" rel="noopener" ${readerLink(title, path)}>
    <span class="tile-icon">${icon(path.startsWith('/book/') ? 'book' : 'file')}</span>
    <div class="book-copy">
      <strong>${markMatches(title, terms)}</strong>
      <span class="book-meta">${showSection ? `${markMatches(section.name, terms)} · ` : ''}${type}</span>
    </div>
    <span class="external-icon">${icon('preview')}</span>
  </a>`;
}

function sectionBlock(section) {
  return `<section class="section-block" aria-labelledby="heading-${section.id}">
    <div class="section-heading">
      <div class="section-label palette-${section.color}">
        <span class="tile-icon">${icon('folder')}</span>
        <h3 id="heading-${section.id}">${escapeHtml(section.name)}</h3>
        <span class="count">${section.books.length}</span>
      </div>
      <a class="section-link" href="${sectionHref(section)}" aria-label="${escapeHtml(section.name)} 분야 보기">분야 보기 ${icon('arrow')}</a>
    </div>
    <div class="book-grid">${section.books.map(book => bookCard(section, book)).join('')}</div>
  </section>`;
}

function homeView() {
  return `<section class="hero" aria-labelledby="home-title">
    <div class="hero-copy">
      <span class="hero-label">${icon('library')} 학습 라이브러리</span>
      <h1 id="home-title">위키독스<br>바이브코딩 책 모음</h1>
      <p>개발과 AI 도구를 공부할 때 다시 찾고 싶은 자료를 분야별로 모았습니다.</p>
      <a class="primary-button" href="#library">자료 둘러보기 ${icon('down')}</a>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="orbit orbit-large"></div><div class="orbit orbit-small"></div>
      <div class="art-card art-back"><i></i><i></i><i></i></div>
      <div class="art-card art-mid"><i></i><i></i><i></i></div>
      <div class="art-card art-front"><b></b><i></i><i></i><i></i></div>
      <span class="art-spark">✦</span><span class="art-dot"></span>
    </div>
  </section>
  <section class="library" id="library" aria-labelledby="library-title">
    <div class="library-heading">
      <h2 id="library-title">분야별 자료</h2>
      <span>${sections.length}개 분야 <span aria-hidden="true">·</span> ${uniqueBooks}개 자료</span>
    </div>
    ${sections.map(sectionBlock).join('')}
  </section>`;
}

function breadcrumbs(label, terms = []) {
  return `<nav class="breadcrumbs" aria-label="현재 위치"><a href="#all">전체 자료</a>${icon('chevron')}<span aria-current="page">${markMatches(label, terms)}</span></nav>`;
}

function questionCard(section, open = false, terms = [], showSection = false) {
  return `<details class="question-card palette-${section.color}" id="question-${section.id}" ${open ? 'open' : ''}>
    <summary>
      <span class="tile-icon">${icon('qa')}</span>
      <span class="question-title">
        ${showSection ? `<small>${markMatches(section.name, terms)}</small>` : ''}
        <strong>${markMatches(section.question, terms)}</strong>
      </span>
      ${icon('chevron')}
    </summary>
    <div class="answer"><p>${markMatches(section.answer, terms)}</p>${showSection ? `<a class="section-link" href="${sectionHref(section)}">관련 자료 보기 ${icon('arrow')}</a>` : ''}</div>
  </details>`;
}

function sectionView(section) {
  return `${breadcrumbs(section.name)}
    <header class="page-intro palette-${section.color}">
      <span class="tile-icon intro-icon">${icon('folder-open')}</span>
      <h1>${escapeHtml(section.name)}</h1>
      <p>${escapeHtml(section.guide)}</p>
    </header>
    <section class="subsection" aria-labelledby="section-books">
      <div class="library-heading"><h2 id="section-books">자료</h2><span>${section.books.length}개</span></div>
      <div class="book-grid">${section.books.map(book => bookCard(section, book)).join('')}</div>
    </section>
    <section class="subsection" aria-labelledby="section-qa">
      <div class="library-heading"><h2 id="section-qa">학습 Q&amp;A</h2></div>
      ${questionCard(section, true)}
    </section>`;
}

function qaView() {
  return `${breadcrumbs('학습 Q&A')}
    <header class="page-intro palette-violet">
      <span class="tile-icon intro-icon">${icon('qa')}</span>
      <h1>학습 Q&amp;A</h1>
      <p>어디서 시작할지 고민될 때 분야별 질문을 펼쳐 보세요.</p>
    </header>
    <div class="question-list">${sections.map(section => questionCard(section, false, [], true)).join('')}</div>`;
}

function searchView(query) {
  const terms = query.trim().split(/\s+/).filter(term => matchable(term)).sort((a, b) => b.length - a.length);
  const keywords = terms.map(matchable);
  const matches = value => {
    const indexed = matchable(value);
    return keywords.length > 0 && keywords.every(keyword => indexed.includes(keyword));
  };
  const books = sections.flatMap(section => section.books
    .filter(([title]) => matches(`${title} ${section.name}`))
    .map(book => bookCard(section, book, terms, true)));
  const guides = sections.filter(section => matches(`${section.name} ${section.guide} ${section.tags}`));
  const questions = sections.filter(section => matches(`${section.name} ${section.question} ${section.answer}`));
  const total = books.length + guides.length + questions.length;
  status.textContent = total ? `검색 결과 ${total}개` : '검색 결과가 없습니다.';
  const source = new URL('/global_search/', wikiDocs);
  if ([...query].length >= 2) source.searchParams.set('kw', query);
  const wikiSearch = `<a class="section-link" href="${escapeHtml(source.href)}" target="_blank" rel="noopener" aria-describedby="opens-new-tab">위키독스 본문 검색 ${icon('external')}</a>`;
  return `<header class="search-heading">
    <div><h1>검색 결과</h1><p>“${escapeHtml(query)}” · ${total}개</p></div>
    ${total ? wikiSearch : ''}
  </header>
  ${total ? `
    ${books.length ? `<section class="subsection" aria-labelledby="result-books"><div class="library-heading"><h2 id="result-books">자료</h2><span>${books.length}개</span></div><div class="book-grid">${books.join('')}</div></section>` : ''}
    ${guides.length ? `<section class="subsection" aria-labelledby="result-guide"><div class="library-heading"><h2 id="result-guide">분야별 학습 안내</h2><span>${guides.length}개</span></div><div class="guide-list">${guides.map(section => `<a class="guide-card palette-${section.color}" href="${sectionHref(section)}"><span class="tile-icon">${icon('folder')}</span><div><strong>${markMatches(section.name, terms)}</strong><p>${markMatches(section.guide, terms)}</p></div>${icon('arrow')}</a>`).join('')}</div></section>` : ''}
    ${questions.length ? `<section class="subsection" aria-labelledby="result-qa"><div class="library-heading"><h2 id="result-qa">학습 Q&amp;A</h2><span>${questions.length}개</span></div><div class="question-list">${questions.map(section => questionCard(section, true, terms, true)).join('')}</div></section>` : ''}` : `
    <div class="empty-state"><span class="tile-icon">${icon('search')}</span><h2>일치하는 자료가 없어요</h2><p>책 제목의 일부나 분야 이름으로 검색해 보세요.</p>${wikiSearch}</div>`}`;
}

function render({ navigate = false, focus = false } = {}) {
  const route = readRoute();
  const query = search.value.trim();
  if (route.section && navigate && !query) expanded.add(route.section.id);
  clearSearch.hidden = !search.value;
  if (!query) status.textContent = '';
  const view = query ? searchView(query) : route.section ? sectionView(route.section) : route.qa ? qaView() : homeView();
  content.innerHTML = `${view}<span class="sr-only" id="opens-new-tab">새 탭에서 열림</span>`;
  updateTree(route, Boolean(query));
  if (!navigate) return;

  const item = route.item && route.section && document.getElementById(`entry-${route.section.id}-${route.item}`);
  const target = item || (route.hash === 'library' && document.getElementById('library'));
  if (target) {
    target.scrollIntoView({ block: 'start' });
    if (item) item.focus({ preventScroll: true });
    else if (focus) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  } else if (route.hash === 'content') {
    content.focus();
  } else {
    window.scrollTo(0, 0);
    if (focus) content.focus({ preventScroll: true });
  }
}

function setMenu(open, restoreFocus = false) {
  const visible = open && compactLayout.matches;
  sidebar.classList.toggle('is-open', visible);
  menu.setAttribute('aria-expanded', String(visible));
  menu.setAttribute('aria-label', visible ? '목차 닫기' : '목차 열기');
  menu.innerHTML = icon(visible ? 'close' : 'menu');
  scrim.hidden = !visible;
  content.inert = visible;
  if (visible) tree.querySelector('.tree-home').focus();
  if (!visible && restoreFocus) menu.focus();
}

function clearQuery() {
  search.value = '';
  render({ navigate: true });
  search.focus();
}

function setReaderSize(fullScreen) {
  reader.classList.toggle('is-fullscreen', fullScreen);
  readerSize.setAttribute('aria-pressed', String(fullScreen));
  readerSize.innerHTML = `${icon(fullScreen ? 'restore' : 'maximize')}<span>${fullScreen ? '창 크기 복원' : '전체화면'}</span>`;
}

function openReader(link) {
  const title = link.dataset.bookTitle;
  const url = `${wikiDocs}${link.dataset.bookPath}`;
  readerTitle.textContent = title;
  readerTitle.title = title;
  readerFrame.title = `${title} · 위키독스 원문`;
  readerSource.href = url;
  reader.showModal();
  readerFrame.src = url;
}

readerSize.addEventListener('click', () => setReaderSize(!reader.classList.contains('is-fullscreen')));
document.getElementById('reader-close').addEventListener('click', () => reader.close());
reader.addEventListener('click', event => {
  if (event.target === reader) reader.close();
});
reader.addEventListener('close', () => {
  readerFrame.removeAttribute('src');
  setReaderSize(false);
});

tree.addEventListener('click', event => {
  const button = event.target.closest('[data-toggle]');
  if (!button) return;
  const id = button.dataset.toggle;
  if (expanded.has(id)) expanded.delete(id);
  else expanded.add(id);
  updateTree(readRoute(), Boolean(search.value.trim()));
});

toggleAll.addEventListener('click', () => {
  if (expanded.size) expanded.clear();
  else sections.forEach(section => expanded.add(section.id));
  updateTree(readRoute(), Boolean(search.value.trim()));
});

document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (link.hasAttribute('data-book-path') && typeof reader.showModal === 'function') {
    event.preventDefault();
    openReader(link);
    return;
  }
  if (!link.getAttribute('href').startsWith('#')) return;
  setMenu(false);
  if (link.hash === '#content') {
    event.preventDefault();
    content.focus();
    return;
  }
  if (link.hash === location.hash) {
    event.preventDefault();
    search.value = '';
    render({ navigate: true, focus: true });
  }
});

window.addEventListener('hashchange', () => {
  search.value = '';
  render({ navigate: true, focus: true });
});

search.addEventListener('input', () => {
  render();
  window.scrollTo(0, 0);
});

document.getElementById('search-form').addEventListener('submit', event => {
  event.preventDefault();
  if (search.value.trim()) content.querySelector('.book-card, .guide-card, summary, .empty-state a')?.focus();
});

clearSearch.addEventListener('click', clearQuery);
menu.addEventListener('click', () => setMenu(!sidebar.classList.contains('is-open'), sidebar.classList.contains('is-open')));
scrim.addEventListener('click', () => setMenu(false, true));
compactLayout.addEventListener('change', () => setMenu(false));

document.addEventListener('keydown', event => {
  if (reader.open) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    setMenu(false);
    search.focus();
    search.select();
  } else if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
    setMenu(false, true);
  } else if (event.key === 'Escape' && document.activeElement === search && search.value) {
    event.preventDefault();
    clearQuery();
  }
});

renderTree();
render({ navigate: true });
