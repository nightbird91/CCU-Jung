/* 전공심화 운영진단 편람 열람 – 빌드 없는 정적 SPA (hash routing) */
(function () {
  'use strict';

  var DATA = null;
  var INDEX = [];        // 평탄화된 지표 목록 (순서 유지)
  var BY_ID = {};
  var state = { filter: '전체', view: 'tree', query: '', folded: true };

  var $app = document.getElementById('app');
  var $title = document.getElementById('pageTitle');
  var $back = document.getElementById('backBtn');
  var $top = document.getElementById('topBtn');

  try { var saved = localStorage.getItem('jsh-view'); if (saved) state.view = saved; } catch (e) {}

  /* ---------- utils ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n, d) {
    if (!isFinite(n)) return '–';
    d = d == null ? 2 : d;
    return Number(n.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d });
  }
  function caret() {
    return '<svg class="caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  }
  function typeChip(t) { return '<span class="chip ' + esc(t) + '">' + esc(t) + '</span>'; }
  function setTitle(main, sub) {
    if ($title) $title.innerHTML = esc(main) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    document.title = main === '전체 지표' ? '전문대학 학사학위 전공심화 운영진단 편람' : main + ' · 전문대학 학사학위 전공심화 운영진단 편람';
  }
  function setTab(name) {
    document.querySelectorAll('.tabbar a').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('data-tab') === name);
      if (a.getAttribute('data-tab') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  /* ---------- data ---------- */
  function buildIndex() {
    INDEX = []; BY_ID = {}; DOCS = null;
    DATA.categories.forEach(function (c) {
      c.fields.forEach(function (f) {
        f.areas.forEach(function (a) {
          a.indicators.forEach(function (ind) {
            ind._cat = c; ind._field = f; ind._area = a;
            INDEX.push(ind); BY_ID[ind.id] = ind;
          });
        });
      });
    });
  }

  function qualRows(n, points) {
    var L = DATA.qualScaleLabels;
    var crit;
    if (n === 3) {
      crit = ['3개 진단요소 모두 실적 우수함', '3개 진단요소 중 2개 요소의 실적 우수함', '3개 진단요소 중 1개 요소의 실적 우수함', '3개 진단요소 모두 실적이 미흡', '1개 이상 실적(내용) 없음'];
    } else {
      crit = ['4개 진단요소 모두 실적 우수', '4개 진단요소 중 3개 요소의 실적 우수', '4개 진단요소 중 2개 요소의 실적 우수', '4개 진단요소 중 1개 요소의 실적 우수', '4개 진단요소 모두 실적 미흡 또는 1개 이상 실적(내용) 없음'];
    }
    return L.map(function (l, i) { return [l, crit[i], points[i]]; });
  }

  /* ---------- views ---------- */
  function viewHome() {
    setTitle('전체 지표', '100점 · 15개 진단지표');
    setTab('home');
    var types = ['전체', '정량', '정성', '혼합'];
    var counts = { '전체': INDEX.length, '정량': 0, '정성': 0, '혼합': 0 };
    INDEX.forEach(function (i) { counts[i.type]++; });

    var h = '';
    h += '<section class="card summary">' +
      '<div class="muted">' + esc(HB.name) + ' 기준 · 진단기준년도 ' + esc(HB.baseYear) + ' · ' + esc(HB.published) + ' 발간</div>' +
      '<div class="total"><b>100점</b><span class="muted">총 ' + INDEX.length + '개 진단지표</span></div>' +
      '<div class="bar" role="img" aria-label="대학 15점, 학과 85점"><span class="c" style="width:15%"></span><span class="d" style="width:85%"></span></div>' +
      '<div class="legend"><span><i style="background:var(--college)"></i>대학 15점 · 3개 지표</span><span><i style="background:var(--dept)"></i>학과 85점 · 12개 지표</span><span><i style="background:var(--minus)"></i>감점 최대 −2점</span></div>' +
      '</section>';

    h += '<div class="filters" role="group" aria-label="유형 필터">';
    types.forEach(function (t) {
      h += '<button class="filter" data-filter="' + t + '" aria-pressed="' + (state.filter === t) + '">' + t + ' ' + counts[t] + '</button>';
    });
    h += '<button class="filter view-toggle" data-view aria-pressed="' + (state.view === 'table') + '">' + (state.view === 'table' ? '카드로 보기' : '총괄표로 보기') + '</button>';
    h += '</div>';
    if (state.view !== 'table') h += '<div class="tree-tools"><button class="fold-all" data-fold-all type="button"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="fa-up" d="M7 9l5-5 5 5M7 15l5 5 5-5"/></svg><span>' + (state.folded ? '모두 펼치기' : '모두 접기') + '</span></button></div>';

    h += state.view === 'table' ? renderTable() : renderTree();
    $app.innerHTML = h;

    $app.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () { state.filter = b.getAttribute('data-filter'); viewHome(); });
    });
    $app.querySelector('[data-view]').addEventListener('click', function () {
      state.view = state.view === 'table' ? 'tree' : 'table';
      try { localStorage.setItem('jsh-view', state.view); } catch (e) {}
      viewHome();
    });
    var fa = $app.querySelector('[data-fold-all]');
    if (fa) {
      var areas = $app.querySelectorAll('details.area');
      var sync = function () {
        var anyOpen = Array.prototype.some.call(areas, function (d) { return d.open; });
        state.folded = !anyOpen;
        fa.querySelector('span').textContent = anyOpen ? '모두 접기' : '모두 펼치기';
      };
      fa.addEventListener('click', function () {
        var anyOpen = Array.prototype.some.call(areas, function (d) { return d.open; });
        areas.forEach(function (d) { d.open = !anyOpen; });
        sync();
      });
      areas.forEach(function (d) { d.addEventListener('toggle', sync); });
    }
  }

  function match(ind) { return state.filter === '전체' || ind.type === state.filter; }

  function renderTree() {
    var h = '';
    DATA.categories.forEach(function (c) {
      var catInds = 0;
      var body = '';
      c.fields.forEach(function (f) {
        var fb = '';
        f.areas.forEach(function (a) {
          var items = a.indicators.filter(match);
          if (!items.length) return;
          catInds += items.length;
          fb += renderArea(a, items);
        });
        if (fb) {
          body += '<div class="field"><div class="field-head"><span class="fid">' + esc(f.id) + '</span><h3>' + esc(f.name) + '</h3><span class="fpts">' + f.score + '점</span></div>' + fb + '</div>';
        }
      });
      if (!catInds) return;
      h += '<section class="card cat c' + c.id + '"><div class="cat-head"><div class="cat-badge">' + esc(c.id) + '</div><div><div class="meta">구분</div><h2>' + esc(c.name) + '</h2></div><div class="pts">' + c.score + '<small>점</small></div></div>' + body;
      if (c.id === '2' && state.filter === '전체') {
        h += '<div class="deduction"><span class="chip">감점</span><span>' + esc(DATA.deduction.name) + '</span><b>' + DATA.deduction.score + '</b></div>';
      }
      h += '</section>';
    });
    return h || '<p class="empty">해당 유형의 지표가 없습니다.</p>';
  }

  // 3주기 변경 문구 강조: 운영위원회 기능 문장 전체, '외국인 유학생' 단어
  function emphChange(c) {
    var t = esc(c).replace(/외국인 유학생/g, '<span class="em-hi">외국인 유학생</span>');
    return c.indexOf('운영위원회 기능') >= 0 ? '<span class="em-hi">' + t + '</span>' : t;
  }

  function areaHue(a) {
    var all = [];
    DATA.categories.forEach(function (c) { c.fields.forEach(function (f) { f.areas.forEach(function (x) { all.push(x.id); }); }); });
    return Math.round((all.indexOf(a.id) + 0.5) * 360 / all.length);
  }

  function renderArea(a, items, open) {
    var fb = '<details class="area"' + (open || !state.folded ? ' open' : '') + '><summary>' + caret() + '<span class="aid">' + esc(a.id) + '</span><span>' + esc(a.name) + '</span><span class="apts" style="--h:' + areaHue(a) + '">' + a.score + '<small>점</small></span></summary><ul class="ind-list">';
    items.forEach(function (ind) {
      fb += '<li><a class="ind" href="#/i/' + ind.id + '">' +
        '<span class="iid">' + esc(ind.id) + '</span>' +
        '<span class="iname">' + esc(ind.name) + '</span>' +
        '<span class="ichips">' + typeChip(ind.type) + '</span>' +
        '<span class="ipts" style="--h:' + Math.round(INDEX.indexOf(ind) * 360 / INDEX.length) + '">' + ind.score + '<small>점</small></span>' +
        '</a></li>';
    });
    return fb + '</ul></details>';
  }

  /* ---------- 구분(대학/학과) · 분야 화면 ---------- */
  function findField(id) {
    var r = null;
    DATA.categories.forEach(function (c) { c.fields.forEach(function (f) { if (f.id === id) r = { c: c, f: f }; }); });
    return r;
  }
  function allFields() {
    var list = [];
    DATA.categories.forEach(function (c) { c.fields.forEach(function (f) { list.push({ c: c, f: f }); }); });
    return list;
  }
  function countInds(f) { return f.areas.reduce(function (n, a) { return n + a.indicators.length; }, 0); }

  function viewCategory(id) {
    var c = DATA.categories.filter(function (x) { return x.id === id; })[0];
    if (!c) { viewHome(); return; }
    setTitle(c.id + '. ' + c.name, '구분 · ' + c.score + '점');
    setTab('home');
    var n = c.fields.reduce(function (s, f) { return s + countInds(f); }, 0);
    var h = '<section class="card cat c' + c.id + '"><div class="cat-head" style="border-bottom:0"><div class="cat-badge">' + esc(c.id) + '</div><div><div class="meta">구분 · ' + c.fields.length + '개 분야 · ' + n + '개 지표</div><h2>' + esc(c.name) + '</h2></div><div class="pts">' + c.score + '<small>점</small></div></div></section>';
    h += '<h3 class="section-title">분야 선택</h3>';
    c.fields.forEach(function (f) {
      h += '<a class="card field-card c' + c.id + '" href="#/f/' + f.id + '"><div><span class="fid">' + esc(f.id) + '</span><b>' + esc(f.name) + '</b><div class="muted">' +
        f.areas.map(function (a) { return esc(a.id + ' ' + a.name); }).join(' · ') + '</div><div class="muted">' + countInds(f) + '개 지표</div></div><span class="fpts">' + f.score + '점</span>' + caret() + '</a>';
    });
    if (c.id === '2') h += '<section class="card deduction" style="border-top:1px solid var(--line)"><span class="chip">감점</span><span>' + esc(DATA.deduction.name) + '</span><b>' + DATA.deduction.score + '</b></section>';
    $app.innerHTML = h;
  }

  function viewField(id) {
    var r = findField(id);
    if (!r) { viewHome(); return; }
    var c = r.c, f = r.f;
    setTitle(f.id + ' ' + f.name, c.name + ' · ' + f.score + '점');
    setTab('home');
    var h = '<div class="crumbs"><span><a href="#/c/' + c.id + '">' + esc(c.id + '. ' + c.name) + '</a></span><span>' + esc(f.id + ' ' + f.name) + '</span></div>';
    h += '<section class="card field-hero c' + c.id + '"><div class="muted">분야 ' + esc(f.id) + ' · ' + f.areas.length + '개 영역 · ' + countInds(f) + '개 지표</div><h2>' + esc(f.name) + '</h2>' +
      '<div class="bar" role="img" aria-label="영역별 배점">' + f.areas.map(function (a, i) { return '<span style="width:' + (a.score / f.score * 100) + '%;opacity:' + (1 - i * 0.3) + '" class="' + (c.id === '1' ? 'c' : 'd') + '"></span>'; }).join('') + '</div>' +
      '<div class="legend">' + f.areas.map(function (a) { return '<span>' + esc(a.id + ' ' + a.name) + ' ' + a.score + '점</span>'; }).join('') + '</div></section>';
    f.areas.forEach(function (a) { h += '<div class="card" style="padding:4px 10px">' + renderArea(a, a.indicators, true) + '</div>'; });
    var list = allFields(), pos = -1;
    list.forEach(function (x, i) { if (x.f.id === id) pos = i; });
    var prev = list[pos - 1], next = list[pos + 1];
    h += '<div class="pager">' +
      (prev ? '<a href="#/f/' + prev.f.id + '"><small>‹ 이전 분야</small>' + esc(prev.c.name + ' · ' + prev.f.id + ' ' + prev.f.name) + '</a>' : '<span class="ghost"></span>') +
      (next ? '<a class="next" href="#/f/' + next.f.id + '"><small>다음 분야 ›</small>' + esc(next.c.name + ' · ' + next.f.id + ' ' + next.f.name) + '</a>' : '<span class="ghost"></span>') + '</div>';
    $app.innerHTML = h;
  }

  /* ---------- 본문 상단: 선택한 분야의 진단지표 전체 ---------- */
  function renderIndPicker(c, f, activeId) {
    var h = '<section class="card picker c' + c.id + '" aria-label="진단지표 선택"><div class="picker-head"><div><span class="muted">' + esc(c.name) + ' · 분야 ' + esc(f.id) + '</span><b>' + esc(f.name) + '</b></div><span class="picker-meta">' + countInds(f) + '개 지표 · ' + f.score + '점</span></div>';
    f.areas.forEach(function (a) {
      h += '<div class="picker-area"><div class="picker-area-name">' + esc(a.id + ' ' + a.name) + ' <span>' + a.score + '점</span></div><div class="picker-grid">';
      a.indicators.forEach(function (ind) {
        var on = ind.id === activeId;
        h += '<a class="pick' + (on ? ' on' : '') + '" href="#/i/' + ind.id + '"' + (on ? ' aria-current="true"' : '') + '><span class="pick-id">' + esc(ind.id) + '</span><span class="pick-name">' + esc(ind.name) + '</span><span class="pick-meta">' + typeChip(ind.type) + '<b>' + ind.score + '점</b></span></a>';
      });
      h += '</div></div>';
    });
    return h + '</section>';
  }

  /* ---------- 사이드바 ---------- */
  var $side = document.getElementById('sidebar');
  var $scrim = document.getElementById('scrim');
  var $menu = document.getElementById('menuBtn');
  function renderSidebar() {
    var h = '<div class="side-head"><b>편람 목차</b><div class="side-tools"><button type="button" class="side-tool side-tool-ic" data-all="open" aria-label="모두 펼치기" title="모두 펼치기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg></button><button type="button" class="side-tool side-tool-ic" data-all="close" aria-label="모두 접기" title="모두 접기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20l5-5 5 5M7 4l5 5 5-5"/></svg></button></div></div><nav class="side-nav" aria-label="구분·분야">';
    h += '<a class="side-link side-all" href="#/" data-key="home">전체 지표 <span>100점</span></a>';
    h += '<ul class="tree">';
    DATA.categories.forEach(function (c) {
      h += '<li class="t1 c' + c.id + '" data-node="' + c.id + '">' + '<button class="tg" type="button" aria-label="접기/펼치기" aria-expanded="true">' + caret() + '</button>' + '<a class="t1-link" href="#/c/' + c.id + '" data-key="c' + c.id + '"><i>' + esc(c.id) + '</i><span class="tn">' + esc(c.name) + '</span><span class="tp">' + c.score + '점</span></a><ul>';
      c.fields.forEach(function (f) {
        h += '<li class="t2" data-node="' + f.id + '">' + '<button class="tg" type="button" aria-label="접기/펼치기" aria-expanded="true">' + caret() + '</button>' + '<a class="t2-link" href="#/f/' + f.id + '" data-key="f' + f.id + '"><em>' + esc(f.id) + '</em><span class="tn">' + esc(f.name) + '</span><span class="tp">' + f.score + '점</span></a><ul>';
        f.areas.forEach(function (ar) {
          h += '<li class="t3" data-node="' + ar.id + '">' + '<button class="tg" type="button" aria-label="접기/펼치기" aria-expanded="true">' + caret() + '</button>' + '<div class="t3-label" data-key="a' + ar.id + '"><em>' + esc(ar.id) + '</em><span class="tn">' + esc(ar.name) + '</span><span class="tp">' + ar.score + '점</span></div><ul>';
          ar.indicators.forEach(function (ind) {
            h += '<li class="t4"><a class="t4-link" href="#/i/' + ind.id + '" data-key="i' + ind.id + '"><em>' + esc(ind.id) + '</em><span class="tn">' + esc(ind.name) + '</span><span class="tp">' + ind.score + '</span></a></li>';
          });
          h += '</ul></li>';
        });
        h += '</ul></li>';
      });
      h += '</ul></li>';
    });
    h += '</ul>';
    h += '</nav><div class="side-extra"><a class="side-link" href="#/plan" data-key="plan"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg><b>기본계획 · 등급 기준</b></a><a class="side-link" href="#/changes" data-key="changes"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h11M4 12h7M4 17h11"/><path d="M17 10l3 3-3 3"/></svg><b>변경사항(3주기)</b></a><a class="side-link" href="#/refs" data-key="refs"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><rect x="9" y="12" width="6" height="5" rx="1"/><path d="M10.5 12v-1a1.5 1.5 0 0 1 3 0v1"/></svg><b>참고자료</b></a><a class="side-link" href="#/search" data-key="search"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><b>검색</b></a></div>';
    $side.innerHTML = '<div class="sidebar-inner">' + h + '</div>';
    var collapsed = {};
    try { collapsed = JSON.parse(localStorage.getItem('jsh-toc') || '{}') || {}; } catch (e) {}
    function save() { try { localStorage.setItem('jsh-toc', JSON.stringify(collapsed)); } catch (e) {} }
    function setNode(li, open) {
      li.classList.toggle('collapsed', !open);
      li.querySelector(':scope > .tg').setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) delete collapsed[li.getAttribute('data-node')]; else collapsed[li.getAttribute('data-node')] = 1;
    }
    $side.querySelectorAll('[data-node]').forEach(function (li) { setNode(li, !collapsed[li.getAttribute('data-node')]); });
    expandTo = function (ids) {
      ids.forEach(function (id) { var li = $side.querySelector('[data-node="' + id + '"]'); if (li && li.classList.contains('collapsed')) setNode(li, true); });
      save();
    };
    $side.addEventListener('click', function (e) {
      var tg = e.target.closest('.tg, .t3-label');
      if (tg) { var li = tg.closest('[data-node]'); setNode(li, li.classList.contains('collapsed')); save(); return; }
      var all = e.target.closest('[data-all]');
      if (all) { var open = all.getAttribute('data-all') === 'open'; $side.querySelectorAll('[data-node]').forEach(function (li) { setNode(li, open); }); save(); return; }
      if (e.target.closest('a')) closeSide();
    });
  }
  var expandTo = function () {};
  function markSidebar(path) {
    var keys = [], field = null;
    if (path.indexOf('/i/') === 0) { var ind = BY_ID[path.slice(3)]; if (ind) { field = ind._field.id; keys = ['i' + ind.id, 'a' + ind._area.id, 'f' + field, 'c' + ind._cat.id]; expandTo([ind._cat.id, field, ind._area.id]); } }
    else if (path.indexOf('/f/') === 0) { field = path.slice(3); var r = findField(field); keys = ['f' + field].concat(r ? ['c' + r.c.id] : []); }
    else if (path.indexOf('/c/') === 0) keys = ['c' + path.slice(3)];
    else if (path === '/plan' || path === '/changes' || path === '/search' || path === '/refs') keys = [path.slice(1)];
    else keys = ['home'];
    $side.querySelectorAll('[data-key]').forEach(function (a) {
      var on = keys.indexOf(a.getAttribute('data-key')) >= 0;
      a.classList.toggle('on', on);
      if (on && keys[0] === a.getAttribute('data-key')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function openSide() { document.body.classList.add('side-open'); $menu.setAttribute('aria-expanded', 'true'); }
  function closeSide() { document.body.classList.remove('side-open'); $menu.setAttribute('aria-expanded', 'false'); }
  var $sBtn = document.getElementById('settingsBtn');
  var $sPanel = document.getElementById('settingsPanel');
  function setSettings(open) { $sPanel.hidden = !open; $sBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  $sBtn.addEventListener('click', function (e) { e.stopPropagation(); setSettings($sPanel.hidden); });
  document.addEventListener('click', function (e) { if (!$sPanel.hidden && !$sPanel.contains(e.target)) setSettings(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setSettings(false); });
  /* ---------- 편람 PDF 보기 팝업 (총괄표, 작성자료·지침) ---------- */
  var $doc = document.getElementById('docModal');
  var docLast = null;
  function closeDoc() { if ($doc.hidden) return; $doc.hidden = true; document.body.classList.remove('modal-open'); if (docLast) docLast.focus(); }
  function openDoc(title, sub, imgs, pdf, lead) {
    docLast = document.activeElement; setSettings(false);
    document.getElementById('docTitle').innerHTML = esc(title) + (sub ? ' <small>' + esc(sub) + '</small>' : '');
    document.getElementById('docPdf').href = pdf;
    document.getElementById('docBody').innerHTML = (lead ? '<div class="doc-lead">' + lead + '</div>' : '') + imgs.map(function (m) {
      return '<figure class="doc-page"><img src="' + esc(m.src) + '" alt="' + esc(m.alt) + '" loading="lazy">' + (m.cap ? '<figcaption>' + esc(m.cap) + '</figcaption>' : '') + '</figure>';
    }).join('');
    resetZoom();
    document.getElementById('docBody').scrollTop = 0; document.getElementById('docBody').scrollLeft = 0;
    $doc.hidden = false; document.body.classList.add('modal-open');
    $doc.querySelector('.modal-close').focus();
  }
  $doc.addEventListener('click', function (e) { if (e.target === $doc || e.target.closest('.modal-close')) closeDoc(); });
  /* 팝업 확대·축소 (두 손가락 핀치, 두 번 탭, ± 버튼, PC는 Ctrl+휠)
     scroller: 스크롤 영역, ctl: ±버튼 묶음, base(): 열 때 배율, apply(z): 배율 적용 */
  function makeZoomable(scroller, ctl, base, apply, topOf) {
    var ZMIN = 1, ZMAX = 4, z = 1, out = ctl.querySelector('output');
    function show() {
      out.textContent = Math.round(z * 100) + '%';
      ctl.querySelector('[data-zoom="-"]').disabled = z <= ZMIN;
      ctl.querySelector('[data-zoom="+"]').disabled = z >= ZMAX;
    }
    function set(nz, fx, fy) {
      nz = Math.max(ZMIN, Math.min(ZMAX, Math.round(nz * 100) / 100));
      if (nz === z) return;
      var r = nz / z, rect = scroller.getBoundingClientRect();
      if (fx == null) { fx = rect.width / 2; fy = rect.height / 2; }
      var top0 = topOf ? topOf() : 0, cx = scroller.scrollLeft + fx, cy = scroller.scrollTop + fy;
      z = nz; apply(z);
      scroller.scrollLeft = cx * r - fx;
      scroller.scrollTop = (cy > top0 ? top0 + (cy - top0) * r : cy) - fy;
      show();
    }
    ctl.querySelectorAll('[data-zoom]').forEach(function (btn) {
      btn.addEventListener('click', function () { set(z * (btn.getAttribute('data-zoom') === '+' ? 1.25 : 0.8)); });
    });
    var d0 = 0, z0 = 1, lastTap = 0;
    function dist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
    scroller.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) { d0 = dist(e.touches); z0 = z; }
      else if (e.touches.length === 1 && !e.target.closest('a, button')) {
        var now = Date.now();
        if (now - lastTap < 300) {   // 두 번 탭: 2배 ↔ 기본
          var r = scroller.getBoundingClientRect(), t = e.touches[0];
          set(z > base() + 0.01 ? base() : base() * 2, t.clientX - r.left, t.clientY - r.top);
          lastTap = 0; e.preventDefault();
        } else lastTap = now;
      }
    }, { passive: false });
    scroller.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2 || !d0) return;
      e.preventDefault();
      var r = scroller.getBoundingClientRect(), t = e.touches;
      set(z0 * dist(t) / d0, (t[0].clientX + t[1].clientX) / 2 - r.left, (t[0].clientY + t[1].clientY) / 2 - r.top);
    }, { passive: false });
    scroller.addEventListener('touchend', function (e) { if (e.touches.length < 2) d0 = 0; });
    scroller.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      var r = scroller.getBoundingClientRect();
      set(z * Math.exp(-e.deltaY / 300), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    return { reset: function () { z = base(); apply(z); show(); } };
  }
  var $docBody = document.getElementById('docBody');
  var docZoom = makeZoomable($docBody, $doc.querySelector('.zoom-ctl'),
    function () { return window.innerWidth < 600 ? 1.5 : 1; },     // 휴대폰은 처음부터 1.5배(글자 크기 확보)
    function (z) { $docBody.style.setProperty('--zoom', z); },
    function () { var f = $docBody.querySelector('.doc-page'); return f ? f.offsetTop : 0; });
  function resetZoom() { docZoom.reset(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDoc(); });
  window.addEventListener('hashchange', closeDoc);
  document.getElementById('changesOpen').addEventListener('click', function (e) {
    e.stopPropagation();
    var imgs = [];
    for (var n = 1; n <= (HB.changesPages || 0); n++) {
      var pad = ('00' + n).slice(-3);
      imgs.push({ src: HB.docs + 'changes/p' + pad + '.png', alt: '3주기 변경사항 ' + n + '쪽', cap: n + ' / ' + HB.changesPages + '쪽' });
    }
    openDoc('3주기 운영진단 지표(편람) 변경사항', HB.name, imgs, HB.docs + 'changes/all.pdf');
  });
  function openQuant(e) {
    if (e) e.stopPropagation();
    openDoc('정량요소 총괄표', HB.name + ' · 편람 11쪽', [{ src: HB.docs + 'quant.png', alt: '편람 11쪽 정량요소 총괄표: 진단지표별 정량요소·근거자료·자료기준·공시시기' }], HB.docs + 'quant.pdf');
  }
  document.getElementById('quantOpen').addEventListener('click', openQuant);
  document.getElementById('summaryOpen').addEventListener('click', function (e) {
    e.stopPropagation();
    openDoc('진단지표 총괄표', HB.name + ' · 편람 10쪽', [{ src: HB.docs + 'summary.png', alt: '편람 10쪽 진단지표 총괄표: 구분·분야·영역·진단지표별 배점(총 100점)' }], HB.docs + 'summary.pdf');
  });

  $menu.addEventListener('click', function () { document.body.classList.contains('side-open') ? closeSide() : openSide(); });
  $scrim.addEventListener('click', closeSide);
  // 휴대폰: 왼쪽 가장자리에서 오른쪽으로 밀면 목차 열기, 열린 목차를 왼쪽으로 밀면 닫기
  (function () {
    var sx = 0, sy = 0, mode = '';
    document.addEventListener('touchstart', function (e) {
      if (window.innerWidth >= 1000 || e.touches.length !== 1) { mode = ''; return; }
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      var open = document.body.classList.contains('side-open');
      mode = open ? 'close' : (sx <= 32 && document.getElementById('docModal').hidden && $sPanel.hidden ? 'open' : '');
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!mode) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
      if (mode === 'open' && dx > 60 && dy < dx * 0.6) openSide();
      if (mode === 'close' && dx < -60 && dy < -dx * 0.6) closeSide();
      mode = '';
    }, { passive: true });
  })();
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSide(); });

  function renderTable() {
    var h = '<div class="table-wrap"><table class="sum-table"><thead><tr><th>구분</th><th>분야</th><th>영역</th><th>진단지표</th><th class="num">배점</th><th class="num">유형</th></tr></thead><tbody>';
    INDEX.filter(match).forEach(function (ind) {
      h += '<tr><td>' + esc(ind._cat.id + '. ' + ind._cat.name) + '</td><td>' + esc(ind._field.id + ' ' + ind._field.name) + '</td><td>' + esc(ind._area.id + ' ' + ind._area.name) + '</td>' +
        '<td><a href="#/i/' + ind.id + '">' + esc(ind.id + ' ' + ind.name) + '</a>' +
        (ind.sub ? '<div class="muted">' + ind.sub.map(function (s) { return esc(s.no + ' ' + s.name + ' (' + s.score + ', ' + s.type + ')'); }).join('<br>') + '</div>' : '') +
        '</td><td class="num"><b>' + ind.score + '</b></td><td class="num">' + typeChip(ind.type) + '</td></tr>';
    });
    if (state.filter === '전체') {
      h += '<tr><td colspan="3">감점(최대 −2점)</td><td>' + esc(DATA.deduction.name) + '</td><td class="num"><b>−2</b></td><td class="num">' + typeChip('정량') + '</td></tr>';
    }
    h += '</tbody></table></div><p class="muted" style="margin:8px 4px">표는 좌우로 밀어서 볼 수 있습니다.</p>';
    return h;
  }

  function viewIndicator(id) {
    var ind = BY_ID[id];
    if (!ind) { $app.innerHTML = '<p class="empty">지표를 찾을 수 없습니다.</p>'; return; }
    setTitle(ind.id + ' ' + ind.name, ind._cat.name + ' · ' + ind._area.name);
    setTab('home');

    var secs = [];
    var h = '';
    h += '<div class="crumbs" id="detailTop"><span>' + esc(ind._cat.id + '. ' + ind._cat.name) + '</span><span>' + esc(ind._field.id + ' ' + ind._field.name) + '</span><span>' + esc(ind._area.id + ' ' + ind._area.name) + '</span></div>';
    h += '<section class="card detail-head"><div class="iid">진단지표 ' + esc(ind.id) + '</div><h2>' + esc(ind.name) + '</h2><div class="chips">' + typeChip(ind.type) + '<span class="chip score">' + ind.score + '점</span>' + (ind.pages ? '<span class="chip">편람 ' + esc(ind.pages) + '쪽</span>' : '') + '</div>';
    if (ind.sub) {
      h += '<div class="subs">' + ind.sub.map(function (s) {
        return '<div class="sub"><span class="no">' + esc(s.no) + '</span><span class="nm">' + esc(s.name) + '</span>' + typeChip(s.type) + '<b>' + s.score + '점</b></div>';
      }).join('') + '</div>';
    }
    h += '</section>';

    // sections
    var body = '';
    function sec(key, title, html, tool) { secs.push([key, title]); body += '<section class="card sec" id="s-' + key + '"><h3>' + esc(title) + (tool || '') + '</h3>' + html + '</section>'; }

    var ov = '';
    if (ind.notes) ov += ind.notes.map(function (n) { return '<div class="callout warn" style="margin:0 0 12px">' + esc(n) + '</div>'; }).join('');
    ov += '<h4 style="margin-top:0">진단 방향</h4><ul class="dots">' + ind.direction.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>';
    var defBtn = (ind.definitions && ind.definitions.length) ? '<button type="button" class="sec-tool" data-defs aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>용어의 정의</button>' : '';
    sec('ov', '개요', ov, defBtn);

    var el = '<ul class="el-list">';
    ind.elements.forEach(function (e) {
      if (e.group) { el += '<li class="el-group">' + esc(e.group) + '</li>'; return; }
      el += '<li class="el-item"><span class="t">' + esc(e.text) + '</span>' + (e.ev ? (ind.evidence ? '<button type="button" class="ev ev-btn" data-ev="' + esc(e.ev) + '" aria-haspopup="dialog" title="증빙자료 보기">' : '<span class="ev">') + '증빙 ' + esc(e.ev) + (ind.evidence ? '</button>' : '</span>') : '') + '</li>';
    });
    el += '</ul>';
    var evBtn = (ind.evidence && ind.evidence.length) ? '<button type="button" class="sec-tool" data-ev="" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14l2 2 4-4"/></svg>증빙자료</button>' : '';
    sec('el', '진단요소', el, evBtn);

    if (ind.forms && ind.forms.length) {
      var fm = '<p class="muted" style="margin-top:-4px">항목을 누르면 편람의 해당 양식·작성 지침 쪽(PDF)이 팝업으로 열립니다.</p>';
      ind.forms.forEach(function (f, fi) {
        var kind = f.label.indexOf('표') === 0 ? '표' : '기술';
        fm += '<button type="button" class="form form-btn" data-form="' + fi + '" aria-haspopup="dialog"><span class="lbl ' + kind + '">' + esc(f.label) + '</span><span class="ttl">' + esc(f.title) +
          (f.pdfPages ? '<small>편람 ' + f.pdfPages.map(function (n) { return n - 1; }).join('·') + '쪽 · PDF 보기</small>' : '') + '</span>' +
          '<svg class="pdf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg></button>';
      });
      sec('fm', '작성자료·지침', fm);
    }

    var sc = '', pops = [];
    if (ind.formulas) {
      pops.push({ kind: '산식', title: '산출 방법', html: ind.formulas.map(function (f) { return '<div class="formula">' + esc(f) + '</div>'; }).join('') });
    }
    ind.scales.forEach(function (s) {
      var t, hh = '';
      if (s.kind === 'qual') {
        t = s.title || ('진단 척도 (정성, ' + s.points[0] + '점)');
        hh += '<div class="table-wrap"><table class="qual-scale"><thead><tr><th>진단</th><th>진단 기준</th><th class="num">배점</th></tr></thead><tbody>' +
          qualRows(s.n, s.points).map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + r[2] + '</td></tr>'; }).join('') + '</tbody></table></div>';
      } else {
        t = s.title;
        if (s.rows.length === 1) {
          // 한 줄짜리 척도표는 휴대폰에서 읽기 쉽게 세로(기준 | 배점)로 바꿔서 표시
          hh += '<div class="table-wrap"><table class="vert-scale"><thead><tr><th>' + esc(s.headers[0]) + '</th><th class="num">' + esc(s.rows[0][0]) + '</th></tr></thead><tbody>' +
            s.headers.slice(1).map(function (hd, i) { return '<tr><td>' + esc(hd) + '</td><td class="num"><b>' + esc(s.rows[0][i + 1]) + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
        } else {
          hh += '<div class="table-wrap"><table><thead><tr>' + s.headers.map(function (x, i) { return '<th' + (i ? ' class="num"' : '') + '>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
            s.rows.map(function (r) { return '<tr>' + r.map(function (x, i) { return '<td' + (i ? ' class="num"' : '') + '>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
        }
        if (s.note) hh += '<div class="callout">※ ' + esc(s.note) + '</div>';
      }
      pops.push({ kind: '척도', title: t, html: hh });
    });
    if (pops.length) {
      sc += '<p class="muted" style="margin-top:-4px">항목을 누르면 산식·척도표가 팝업으로 열립니다.</p>';
      sc += pops.map(function (pp, pi) {
        return '<button type="button" class="form form-btn" data-pop="' + pi + '" aria-haspopup="dialog"><span class="lbl ' + pp.kind + '">' + pp.kind + '</span><span class="ttl">' + esc(pp.title) + '</span>' +
          '<svg class="pdf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          (pp.kind === '산식' ? '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M9 12h6M12 9v6M9 17h6"/>' : '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/>') +
          '</svg></button>';
      }).join('');
    }
    if (ind.calc && CALCS[ind.calc]) sc += CALCS[ind.calc].html();
    sec('sc', '진단척도', sc);

    if (ind.changes) {
      sec('ch', '3주기 변경', '<p class="muted" style="margin-top:-4px">항목을 누르면 변경사항 원문(개정 전·후 비교)이 팝업으로 열립니다.</p>' +
        ind.changes.map(function (c, ci) {
          return '<button type="button" class="form form-btn ch-btn" data-ch="' + ci + '" aria-haspopup="dialog"><span class="lbl 변경">변경</span><span class="ttl">' + emphChange(c) + '</span>' +
            '<svg class="pdf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h11M4 12h7M4 17h11"/><path d="M17 10l3 3-3 3"/></svg></button>';
        }).join(''));
    }

    h += '<nav class="toc" aria-label="지표 내 이동">' + secs.map(function (s) { return '<a href="#s-' + s[0] + '" data-sec="' + s[0] + '">' + esc(s[1]) + '</a>'; }).join('') + '</nav>';
    h += body;

    var pos = INDEX.indexOf(ind);
    var prev = INDEX[pos - 1], next = INDEX[pos + 1];
    h += '<div class="pager">' +
      (prev ? '<a href="#/i/' + prev.id + '"><small>‹ 이전 지표</small>' + esc(prev.id + ' ' + prev.name) + '</a>' : '<span class="ghost"></span>') +
      (next ? '<a class="next" href="#/i/' + next.id + '"><small>다음 지표 ›</small>' + esc(next.id + ' ' + next.name) + '</a>' : '<span class="ghost"></span>') +
      '</div>';

    $app.innerHTML = h;
    if (ind.calc && CALCS[ind.calc]) CALCS[ind.calc].bind($app);

    // in-page nav (hash is used for routing, so scroll manually)
    $app.querySelectorAll('.toc a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        setTocOn(a);
        spyLock = Date.now() + 1200;
        var t = document.getElementById('s-' + a.getAttribute('data-sec'));
        if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' });
      });
    });
    $app.querySelectorAll('[data-ev]').forEach(function (b) {
      b.addEventListener('click', function () {
        var want = (b.getAttribute('data-ev').match(/[①-⑳]/g) || []);
        var list = ind.evidence.filter(function (d) { return !want.length || want.indexOf(d.trim().charAt(0)) >= 0; });
        if (!list.length) list = ind.evidence;
        openInfo('증빙자료' + (want.length ? ' ' + want.join(', ') : ''), ind.id + ' ' + ind.name,
          '<ul class="plain">' + list.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
          '<div class="callout" style="margin-top:12px">※ 증빙자료 미제출 시 해당 진단요소 실적 미인정</div>');
      });
    });
    $app.querySelectorAll('[data-ch]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ci = +b.getAttribute('data-ch');
        var lead = '<b class="doc-lead-t">3주기 변경 요약</b><ul class="dots">' + ind.changes.map(function (c, i) { return '<li' + (i === ci ? ' class="hl"' : '') + '>' + emphChange(c) + '</li>'; }).join('') + '</ul>';
        var pg = ind.changePages || [];
        if (!pg.length) lead += '<p class="muted" style="margin:8px 0 0">변경사항 원문에는 이 지표의 개별 비교표가 없고, 공통 변경 사항만 해당됩니다. 위 "PDF로 열기"에서 변경사항 전체를 볼 수 있습니다.</p>';
        openDoc('3주기 변경 사항', ind.id + ' ' + ind.name, pg.map(function (n) {
          var pad = ('00' + n).slice(-3);
          return { src: HB.docs + 'changes/p' + pad + '.png', alt: '변경사항 원문 ' + n + '쪽', cap: '변경사항 원문 ' + n + '쪽' };
        }), HB.docs + 'changes/' + (pg.length ? ind.id : 'all') + '.pdf', lead);
      });
    });
    $app.querySelectorAll('[data-pop]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pp = pops[+b.getAttribute('data-pop')];
        openInfo(pp.title, ind.id + ' ' + ind.name, pp.html, true);
      });
    });
    $app.querySelectorAll('[data-form]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = ind.forms[+b.getAttribute('data-form')];
        if (!f.pdfPages) return;
        openDoc(f.label, f.title, f.pdfPages.map(function (n) {
          var pad = ('00' + n).slice(-3);
          return { src: HB.docs + 'pages/p' + pad + '.png', alt: '편람 ' + (n - 1) + '쪽', cap: '편람 ' + (n - 1) + '쪽' };
        }), HB.docs + f.file);
      });
    });
    var $defs = $app.querySelector('[data-defs]');
    if ($defs) $defs.addEventListener('click', function () {
      openInfo('용어의 정의', ind.id + ' ' + ind.name, '<ul class="dots">' + ind.definitions.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>');
    });
    setupScrollSpy();
  }

  /* ---------- 공용 팝업 (용어의 정의 등) ---------- */
  var $info = null, infoLast = null, infoZoom = null;
  function closeInfo() { if (!$info || $info.hidden) return; $info.hidden = true; document.body.classList.remove('modal-open'); if (infoLast) infoLast.focus(); }
  function openInfo(title, sub, html, wide) {
    if (!$info) {
      $info = document.createElement('div');
      $info.className = 'modal'; $info.id = 'infoModal'; $info.hidden = true;
      $info.setAttribute('role', 'dialog'); $info.setAttribute('aria-modal', 'true'); $info.setAttribute('aria-labelledby', 'infoTitle');
      $info.innerHTML = '<div class="modal-box modal-sm"><div class="modal-head"><b id="infoTitle"></b><button type="button" class="modal-close" aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
        '<div class="modal-text"><div class="zoom-in"></div></div>' +
        '<div class="zoom-ctl" role="group" aria-label="확대·축소"><button type="button" data-zoom="-" aria-label="축소"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg></button><output aria-live="polite">100%</output><button type="button" data-zoom="+" aria-label="확대"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button></div></div>';
      var $zin = $info.querySelector('.zoom-in');
      infoZoom = makeZoomable($info.querySelector('.modal-text'), $info.querySelector('.zoom-ctl'),
        function () { return 1; }, function (z) { $zin.style.zoom = z; });
      document.body.appendChild($info);
      $info.addEventListener('click', function (e) { if (e.target === $info || e.target.closest('.modal-close')) closeInfo(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeInfo(); });
      window.addEventListener('hashchange', closeInfo);
    }
    infoLast = document.activeElement;
    $info.querySelector('#infoTitle').innerHTML = esc(title) + (sub ? ' <small>' + esc(sub) + '</small>' : '');
    $info.querySelector('.zoom-in').innerHTML = html;
    infoZoom.reset(); $info.querySelector('.modal-text').scrollTop = 0;
    $info.querySelector('.modal-box').classList.toggle('modal-wide', !!wide);
    $info.hidden = false; document.body.classList.add('modal-open');
    $info.querySelector('.modal-close').focus();
  }

  /* 팝업이 열려 있으면 Tab 키 포커스를 팝업 안에서만 돌게 함 */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var m = document.querySelector('.modal:not([hidden])');
    if (!m) return;
    var f = Array.prototype.filter.call(m.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* 화면 바탕: 자동(기기 설정) · 흰 바탕 · 검은 바탕 (localStorage jsh-theme) */
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    document.querySelectorAll('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === (t || 'auto') ? 'true' : 'false'); });
    var cur = document.getElementById('themeCur'); if (cur) cur.textContent = { light: '흰 바탕', dark: '검은 바탕' }[t] || '자동';
  }
  (function () {
    var t = 'auto'; try { t = localStorage.getItem('jsh-theme') || 'auto'; } catch (e) {}
    applyTheme(t);
    document.querySelectorAll('[data-theme-set]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = b.getAttribute('data-theme-set');
        try { localStorage.setItem('jsh-theme', v); } catch (er) {}
        applyTheme(v);
      });
    });
  })();

  var spy = null, spyLock = 0;
  function setTocOn(a) {
    $app.querySelectorAll('.toc a').forEach(function (x) { x.classList.toggle('on', x === a); x.removeAttribute('aria-current'); });
    if (a) { a.setAttribute('aria-current', 'true'); a.parentNode.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' }); }
  }
  function setupScrollSpy() {
    if (spy) spy.disconnect();
    if (!('IntersectionObserver' in window)) return;
    var links = {};
    $app.querySelectorAll('.toc a').forEach(function (a) { links['s-' + a.getAttribute('data-sec')] = a; });
    spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && Date.now() > spyLock && links[en.target.id]) setTocOn(links[en.target.id]);
      });
    }, { rootMargin: '-70px 0px -60% 0px' });
    $app.querySelectorAll('section.sec').forEach(function (s) { spy.observe(s); });
  }

  /* ---------- calculators (참고용) ---------- */
  function num(root, name) {
    var el = root.querySelector('[name="' + name + '"]');
    if (!el || el.value === '') return NaN;
    return parseFloat(String(el.value).replace(/,/g, ''));
  }
  function calcBox(title, fields, note) {
    return '<details class="calc" data-calc><summary><svg class="calc-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"/></svg><h4>' + esc(title) + '</h4><span class="calc-hint">계산해 보기</span>' + caret() + '</summary><div class="calc-body"><div class="muted">값을 입력하면 편람 산식에 따라 점수를 계산합니다. (참고용 · 소수점 처리는 편람 기준 확인)</div><div class="grid">' +
      fields + '</div><div class="out" data-out><span class="muted">값을 입력하세요.</span></div>' + (note ? '<div class="muted" style="margin-top:8px">' + esc(note) + '</div>' : '') + '</div></details>';
  }
  function inp(name, label, full, ph) {
    return '<label' + (full ? ' class="full"' : '') + '>' + esc(label) + '<input type="number" inputmode="decimal" name="' + name + '" placeholder="' + esc(ph || '') + '"></label>';
  }
  function outRows(rows) {
    return rows.map(function (r) { return '<div class="row"><span>' + esc(r[0]) + '</span>' + (r[2] ? '<b>' + r[1] + '</b>' : '<span>' + r[1] + '</span>') + '</div>'; }).join('');
  }
  function bindCalc(root, fn) {
    var box = root.querySelector('[data-calc]');
    if (!box) return;
    var out = box.querySelector('[data-out]');
    var run = function () { var r = fn(box); out.innerHTML = r || '<span class="muted">값을 입력하세요.</span>'; };
    box.addEventListener('input', run);
    box.addEventListener('change', run);
  }
  function band(v, hi, lo, hiPts, loPts, mid) {
    if (v >= hi) return hiPts;
    if (v <= lo) return loPts;
    return mid(v);
  }

  var CALCS = {
    fulltime: {
      html: function () { return calcBox('① 전임교원 강의담당 비율 점수 계산', inp('A', '총 개설학점 수 [A]') + inp('B', '전임교원 담당학점 [B]')); },
      bind: function (root) {
        bindCalc(root, function (b) {
          var A = num(b, 'A'), B = num(b, 'B');
          if (!(A > 0) || !(B >= 0)) return '';
          var C = B / A * 100;
          var s = band(C, 30, 6, 2, 0.4, function (c) { return c / 15; });
          return outRows([['담당비율 [C]', fmt(C) + '%'], ['강의담당 지수 [D=C/15]', C > 6 && C < 30 ? fmt(C / 15) : '해당 없음'], ['예상 배점 (2점 만점)', fmt(s) + '점', 1]]);
        });
      }
    },
    finance: {
      html: function () {
        return calcBox('재정 지원 점수 계산',
          inp('A1', '① 실험실습비 총액(원) [A]', true) + inp('B1', '① 재학생수(명) [B]', true) +
          inp('A2', '② 등록금 수입 총액(원) [A]', true) + inp('B2', '② 장학금 지급 총액(원) [B]', true));
      },
      bind: function (root) {
        bindCalc(root, function (b) {
          var rows = [], total = 0, ok = 0;
          var A1 = num(b, 'A1'), B1 = num(b, 'B1');
          if (A1 >= 0 && B1 > 0) {
            var C1 = A1 / B1;
            var s1 = band(C1, 172000, 57333, 4, 1, function (c) { return 3 / (172000 - 57333) * c - 0.5; });
            rows.push(['① 1인당 실험실습비 [C]', fmt(C1, 0) + '원'], ['① 배점 (4점 만점)', fmt(s1) + '점', 1]);
            total += s1; ok++;
          }
          var A2 = num(b, 'A2'), B2 = num(b, 'B2');
          if (A2 > 0 && B2 >= 0) {
            var C2 = B2 / A2 * 100;
            var s2 = band(C2, 10, 3.33, 4, 1, function (c) { return 3 / (10 - 3.33) * c - 0.5; });
            rows.push(['② 등록금 대비 장학금 비율 [C]', fmt(C2) + '%'], ['② 배점 (4점 만점)', fmt(s2) + '점', 1]);
            total += s2; ok++;
          }
          if (!ok) return '';
          if (ok === 2) rows.push(['합계 (8점 만점)', fmt(total) + '점', 1]);
          return outRows(rows);
        });
      }
    },
    credits: {
      html: function () {
        return calcBox('② 학기당 편성학점 지수 계산',
          inp('y1s1', '1학년 1학기 편성학점') + inp('y1s2', '1학년 2학기 편성학점') +
          inp('y2s1', '2학년 1학기 (1년 과정은 비움)') + inp('y2s2', '2학년 2학기 (1년 과정은 비움)'));
      },
      bind: function (root) {
        bindCalc(root, function (b) {
          var a = num(b, 'y1s1'), c = num(b, 'y1s2'), d = num(b, 'y2s1'), e = num(b, 'y2s2');
          if (!(a >= 0 && c >= 0)) return '';
          var two = d >= 0 && e >= 0;
          var sum = a + c + (two ? d + e : 0), n = two ? 4 : 2;
          var idx = sum / n;
          var s = idx >= 15 ? 2 : idx >= 14 ? 1.6 : idx >= 13 ? 1.2 : idx >= 12 ? 0.8 : 0.4;
          return outRows([['과정', two ? '2년 과정' : '1년 과정'], ['학기당 편성학점 지수', fmt(idx)], ['예상 배점 (2점 만점)', s + '점', 1]]);
        });
      }
    },
    enroll: {
      html: function () { return calcBox('재학생 충원율 점수 계산', inp('A', '학생정원(명) [A]') + inp('B', '재학생(명) [B]')); },
      bind: function (root) {
        bindCalc(root, function (b) {
          var A = num(b, 'A'), B = num(b, 'B');
          if (!(A > 0) || !(B >= 0)) return '';
          var C = B / A * 100;
          var s = band(C, 80, 30, 10, 2, function (c) { return 8 / 50 * c - 2.8; });
          return outRows([['재학생 충원율 [C]', fmt(C) + '%'], ['예상 배점 (10점 만점)', fmt(s) + '점', 1]]);
        });
      }
    },
    employ: {
      html: function () { return calcBox('졸업생 취업률 점수 계산', inp('A', '졸업자(명) [A]') + inp('B', '취업자(명) [B]') + inp('C', '취업제외 대상자(명) [C]', true)); },
      bind: function (root) {
        bindCalc(root, function (b) {
          var A = num(b, 'A'), B = num(b, 'B'), C = num(b, 'C');
          if (isNaN(C)) C = 0;
          if (!(A - C > 0) || !(B >= 0)) return '';
          var D = B / (A - C) * 100;
          var s = band(D, 70, 30, 10, 2, function (d) { return d / 5 - 4; });
          return outRows([['졸업생 취업률 [D]', fmt(D) + '%'], ['예상 배점 (10점 만점)', fmt(s) + '점', 1]]);
        });
      }
    },
    staff: {
      html: function () {
        return calcBox('운영조직 및 지원 계산',
          '<label class="full">편제정원<select name="band"><option value="0">200명 이상</option><option value="1">100명 이상~200명 미만</option><option value="2">100명 미만</option></select></label>' +
          inp('dA', '전담직원 수 [A]') + inp('dB', '겸직직원 수 [B]') +
          '<label class="full">전담부서(센터) 운영<select name="center"><option value="0">미운영</option><option value="1">운영 (+0.5명)</option></select></label>' +
          inp('eT', '② 전임교원 수') + inp('eH', '② 외부교육 3시간 이상 참여(명)') + inp('eL', '② 외부교육 3시간 미만 참여(명)') + inp('eI', '② 내부교육 참여(명)'),
          '② 교육지수 배점표는 편람 원문(0.5 이상 3점, 0.5 2.5점, 0.4 2.0점, 0.3 1.5점, 0.2 미만 1.0점)을 참고하세요.');
      },
      bind: function (root) {
        var T = [[2.5, 2.0, 1.5, 1.0, 0.5], [2.0, 1.5, 1.0, 0.5], [1.5, 1.0, 0.5]];
        var P = [5, 4, 3, 2, 1];
        bindCalc(root, function (b) {
          var rows = [];
          var A = num(b, 'dA'), B = num(b, 'dB');
          var center = b.querySelector('[name="center"]').value === '1';
          var bnd = +b.querySelector('[name="band"]').value;
          if (A >= 0 || B >= 0) {
            A = A >= 0 ? A : 0; B = B >= 0 ? B : 0;
            var conv = A + Math.min(B, 3) * 0.5 + (center ? 0.5 : 0);
            var s = null;
            for (var i = 0; i < T[bnd].length; i++) { if (conv >= T[bnd][i] - 1e-9) { s = P[i]; break; } }
            rows.push(['① 환산 인원 계', fmt(conv) + '명'], ['① 예상 배점 (5점 만점)', s == null ? '표 기준 미달' : s + '점', 1]);
            var t = num(b, 'eT');
            if (t >= 0) {
              var C = (num(b, 'eH') || 0) + (num(b, 'eL') || 0) * 0.5 + (num(b, 'eI') || 0) * 0.25;
              var den = t + A + B;
              rows.push(['② 교육참여자 환산값 [C]', fmt(C) + '명'], ['② 교육 지수 [D=C/(A+B)]', den > 0 ? fmt(C / den, 3) : '–', 1]);
            }
          }
          return rows.length ? outRows(rows) : '';
        });
      }
    }
  };

  /* ---------- search ---------- */
  function searchDocs() {
    var docs = [];
    INDEX.forEach(function (ind) {
      var push = function (where, text) { docs.push({ ind: ind, where: where, text: text }); };
      push('지표명', ind.id + ' ' + ind.name);
      (ind.sub || []).forEach(function (s) { push('세부지표', s.no + ' ' + s.name); });
      ind.direction.forEach(function (t) { push('진단 방향', t); });
      (ind.definitions || []).forEach(function (t) { push('용어의 정의', t); });
      ind.elements.forEach(function (e) { if (e.text) push('진단요소', e.text); });
      (ind.evidence || []).forEach(function (t) { push('증빙자료', t); });
      (ind.forms || []).forEach(function (f) {
        push('작성자료 <' + f.label + '>', f.title);
        (f.guide || []).forEach(function (g) { push('작성지침 <' + f.label + '>', g); });
      });
      (ind.formulas || []).forEach(function (t) { push('산출방법', t); });
      (ind.changes || []).forEach(function (t) { push('3주기 변경', t); });
    });
    return docs;
  }
  var DOCS = null;

  function highlight(text, q) {
    var safe = esc(text);
    if (!q) return safe;
    var terms = q.split(/\s+/).filter(Boolean).map(function (t) { return esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    if (!terms.length) return safe;
    return safe.replace(new RegExp('(' + terms.join('|') + ')', 'gi'), '<mark>$1</mark>');
  }
  function snippet(text, q) {
    var t = q.split(/\s+/).filter(Boolean)[0] || '';
    var i = text.toLowerCase().indexOf(t.toLowerCase());
    if (i < 0 || text.length <= 90) return text;
    var s = Math.max(0, i - 30);
    return (s > 0 ? '…' : '') + text.slice(s, s + 90) + (s + 90 < text.length ? '…' : '');
  }

  function viewSearch(q) {
    setTitle('검색', '지표명·진단요소·증빙자료·작성지침');
    setTab('search');
    if (!DOCS) DOCS = searchDocs();
    state.query = q || '';
    var sugg = ['산업체', '자체평가', '환류', '증빙', '외국인 유학생', '재학생', '예산', '4월 1일', '만족도', '실험실습'];
    $app.innerHTML = '<div class="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '<input id="q" type="search" enterkeyhint="search" placeholder="예: 산업체, 환류, 4월 1일" value="' + esc(state.query) + '" autocomplete="off">' +
      '<button class="icon-btn clear" id="qc" aria-label="지우기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="suggest">' + sugg.map(function (s) { return '<button class="filter" data-s="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<div id="results"></div>';
    var $q = document.getElementById('q');
    var run = function () {
      var v = $q.value.trim();
      state.query = v;
      history.replaceState(null, '', '#/search' + (v ? '?q=' + encodeURIComponent(v) : ''));
      renderResults(v);
    };
    $q.addEventListener('input', run);
    document.getElementById('qc').addEventListener('click', function () { $q.value = ''; run(); $q.focus(); });
    $app.querySelectorAll('[data-s]').forEach(function (b) { b.addEventListener('click', function () { $q.value = b.getAttribute('data-s'); run(); }); });
    renderResults(state.query);
    if (!state.query) setTimeout(function () { $q.focus(); }, 50);
  }

  function renderResults(q) {
    var $r = document.getElementById('results');
    if (!q) { $r.innerHTML = '<p class="empty">검색어를 입력하거나 위 추천어를 눌러 보세요.</p>'; return; }
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var groups = {}, order = [];
    DOCS.forEach(function (d) {
      var t = d.text.toLowerCase();
      if (terms.every(function (x) { return t.indexOf(x) >= 0; })) {
        if (!groups[d.ind.id]) { groups[d.ind.id] = []; order.push(d.ind.id); }
        groups[d.ind.id].push(d);
      }
    });
    if (!order.length) { $r.innerHTML = '<p class="empty">"' + esc(q) + '"에 대한 결과가 없습니다.</p>'; return; }
    var total = order.reduce(function (n, id) { return n + groups[id].length; }, 0);
    var h = '<p class="muted" style="margin:4px 4px 10px">' + order.length + '개 지표에서 ' + total + '건</p>';
    order.forEach(function (id) {
      var ind = BY_ID[id], hits = groups[id];
      h += '<a class="card result" href="#/i/' + id + '"><div style="display:flex;gap:8px;align-items:center"><span class="chip score">' + esc(id) + '</span><b style="flex:1">' + highlight(ind.name, q) + '</b>' + typeChip(ind.type) + '</div>';
      hits.slice(0, 3).forEach(function (d) {
        if (d.where === '지표명') return;
        h += '<div class="where">' + esc(d.where) + '</div><div class="snip">' + highlight(snippet(d.text, q), q) + '</div>';
      });
      if (hits.length > 3) h += '<div class="where">외 ' + (hits.length - 3) + '건 더 있음</div>';
      h += '</a>';
    });
    $r.innerHTML = h;
  }

  /* ---------- plan ---------- */
  // 기본계획 블록별 "편람 N쪽" 원문 버튼 (handbooks.json 의 planPages 가 있을 때만)
  function planBtn(key, title) {
    var d = HB.planPages && HB.planPages[key];
    if (!d) return '';
    return '<button type="button" class="sec-tool" data-plandoc="' + key + '" data-title="' + esc(title) + '" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>' + esc(d.label) + '</button>';
  }
  function viewPlan() {
    var P = DATA.plan;
    setTitle('운영진단 기본계획', DATA.meta.cycle);
    setTab('plan');
    var h = '';
    h += '<section class="card fold-card"><details class="fold"><summary><span class="fold-t"><b>기본계획 개요</b><small>기본방향 · 추진 체계 · 추진배경 · 연혁</small></span><span class="fold-side"><span class="fold-row"><span class="fold-hint">펼쳐 보기</span><svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>' + planBtn('overview', '기본계획 개요') + '</span></summary><div class="fold-body">';
    h += '<div class="fold-sec"><h4>기본방향</h4><div class="kv">' + P.principles.map(function (p) { return '<div><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></div>'; }).join('') + '</div></div>';

    h += '<div class="fold-sec"><h4>추진 체계</h4><div class="kv">' + P.roles.map(function (p) { return '<div><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></div>'; }).join('') + '</div></div>';

    h += '<div class="fold-sec"><h4>추진배경 및 질 관리체계 변화</h4><ul class="dots">' + P.background.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div><div class="fold-sec"><h4>연혁</h4><ul class="timeline">' + P.history.map(function (s) { return '<li><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></li>'; }).join('') + '</ul></div>';
    h += '</div></details></section>';

    h += '<section class="card"><h3 class="card-h">등급 부여 및 활용' + planBtn('grade', '등급 부여 및 활용') + '</h3><p class="muted" style="margin:0 0 6px">' + esc(P.gradeNote) + '</p>';
    P.grades.forEach(function (g) {
      h += '<div class="grade"><div class="g ' + g.grade + '">' + g.grade + '</div><div><div class="rng">' + esc(g.label) + ' · ' + esc(g.range) + '</div><dl><dt>당해년</dt><dd>' + esc(g.y1) + '</dd><dt>2차년</dt><dd>' + esc(g.y2) + '</dd><dt>3차년</dt><dd>' + esc(g.y3) + '</dd></dl></div></div>';
    });
    h += '</section>';

    h += '<section class="card"><h3 class="card-h">진단 내용' + planBtn('content', '진단 내용') + '</h3><ul class="dots">' + P.content.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<h4>정량 자료 활용</h4><ul class="dots">' + P.quantData.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></section>';

    h += '<section class="card"><h3 class="card-h">연차별 대상 및 시기' + planBtn('schedule', '연차별 대상 및 시기') + '</h3><ul class="timeline">' + P.schedule.map(function (s) { return '<li><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></li>'; }).join('') + '</ul><div class="callout">※ ' + esc(P.scheduleNote) + '</div></section>';

    h += '<section class="card"><h3 class="card-h"><span>진단 대상 <span class="muted">(' + esc(P.target.base) + ')</span></span>' + planBtn('target', '진단 대상') + '</h3><ul class="dots">' + P.target.items.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul><details class="fold"><summary><b>진단 제외 대상</b><span class="fold-n">' + P.target.excluded.length + '개</span><span class="fold-hint">펼쳐 보기</span><svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></summary><ul class="dots">' + P.target.excluded.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></details></section>';

    h += '<section class="card"><h3 class="card-h">정량요소 총괄표<button type="button" class="sec-tool" data-quant aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>편람 11쪽 원문</button></h3><p class="muted" style="margin:0 0 6px">정량요소·근거자료·자료기준·공시시기는 편람 11쪽 원문에서 확인하세요.</p><ul class="quant-list">' +
      DATA.quantSummary.map(function (q) { return q.indicator; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (t) {
        var id = t.split(' ')[0], rest = t.slice(id.length).trim();
        return '<li><a href="#/i/' + esc(id) + '"><em>' + esc(id) + '</em><span>' + esc(rest) + '</span></a></li>';
      }).join('') + '</ul></section>';

    $app.innerHTML = h;
    var qb = $app.querySelector('[data-quant]'); if (qb) qb.addEventListener('click', openQuant);
    $app.querySelectorAll('[data-plandoc]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();   // 접기 묶음 제목 안에 있어도 펼쳐지지 않게
        var d = HB.planPages[btn.getAttribute('data-plandoc')], imgs = [];
        for (var n = d.from; n <= d.to; n++) {
          var pad = ('00' + n).slice(-3);
          imgs.push({ src: HB.docs + 'plan/p' + pad + '.png', alt: '편람 ' + (n - 1) + '쪽', cap: '편람 ' + (n - 1) + '쪽' });
        }
        openDoc(btn.getAttribute('data-title'), HB.name + ' · ' + d.label, imgs, HB.docs + d.pdf);
      });
    });
  }

  /* ---------- changes ---------- */
  function viewChanges() {
    setTitle('3주기 변경사항', '2주기 대비 주요 개선 내용');
    setTab('changes');
    var h = '<h3 class="section-title" style="margin-top:4px">운영진단 체계</h3>';
    DATA.changes.system.forEach(function (c) {
      h += '<section class="card"><b>' + esc(c.title) + '</b><div class="ba"><div><em>기존</em>' + esc(c.before) + '</div><div class="after"><em>개선</em>' + esc(c.after) + '</div></div><p class="muted" style="margin:8px 0 0">사유 · ' + esc(c.reason) + '</p></section>';
    });
    h += '<h3 class="section-title">지표별 변경</h3>';
    INDEX.forEach(function (ind) {
      if (!ind.changes) return;
      var none = ind.changes.length === 1 && ind.changes[0].indexOf('변경 없음') >= 0;
      h += '<a class="card result" href="#/i/' + ind.id + '" style="' + (none ? 'opacity:.7' : '') + '"><div style="display:flex;gap:8px;align-items:center"><span class="chip score">' + esc(ind.id) + '</span><b style="flex:1">' + esc(ind.name) + '</b>' + typeChip(ind.type) + '</div><ul class="dots" style="margin-top:8px;font-size:14px;color:var(--text-2)">' + ind.changes.map(function (c) { return '<li>' + emphChange(c) + '</li>'; }).join('') + '</ul></a>';
    });
    $app.innerHTML = h;
  }

  /* ---------- 참고자료 (비밀번호로 암호화된 파일) ----------
     파일은 AES-GCM 으로 암호화해 refs/*.bin 으로 올리고, 목록은 data/refs.json.
     비밀번호 → PBKDF2(SHA-256) 키. 서버가 없으므로 관리자 작업은 GitHub API(관리자 토큰)로 직접 커밋. */
  var GH_REPO = 'nightbird91/CCU-Jung', GH_BASE = 'advanced/', GH_BRANCH = 'main';
  var REFS = null, REFKEY = null, REF_OK = 'jsh-refs-ok', refLockOpen = false;
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) { var bin = atob(s), b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
  function rand(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function deriveKey(pw, kdf) {
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(kdf.salt), iterations: kdf.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function aesEnc(key, data) { var iv = rand(12); return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data).then(function (ct) { return { iv: b64(iv), ct: ct }; }); }
  function aesDec(key, iv, data) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, data); }
  function checkKey(key, refs) {
    return aesDec(key, refs.check.iv, unb64(refs.check.ct)).then(function (p) { if (dec.decode(p) !== REF_OK) throw new Error('bad'); return key; });
  }
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
  function loadRefs(fresh) {
    if (REFS && !fresh) return Promise.resolve(REFS);
    var inl = document.querySelector('script[type="application/json"][data-src="data/refs.json"]');
    var p = inl ? Promise.resolve(JSON.parse(inl.textContent)) : fetch('data/refs.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    return p.then(function (j) { REFS = j; return j; });
  }
  function unlock(pw) {
    return loadRefs().then(function (refs) {
      if (!refs.check) throw new Error('관리자가 아직 비밀번호를 설정하지 않았습니다.');
      return deriveKey(pw, refs.kdf).then(function (k) { return checkKey(k, refs); }).catch(function (e) {
        if (e && e.message === '관리자가 아직 비밀번호를 설정하지 않았습니다.') throw e;
        throw new Error('비밀번호가 맞지 않습니다.');
      });
    }).then(function (k) { REFKEY = k; syncLock(); return k; });
  }
  function syncLock() {
    var on = !!REFKEY;
    var st = document.getElementById('lockState');
    st.innerHTML = on ? '<b class="lk on">다운로드 가능</b><small>이 창을 닫으면 다시 잠깁니다</small>' : '<b class="lk">잠김</b><small>비밀번호를 넣으면 참고자료를 내려받을 수 있습니다</small>';
    document.getElementById('lockForm').hidden = on;
    document.getElementById('lockOff').hidden = !on;
    if (location.hash.indexOf('#/refs') === 0) viewRefs();
  }
  function msg(id, t, bad) { var m = document.getElementById(id); m.textContent = t || ''; m.classList.toggle('bad', !!bad); }

  document.getElementById('lockForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var $pw = document.getElementById('lockPw');
    if (!$pw.value) { msg('lockMsg', '비밀번호를 입력해 주세요.', true); return; }
    msg('lockMsg', '확인 중…');
    unlock($pw.value).then(function () { $pw.value = ''; msg('lockMsg', ''); }, function (err) { msg('lockMsg', err.message, true); $pw.select(); });
  });
  document.getElementById('lockOff').addEventListener('click', function () { REFKEY = null; refLockOpen = false; syncLock(); msg('lockMsg', '다시 잠갔습니다.'); });

  /* 관리자: GitHub 토큰 (이 기기 localStorage 에만) */
  function ghToken() { try { return localStorage.getItem('jsh-gh-token') || ''; } catch (e) { return ''; } }
  function gh(method, path, body, raw) {
    var t = ghToken();
    if (!t) return Promise.reject(new Error('관리자 설정에서 GitHub 토큰을 먼저 저장해 주세요.'));
    var url = 'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_BASE + path + (method === 'GET' ? '?ref=' + GH_BRANCH + '&t=' + Date.now() : '');
    return fetch(url, {
      method: method, cache: 'no-store',
      headers: { Authorization: 'Bearer ' + t, Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json' },
      body: body ? JSON.stringify(body) : undefined
    }).catch(function (e) {
      throw new Error('GitHub에 연결하지 못했습니다. 실제 사이트(nightbird91.github.io)에서 다시 시도해 주세요. (' + (e && e.message ? e.message : '네트워크 오류') + ')');
    }).then(function (r) {
      if (r.status === 404 && method === 'GET') return null;
      if (r.status === 401) throw new Error('GitHub가 이 토큰을 받아들이지 않았습니다. 토큰이 잘못 복사되었거나 만료·삭제되었을 수 있습니다. 새로 만들어 붙여 넣어 주세요.');
      if (r.status === 403) throw new Error('GitHub 토큰 권한이 없습니다. 토큰 설정에서 저장소 CCU-Jung 를 고르고 Contents 를 Read and write 로 주었는지 확인해 주세요.');
      if (!r.ok) throw new Error('GitHub 오류 (' + r.status + ')');
      return raw ? r.arrayBuffer() : r.json();
    });
  }
  function ghPut(path, bytes, message) {
    return gh('GET', path).then(function (cur) {
      return gh('PUT', path, { message: message, content: b64(bytes), branch: GH_BRANCH, sha: cur ? cur.sha : undefined });
    });
  }
  function ghDel(path, message) {
    return gh('GET', path).then(function (cur) { if (cur) return gh('DELETE', path, { message: message, sha: cur.sha, branch: GH_BRANCH }); });
  }
  function ghRefs() { return gh('GET', 'data/refs.json', null, true).then(function (b) { return b ? JSON.parse(dec.decode(b)) : { kdf: null, check: null, files: [] }; }); }
  function saveRefs(refs, message) { return ghPut('data/refs.json', enc.encode(JSON.stringify(refs, null, 2) + '\n'), message).then(function () { REFS = refs; return refs; }); }
  function refId() { return 'r' + Date.now().toString(36) + Array.prototype.map.call(rand(3), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  var $tok = document.getElementById('ghToken');
  function syncAdmin() {
    $tok.value = ghToken() ? '••••••••••••' : '';
    var $ts = document.getElementById('tokState');
    $ts.textContent = ghToken() ? '저장됨' : '없음'; $ts.classList.toggle('on', !!ghToken());
    var has = REFS && REFS.check;
    document.getElementById('pwForm').hidden = !ghToken();   // 토큰이 없는 기기에는 비밀번호 변경 칸을 숨김
    document.getElementById('pwOldRow').hidden = !has;
    document.getElementById('pwTitle').textContent = has ? '다운로드 비밀번호 변경' : '다운로드 비밀번호 설정';
  }
  syncAdmin();
  document.getElementById('adminBox').addEventListener('toggle', function () { if (this.open) loadRefs().then(syncAdmin, syncAdmin); });
  $tok.addEventListener('focus', function () { if (/^•+$/.test($tok.value)) $tok.value = ''; });
  function tokMsg(t, kind) { var m = document.getElementById('tokMsg'); m.textContent = t || ''; m.className = 'tok-msg' + (kind ? ' ' + kind : ''); if (t && m.scrollIntoView) m.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  document.getElementById('ghSave').addEventListener('click', function () {
    var btn = this, v = $tok.value.replace(/[^\x21-\x7e]/g, '');
    if (!v) { tokMsg(ghToken() ? '이미 토큰이 저장되어 있습니다. 바꾸려면 새 토큰을 붙여 넣고 다시 누르세요.' : '토큰을 붙여 넣은 뒤 눌러 주세요.', ghToken() ? 'ok' : 'bad'); return; }
    try { localStorage.setItem('jsh-gh-token', v); } catch (e) {}
    if (ghToken() !== v) { tokMsg('✕ 이 브라우저에서는 토큰을 저장할 수 없습니다(사생활 보호 모드나 미리보기 화면). 실제 사이트 https://nightbird91.github.io/CCU-Jung/advanced/ 를 일반 창으로 열어 다시 저장해 주세요.', 'bad'); return; }
    btn.disabled = true; btn.textContent = '확인 중…'; tokMsg('GitHub에 토큰을 확인하고 있습니다…');
    /* 저장소 쓰기 권한까지 확인: 토큰으로 저장소 정보를 읽어 permissions.push 를 봄 */
    fetch('https://api.github.com/repos/' + GH_REPO, { cache: 'no-store', headers: { Authorization: 'Bearer ' + v, Accept: 'application/vnd.github+json' } }).catch(function (e) {
      throw new Error('GitHub에 연결하지 못했습니다. 실제 사이트(nightbird91.github.io)에서 다시 시도해 주세요. (' + (e && e.message ? e.message : '네트워크 오류') + ')');
    }).then(function (r) {
      if (r.status === 401) throw new Error('GitHub가 이 토큰을 받아들이지 않았습니다. 토큰이 잘못 복사되었거나 만료·삭제되었을 수 있습니다. 새로 만들어 붙여 넣어 주세요.');
      if (!r.ok) throw new Error('GitHub 오류 (' + r.status + ')');
      return r.json();
    }).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw new Error('토큰은 맞지만 저장소에 쓸 권한이 없습니다. 토큰 설정의 Repository access 에서 ‘Only select repositories → CCU-Jung’을 고르고, Permissions 의 Contents 를 ‘Read and write’로 바꿔 주세요.');
      return gh('GET', 'data/refs.json');
    }).then(function () {
      syncAdmin(); tokMsg('✓ 토큰이 저장되었습니다. 이 기기에서 관리자 기능을 쓸 수 있습니다.', 'ok');
      if (location.hash.indexOf('#/refs') === 0) viewRefs();
    }, function (err) {
      try { localStorage.removeItem('jsh-gh-token'); } catch (e) {}
      syncAdmin(); tokMsg('✕ 저장하지 못했습니다. ' + err.message, 'bad');
    }).then(function () { btn.disabled = false; btn.textContent = '토큰 저장'; });
  });
  document.getElementById('ghClear').addEventListener('click', function () {
    try { localStorage.removeItem('jsh-gh-token'); } catch (e) {}
    syncAdmin(); tokMsg('이 기기에서 토큰을 지웠습니다.', 'ok');
    if (location.hash.indexOf('#/refs') === 0) viewRefs();
  });
  var busy = false;
  document.getElementById('pwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var oldPw = document.getElementById('pwOld').value, nw = document.getElementById('pwNew').value, nw2 = document.getElementById('pwNew2').value;
    if (nw.length < 6) { msg('adminMsg', '새 비밀번호는 6자 이상으로 정해 주세요.', true); return; }
    if (nw !== nw2) { msg('adminMsg', '새 비밀번호 확인이 일치하지 않습니다.', true); return; }
    busy = true; msg('adminMsg', '저장소의 최신 목록을 불러오는 중…');
    var refs, oldKey = null, newKey, kdf = { salt: b64(rand(16)), iter: 250000 }, oldFiles;
    ghRefs().then(function (r) {
      refs = r; oldFiles = refs.files.slice();
      if (!refs.check) return null;
      if (!oldPw) throw new Error('현재 비밀번호를 입력해 주세요.');
      return deriveKey(oldPw, refs.kdf).then(function (k) { return checkKey(k, refs); }).catch(function () { throw new Error('현재 비밀번호가 맞지 않습니다.'); });
    }).then(function (k) {
      oldKey = k;
      return deriveKey(nw, kdf);
    }).then(function (k) {
      newKey = k;
      return aesEnc(newKey, enc.encode(REF_OK));
    }).then(function (chk) {
      var next = { kdf: kdf, check: { iv: chk.iv, ct: b64(chk.ct) }, files: [] };
      // 새 키로 다시 암호화해 새 경로에 올린 뒤 목록을 바꾸고, 마지막에 옛 파일을 지운다 (중간에 끊겨도 옛 상태가 유지됨)
      var chain = Promise.resolve();
      oldFiles.forEach(function (f, i) {
        chain = chain.then(function () {
          msg('adminMsg', '자료 다시 암호화 중… (' + (i + 1) + '/' + oldFiles.length + ')');
          return gh('GET', f.path, null, true);
        }).then(function (buf) {
          if (!buf) return;
          return aesDec(oldKey, f.iv, buf).then(function (plain) { return aesEnc(newKey, plain); }).then(function (c) {
            var nf = Object.assign({}, f, { iv: c.iv, path: 'refs/' + refId() + '.bin' });
            return ghPut(nf.path, new Uint8Array(c.ct), '참고자료: 비밀번호 변경에 따른 재암호화').then(function () { next.files.push(nf); });
          });
        });
      });
      return chain.then(function () { msg('adminMsg', '목록 저장 중…'); return saveRefs(next, refs.check ? '참고자료: 다운로드 비밀번호 변경' : '참고자료: 다운로드 비밀번호 설정'); });
    }).then(function () {
      return oldFiles.reduce(function (p, f) { return p.then(function () { return ghDel(f.path, '참고자료: 옛 암호화 파일 정리'); }); }, Promise.resolve());
    }).then(function () {
      REFKEY = newKey; syncLock(); syncAdmin();
      ['pwOld', 'pwNew', 'pwNew2'].forEach(function (id) { document.getElementById(id).value = ''; });
      msg('adminMsg', '비밀번호를 저장했습니다. 사이트 반영까지 1~2분 걸립니다.');
    }).catch(function (err) { msg('adminMsg', err.message || '저장하지 못했습니다.', true); })
      .then(function () { busy = false; });
  });

  syncLock();

  /* 참고자료 화면 */
  function viewRefs() {
    setTitle('참고자료', '비밀번호를 넣어야 내려받을 수 있습니다');
    setTab('');
    if (!REFS) { $app.innerHTML = '<div class="state" role="status"><span class="spinner"></span><b>참고자료 목록을 불러오는 중입니다</b></div>'; }
    loadRefs().then(renderRefs, function () { $app.innerHTML = '<p class="empty">참고자료 목록을 불러오지 못했습니다.</p>'; });
  }
  function renderRefs(refs) {
    if (location.hash.indexOf('#/refs') !== 0) return;
    var admin = !!ghToken(), h = '';
    if (admin) {
      h += '<section class="card ref-admin"><b>관리자 · 자료 추가</b>' +
        (refs.check ? (REFKEY ? '<p class="muted">파일은 현재 비밀번호로 암호화되어 올라갑니다. 한 파일 20MB까지.</p><label class="ref-pick"><input type="file" multiple data-add><span>파일 선택</span></label>' : '<p class="muted">자료의 \'잠김\'을 눌러 비밀번호를 입력해 잠금을 풀면 자료를 추가할 수 있습니다.</p>')
          : '<p class="muted">설정 → 관리자 설정에서 다운로드 비밀번호를 먼저 정해 주세요.</p>') +
        '<p class="lock-msg" data-admin-msg role="status" aria-live="polite"></p></section>';
    }
    var showLock = !refs.check || REFKEY || refLockOpen;   // 잠긴 상태의 비밀번호 칸은 평소 숨기고, 자료의 '잠김'을 누르면 표시
    if (showLock) {
      h += '<section class="card ref-lock' + (REFKEY ? ' on' : '') + '">';
      if (!refs.check) h += '<b>아직 열 수 없습니다</b><p class="muted">관리자가 다운로드 비밀번호를 설정하면 내려받을 수 있습니다.</p>';
      else if (REFKEY) h += '<b>다운로드 가능</b><p class="muted">이 창을 닫으면 다시 잠깁니다.</p><button type="button" class="lock-link" data-relock>다시 잠그기</button>';
      else h += '<b>잠김</b><p class="muted">다운로드 비밀번호를 입력해 주세요. 비밀번호는 담당자에게 문의해 주세요.</p><form class="lock-form" data-unlock autocomplete="off"><input type="password" class="lock-input" placeholder="다운로드 비밀번호" aria-label="다운로드 비밀번호"><button type="submit" class="lock-btn">확인</button></form><p class="lock-msg" role="status" aria-live="polite"></p>';
      h += '</section>';
    }
    h += '<h3 class="section-title">자료 목록 <span class="muted">' + refs.files.length + '개</span></h3>';
    if (!refs.files.length) h += '<p class="empty">등록된 참고자료가 없습니다.</p>';
    else {
      if (admin && refs.files.length > 1) h += '<div class="ref-order" data-order-bar hidden><span>순서가 바뀌었습니다</span><button type="button" class="lock-btn sm" data-order-save>순서 저장</button><button type="button" class="lock-btn ghost sm" data-order-cancel>취소</button></div>';
      h += '<ul class="ref-list' + (admin ? ' sortable' : '') + '">';
      refs.files.forEach(function (f, i) {
        h += '<li class="card ref-item" data-i="' + i + '">' + (admin && refs.files.length > 1 ? '<button type="button" class="ref-grip" data-grip aria-label="' + esc(f.name) + ' 순서 옮기기. 끌어서 옮기거나 위·아래 화살표 키" title="끌어서 순서 바꾸기"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>' : '') + '<svg class="ref-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>' +
          '<div class="ref-t"><b>' + esc(f.name) + '</b><small>' + fmtSize(f.size) + (f.date ? ' · ' + esc(f.date) : '') + '</small></div>' +
          '<button type="button" class="ref-dl' + (REFKEY ? '' : ' locked') + '" data-dl="' + i + '"' + (REFKEY ? '' : ' aria-label="' + esc(f.name) + ' 잠김, 눌러서 비밀번호 입력"') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (REFKEY ? '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>' : '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>') + '</svg>' + (REFKEY ? '받기' : '잠김') + '</button>' +
          (admin ? '<button type="button" class="ref-del" data-del="' + i + '" aria-label="' + esc(f.name) + ' 삭제">삭제</button>' : '') + '</li>';
      });
      h += '</ul>';
    }
    $app.innerHTML = h;

    var f = $app.querySelector('[data-unlock]');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = f.querySelector('input'), m = $app.querySelector('.ref-lock .lock-msg');
      if (!inp.value) { m.textContent = '비밀번호를 입력해 주세요.'; m.classList.add('bad'); return; }
      m.textContent = '확인 중…'; m.classList.remove('bad');
      unlock(inp.value).catch(function (err) { m.textContent = err.message; m.classList.add('bad'); inp.select(); });
    });
    var rl = $app.querySelector('[data-relock]');
    if (rl) rl.addEventListener('click', function () { REFKEY = null; refLockOpen = false; syncLock(); });
    $app.querySelectorAll('[data-dl]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!REFKEY) {
          refLockOpen = true; renderRefs(refs);
          var i = $app.querySelector('[data-unlock] input');
          if (i) { i.scrollIntoView({ block: 'center' }); i.focus(); }
          return;
        }
        var file = refs.files[+b.getAttribute('data-dl')], label = b.innerHTML;
        b.disabled = true; b.textContent = '받는 중…';
        fetch(file.path + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
          .then(function (buf) { return aesDec(REFKEY, file.iv, buf); })
          .then(function (plain) {
            var url = URL.createObjectURL(new Blob([plain], { type: file.type || 'application/octet-stream' }));
            var a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
          })
          .catch(function () { alertMsg('파일을 받지 못했습니다. 잠시 후 다시 시도해 주세요.'); })
          .then(function () { b.disabled = false; b.innerHTML = label; });
      });
    });
    function alertMsg(t) { var m = $app.querySelector('[data-admin-msg]') || $app.querySelector('.ref-lock .lock-msg'); if (m) { m.textContent = t; m.classList.add('bad'); } }
    function adminMsg(t, bad) { var m = $app.querySelector('[data-admin-msg]'); if (m) { m.textContent = t; m.classList.toggle('bad', !!bad); } }
    var add = $app.querySelector('[data-add]');
    if (add) add.addEventListener('change', function () {
      var files = Array.prototype.slice.call(add.files);
      if (!files.length) return;
      var big = files.filter(function (x) { return x.size > 20 * 1048576; });
      if (big.length) { adminMsg(big[0].name + ' 은(는) 20MB를 넘어 올릴 수 없습니다.', true); add.value = ''; return; }
      var added = [];
      var chain = files.reduce(function (p, file, i) {
        return p.then(function () {
          adminMsg('암호화해 올리는 중… ' + file.name + ' (' + (i + 1) + '/' + files.length + ')');
          return file.arrayBuffer();
        }).then(function (buf) { return aesEnc(REFKEY, buf); }).then(function (c) {
          var meta = { id: refId(), name: file.name, size: file.size, type: file.type || '', date: new Date().toISOString().slice(0, 10), iv: c.iv };
          meta.path = 'refs/' + meta.id + '.bin';
          return ghPut(meta.path, new Uint8Array(c.ct), '참고자료 추가: ' + file.name).then(function () { added.push(meta); });
        });
      }, Promise.resolve());
      chain.then(function () { return ghRefs(); }).then(function (latest) {
        latest.files = latest.files.concat(added);
        return saveRefs(latest, '참고자료 목록 갱신 (' + added.length + '개 추가)');
      }).then(function () { renderRefs(REFS); adminMsg(added.length + '개 자료를 올렸습니다. 사이트 반영까지 1~2분 걸립니다.'); },
        function (err) { adminMsg(err.message || '올리지 못했습니다.', true); });
    });
    // 관리자: 손잡이를 끌어 자료 순서 바꾸기 (마우스·터치 공통 pointer 이벤트, 키보드는 위/아래 화살표)
    var $list = $app.querySelector('.ref-list.sortable'), $bar = $app.querySelector('[data-order-bar]');
    function curOrder() { return Array.prototype.map.call($list.children, function (li) { return +li.getAttribute('data-i'); }); }
    function orderChanged() { var o = curOrder(); $bar.hidden = o.every(function (v, k) { return v === k; }); }
    if ($list && $bar) {
      $list.querySelectorAll('[data-grip]').forEach(function (g) {
        var li = g.closest('li');
        g.addEventListener('pointerdown', function (e) {
          if (e.button) return;
          e.preventDefault(); li.classList.add('dragging');   // 항목을 옮기면 포인터 캡처가 풀리므로 document 에서 받는다
          function move(ev) {
            var y = ev.clientY, sib = Array.prototype.filter.call($list.children, function (x) { return x !== li; });
            var before = null;
            for (var k = 0; k < sib.length; k++) { var r = sib[k].getBoundingClientRect(); if (y < r.top + r.height / 2) { before = sib[k]; break; } }
            if (before !== li.nextElementSibling || (!before && li !== $list.lastElementChild)) $list.insertBefore(li, before);
            if (y < 60) window.scrollBy(0, -12); else if (y > window.innerHeight - 60) window.scrollBy(0, 12);
          }
          function up() { li.classList.remove('dragging'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); orderChanged(); }
          document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
        });
        g.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowUp' && li.previousElementSibling) $list.insertBefore(li, li.previousElementSibling);
          else if (e.key === 'ArrowDown' && li.nextElementSibling) $list.insertBefore(li.nextElementSibling, li);
          else return;
          e.preventDefault(); g.focus(); orderChanged();
        });
      });
      $bar.querySelector('[data-order-cancel]').addEventListener('click', function () { renderRefs(refs); });
      $bar.querySelector('[data-order-save]').addEventListener('click', function () {
        var btn = this, paths = curOrder().map(function (k) { return refs.files[k].path; });
        btn.disabled = true; adminMsg('순서를 저장하는 중…');
        ghRefs().then(function (latest) {
          var rank = {}; paths.forEach(function (p, k) { rank[p] = k; });
          // 그사이 다른 기기에서 추가된 자료는 맨 뒤에 그대로 둔다
          latest.files.sort(function (a, b) { return (a.path in rank ? rank[a.path] : 1e9) - (b.path in rank ? rank[b.path] : 1e9); });
          return saveRefs(latest, '참고자료 순서 변경');
        }).then(function () { renderRefs(REFS); adminMsg('순서를 저장했습니다. 사이트 반영까지 1~2분 걸립니다.'); },
          function (err) { btn.disabled = false; adminMsg(err.message || '순서를 저장하지 못했습니다.', true); });
      });
    }
    $app.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var file = refs.files[+b.getAttribute('data-del')];
        if (b.getAttribute('data-sure') !== '1') { b.setAttribute('data-sure', '1'); b.textContent = '정말 삭제'; b.classList.add('sure'); return; }
        b.disabled = true; adminMsg('삭제 중… ' + file.name);
        ghRefs().then(function (latest) {
          latest.files = latest.files.filter(function (x) { return x.path !== file.path; });
          return saveRefs(latest, '참고자료 삭제: ' + file.name);
        }).then(function () { return ghDel(file.path, '참고자료 파일 삭제: ' + file.name); })
          .then(function () { renderRefs(REFS); adminMsg(file.name + ' 을(를) 삭제했습니다.'); }, function (err) { b.disabled = false; adminMsg(err.message || '삭제하지 못했습니다.', true); });
      });
    });
  }

  /* ---------- router ---------- */
  var lastRoute = '';
  function route() {
    var hash = location.hash.replace(/^#/, '') || '/';
    var path = hash.split('?')[0];
    var qs = hash.indexOf('?') >= 0 ? hash.slice(hash.indexOf('?') + 1) : '';
    var params = {};
    qs.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); params[p[0]] = decodeURIComponent(p[1] || ''); });

    var isDetail = path.indexOf('/i/') === 0 || path.indexOf('/f/') === 0 || path.indexOf('/c/') === 0;
    if ($back) $back.hidden = !isDetail;
    if (spy) { spy.disconnect(); spy = null; }

    if (path.indexOf('/i/') === 0) viewIndicator(path.slice(3));
    else if (path.indexOf('/f/') === 0) {
      var fr = findField(path.slice(3));
      if (fr) { location.replace('#/i/' + fr.f.areas[0].indicators[0].id); return; }
      viewHome();
    }
    else if (path.indexOf('/c/') === 0) viewCategory(path.slice(3));
    else if (path === '/search') viewSearch(params.q);
    else if (path === '/plan') viewPlan();
    else if (path === '/changes') viewChanges();
    else if (path === '/refs') viewRefs();
    else viewHome();

    markSidebar(path);
    var sameField = path.indexOf('/i/') === 0 && lastRoute.indexOf('/i/') === 0 && BY_ID[path.slice(3)] && BY_ID[lastRoute.slice(3)] && BY_ID[path.slice(3)]._field === BY_ID[lastRoute.slice(3)]._field;
    if (sameField) {
      var t = document.getElementById('detailTop');
      if (t && t.getBoundingClientRect().top < 0) window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 10);
    } else if (path !== lastRoute) window.scrollTo(0, 0);
    lastRoute = path;
  }

  if ($back) $back.addEventListener('click', function () {
    var navigated = false;
    try { navigated = !!sessionStorage.getItem('jsh-nav'); } catch (e) {}
    if (navigated) history.back();
    else location.hash = '#/';
  });
  window.addEventListener('hashchange', function () { try { sessionStorage.setItem('jsh-nav', '1'); } catch (e) {} route(); });
  window.addEventListener('scroll', function () { $top.classList.toggle('show', window.scrollY > 600); }, { passive: true });
  $top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---------- 편람 목록 / 선택 ---------- */
  var HBS = [], HB = null;
  function loadJSON(path) {
    var inl = document.querySelector('script[type="application/json"][data-src="' + path + '"]');
    if (inl) return Promise.resolve(JSON.parse(inl.textContent));
    // 느린 회선: 20초가 지나면 오류 화면(다시 시도)으로 전환
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : 0;
    return fetch(path, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(timer); throw new Error(e && e.name === 'AbortError' ? '응답 시간 초과' : '네트워크 오류'); });
  }
  function renderHbInfo() {
    var $sel = document.getElementById('hbSelect');
    $sel.innerHTML = HBS.map(function (h) { return '<option value="' + esc(h.id) + '"' + (h === HB ? ' selected' : '') + '>' + esc(h.name) + '</option>'; }).join('');
    document.getElementById('hbInfo').innerHTML =
      '<div class="settings-row"><span>진단기준년도</span><b>' + esc(HB.baseYear) + '</b></div>' +
      '<div class="settings-row"><span>운영진단 실시</span><b>' + esc(HB.evalYear) + '</b></div>' +
      '<div class="settings-row"><span>진단 주기</span><b>' + esc(HB.cycle) + '</b></div>' +
      '<div class="settings-row"><span>발간</span><b>' + esc(HB.published) + '</b></div>';
    var $full = document.getElementById('fullOpen');
    $full.hidden = !HB.fullPdf;
    if (HB.fullPdf) { $full.href = HB.docs + HB.fullPdf; $full.setAttribute('download', 'handbook-' + HB.id + '.pdf'); document.getElementById('fullInfo').textContent = 'PDF 다운로드' + (HB.fullPages ? ' · ' + HB.fullPages + '쪽' : ''); }
  }
  function useHandbook(h) {
    HB = h;
    try { localStorage.setItem('jsh-hb', h.id); } catch (e) {}
    renderHbInfo();
    return loadJSON(h.data).then(function (d) {
      DATA = d;
      buildIndex();
      renderSidebar();
      document.getElementById('footer').innerHTML = '출처 : ' + esc(d.meta.title) + ' ' + esc(d.meta.cycle) + ' (' + esc(HB.name) + ', 진단기준년도 ' + esc(HB.baseYear) + ', ' + esc(d.meta.published) + '). 본 페이지는 열람 편의를 위한 정리본이며, 정확한 내용은 편람 원문을 확인하세요.';
      route();
    });
  }
  document.getElementById('hbSelect').addEventListener('change', function (e) {
    var h = HBS.filter(function (x) { return x.id === e.target.value; })[0];
    if (h && h !== HB) { showLoading(h.name + '을(를) 불러오는 중입니다'); useHandbook(h).catch(fail); }
  });
  /* 불러오는 중 · 오류(다시 시도) 상태 */
  function showLoading(msg) {
    $app.innerHTML = '<div class="state" role="status"><div class="spinner" aria-hidden="true"></div><b>' + esc(msg || '편람을 불러오는 중입니다') + '</b><p>잠시만 기다려 주세요.</p></div>';
  }
  function fail(e) {
    var local = location.protocol === 'file:';
    $app.innerHTML = '<div class="state" role="alert"><b>편람 데이터를 불러오지 못했습니다</b><p>' +
      (local ? '파일을 직접 열면 데이터를 읽을 수 없습니다. 웹 주소(GitHub Pages 등)로 접속해 주세요.' : '인터넷 연결을 확인한 뒤 다시 시도해 주세요.') +
      ' <span class="muted">(' + esc(e && e.message || '알 수 없는 오류') + ')</span></p>' +
      '<button type="button" class="retry-btn" data-retry>다시 시도</button></div>';
    var b = $app.querySelector('[data-retry]');
    b.addEventListener('click', boot); b.focus();
  }
  function boot() {
    showLoading();
    return loadJSON('data/handbooks.json').then(function (list) {
      HBS = list;
      var saved = null; try { saved = localStorage.getItem('jsh-hb'); } catch (e) {}
      var h = list.filter(function (x) { return x.id === saved; })[0] || list[0];
      return useHandbook(h);
    }).catch(fail);
  }
  boot();
})();
