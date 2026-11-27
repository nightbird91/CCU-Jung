/* 전문대학 기관평가인증 편람 열람 – 빌드 없는 정적 SPA (hash routing)
   화면 구성·동작은 전공심화 운영진단 편람(advanced/)과 같고, 데이터 구조만 다름:
   평가영역 → 평가준거 → 평가요소 → 판단항목 / 평가활용 참고자료 / 주요 확인 및 유의사항 */
(function () {
  'use strict';

  var HBS = [], HB = null, Y = 2027, DATA = null, AREAS = [], QA = null, QA_BY_EL = {};
  var INDEX = [];        // 평탄화된 평가요소 목록 (순서 유지)
  var BY_ID = {}, CRIT = {};
  var state = { filter: '전체', query: '', folded: true };
  var DOCS = null;

  var $app = document.getElementById('app');
  var $top = document.getElementById('topBtn');

  /* ---------- utils ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function caret() {
    return '<svg class="caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  }
  function typeChip(t) { return '<span class="chip ' + esc(t) + '">' + esc(t) + '</span>'; }
  function judgeChip(s) {
    var m = { '충족(P)': 'P', '충족(개선권고)': 'PI', '조건부충족(CP)': 'CP', '미충족(F)': 'F' };
    return m[s] ? '<span class="chip ' + m[s] + '">' + esc(s) + '</span>' : esc(s);
  }
  function setTitle(main) {
    var t = Y + ' 전문대학 기관평가인증 편람'; document.title = main ? main + ' · ' + t : t;
  }
  function setTab(name) {
    document.querySelectorAll('.tabbar a').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('data-tab') === name);
      if (a.getAttribute('data-tab') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function short(e) { return DATA.short[e.id] || e.q; }
  function postKeys(e) { return e.items.filter(function (x) { return x.tags.indexOf('사후') >= 0; }).map(function (x) { return x.k; }); }
  function isPost(e) { return postKeys(e).length > 0 || !!(e.quant && e.quant.tags.indexOf('사후') >= 0); }
  function img(p) { return (window.IMG_DATA && window.IMG_DATA[p]) || p; }
  function slideSrc(n) { return img(HB.docs + 'briefing/s' + n + '.jpg'); }
  function CHG() { return Y + ' 변경'; }
  function slideTitle(n) { return DATA.slideTitles[n] || ''; }

  /* ---------- data ---------- */
  function buildIndex() {
    INDEX = []; BY_ID = {}; CRIT = {}; DOCS = null;
    AREAS = DATA.areaList; ALLCRIT = [];
    AREAS.forEach(function (a, ai) {
      a._n = ai + 1;
      a.criteria.forEach(function (c) {
        c._area = a; CRIT[c.id] = c; ALLCRIT.push(c);
        c.elements.forEach(function (e) { e._crit = c; e._area = a; INDEX.push(e); BY_ID[e.id] = e; });
      });
    });
  }
  function formsOf(e) {
    var out = [];
    function walk(b) { if (b.t === 'form') out.push(b); if (b.t === 'forms') out = out.concat(b.items); if (b.t === 'calc' && b.form) out.push(b.form); }
    e.notes.forEach(walk); (e.extra || []).forEach(walk);
    return out;
  }
  function calcOf(e) { return (e.extra || []).concat(e.notes).filter(function (b) { return b.t === 'calc'; })[0]; }

  /* ---------- views: 평가체계 ---------- */
  function match(e) {
    return state.filter === '전체' || e.type === state.filter || (state.filter === '사후점검' && isPost(e)) || (state.filter === CHG() && DATA.brief[e.id]);
  }
  var ALLCRIT = [];
  function critHue(c) { return Math.round((ALLCRIT.indexOf(c) + 0.5) * 360 / ALLCRIT.length); }
  function areaCls(a) { return 'c' + a._n; }
  function crumbArea(a) { return '<span><a href="#/a/' + a.id + '">' + esc(a.id + '. ' + a.name) + '</a></span>'; }
  function renderCrit(c, items, open) {
    var h = '<details class="area"' + (open || !state.folded || state.filter !== '전체' ? ' open' : '') + '><summary>' + caret() + '<span class="aid">' + esc(c.id) + '</span><span>' + esc(c.name) + '</span></summary><ul class="ind-list">';
    items.forEach(function (e) {
      var pk = postKeys(e);
      h += '<li><a class="ind" href="#/e/' + e.id + '">' +
        '<span class="iid">' + esc(e.id) + '</span>' +
        '<span class="iname">' + esc(e.q) + '</span>' +
        '<span class="ichips">' + typeChip(e.type) + (isPost(e) ? '<span class="chip">사후점검' + (pk.length ? ' ' + pk.join('·') : '') + '</span>' : '') + (DATA.brief[e.id] ? '<span class="chip score">' + Y + ' ' + esc(DATA.brief[e.id].kind) + '</span>' : '') + '</span>' +
        '</a></li>';
    });
    return h + '</ul></details>';
  }

  function viewHome() {
    setTitle(''); setTab('home');
    var types = ['전체', '정성', '정량', '사후점검', CHG()];
    var counts = {};
    types.forEach(function (t) { counts[t] = 0; });
    INDEX.forEach(function (e) { types.forEach(function (t) { var f = state.filter; state.filter = t; if (match(e)) counts[t]++; state.filter = f; }); });

    var h = '<section class="card summary">' +
      '<div class="muted">' + esc(DATA.meta.title) + ' · ' + esc(DATA.meta.cycle) + ' · ' + esc(DATA.meta.published) + ' 발간</div>' +
      '<div class="total"><b>5개 영역</b><span class="muted">평가준거 30개 · 평가요소 90개 · 판단항목 201개</span></div>' +
      '<div class="bar acc-bar" role="img" aria-label="평가영역별 평가요소 수">' + AREAS.map(function (a) { var n = a.criteria.reduce(function (s, c) { return s + c.elements.length; }, 0); return '<span class="' + areaCls(a) + '" style="width:' + (n * 100 / INDEX.length) + '%"></span>'; }).join('') + '</div>' +
      '<div class="legend">' + AREAS.map(function (a) { return '<span class="' + areaCls(a) + '"><i></i>' + esc(a.id + '. ' + a.name) + '</span>'; }).join('') + '</div>' +
      '</section>';
    h += cycleCard(false);

    h += '<div class="filters" role="group" aria-label="유형 필터">';
    types.forEach(function (t) {
      h += '<button class="filter" data-filter="' + t + '" aria-pressed="' + (state.filter === t) + '">' + t + ' ' + counts[t] + '</button>';
    });
    h += '</div>';
    h += '<div class="tree-tools"><button class="fold-all" data-fold-all type="button"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="fa-up" d="M7 9l5-5 5 5M7 15l5 5 5-5"/></svg><span>' + (state.folded ? '모두 펼치기' : '모두 접기') + '</span></button></div>';

    AREAS.forEach(function (a) {
      var body = '', n = 0;
      a.criteria.forEach(function (c) {
        var items = c.elements.filter(match);
        n += items.length;
        if (items.length) body += renderCrit(c, items);
      });
      if (!n) return;
      h += '<section class="card cat ' + areaCls(a) + '" id="area-' + a.id + '"><div class="cat-head"><div class="cat-badge">' + esc(a.id) + '</div><div><div class="meta">평가영역 · 준거 ' + a.criteria.length + '개</div><h2>' + esc(a.name) + '</h2></div><div class="pts">' + n + '<small>요소</small></div></div>' +
        '<div class="field">' + body + '</div></section>';
    });
    if (h.indexOf('class="card cat') < 0) h += '<p class="empty">해당 유형의 평가요소가 없습니다.</p>';
    $app.innerHTML = h; bindSlides($app);

    $app.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () { state.filter = b.getAttribute('data-filter'); viewHome(); });
    });
    var fa = $app.querySelector('[data-fold-all]');
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

  /* ---------- 우리 대학 평가주기 ---------- */
  var OUR_RENEW = 2028; /* 우리 대학 갱신평가(평가인증 심사) 연도 */
  function cycleSteps(y) {
    return [
      { y: (y - 1) + '.8~9', t: '평가인증 신청', d: '설명회 후 신청·접수' },
      { y: String(y), t: '갱신평가', d: '평가인증 심사 · 자료 ' + (y - 2) + '~' + (y - 1) + '학년도' },
      { y: (y + 1) + '~' + (y + 5), t: '인증기간 5년', d: '인증 판정 시' },
      { y: String(y + 3), t: '사후점검평가', d: '인증 3년차 · 자료 ' + y + '~' + (y + 2) + '학년도' },
      { y: String(y + 5), t: '다음 갱신평가', d: '다음 평가인증 심사' }
    ];
  }
  var CYCLE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>';
  function cycleCard(full) {
    var y = OUR_RENEW, folded = cycleFolded();
    var h = '<section class="card sec cycle' + (folded ? ' folded' : '') + '"><h3><button type="button" class="cycle-tg" aria-expanded="' + (folded ? 'false' : 'true') + '" aria-controls="cycleBody' + (full ? 'F' : 'H') + '">우리 대학 평가주기' + caret() + '</button><button type="button" class="sec-tool" data-slides="35" aria-haspopup="dialog">' + CYCLE_ICON + '설명회 35쪽</button></h3>';
    h += '<p class="cycle-sum muted">' + y + ' 갱신평가 · ' + (y + 3) + ' 사후점검평가 · ' + (y + 5) + ' 다음 갱신평가</p>';
    h += '<div class="cycle-body" id="cycleBody' + (full ? 'F' : 'H') + '"' + (folded ? ' hidden' : '') + '>';
    h += '<ol class="cycle-steps">' + cycleSteps(y).map(function (s, i) { return '<li' + (i === 1 ? ' class="now"' : '') + '><b>' + esc(s.y) + '</b><span>' + esc(s.t) + '</span><small>' + esc(s.d) + '</small></li>'; }).join('') + '</ol>';
    if (full) {
      h += '<div class="table-wrap"><table><thead><tr><th>구분</th><th>시기</th><th>심사대상 기간</th><th>점검 범위</th></tr></thead><tbody>' +
        '<tr><td>갱신평가(평가인증 심사)</td><td>' + y + '년 4월 서면·현장평가 (신청 ' + (y - 1) + '년 8~9월)</td><td>' + (y - 2) + '~' + (y - 1) + '학년도, ' + (y - 3) + '~' + (y - 2) + '회계연도</td><td>판단항목 201개 전체</td></tr>' +
        '<tr><td>사후점검평가</td><td>' + (y + 3) + '년 (인증 3년차)</td><td>' + y + '~' + (y + 2) + '학년도, ' + (y - 1) + '~' + (y + 1) + '회계연도</td><td>판단항목 102개(약 50%, ‘사후’ 표시)</td></tr>' +
        '<tr><td>다음 갱신평가</td><td>' + (y + 5) + '년</td><td>' + (y + 3) + '~' + (y + 4) + '학년도</td><td>그해 편람 기준</td></tr></tbody></table></div>' +
        '<ul class="dots" style="margin-top:10px;font-size:var(--fs-md);color:var(--text-2)"><li>인증을 받으면 인증기간은 5년이고, 3년차에 사후점검평가(인증 유지 여부), 5년차에 다음 평가인증 심사를 받습니다.</li><li>사후점검평가에서 ‘불만족’이거나 미참여하면 인증이 철회됩니다.</li><li>조건부인증·인증유예는 차년도 보완평가를 거쳐 인증기간이 4년이 됩니다.</li></ul>' +
        '<div class="callout">※ 시기는 설명회 35쪽 예시(2027 심사 → 2030 사후점검 → 2032 심사)를 우리 대학 갱신연도 ' + y + '년에 맞춰 계산한 것입니다. ' + y + '년 심사에는 ' + y + '년 편람이 적용되므로, 이 페이지(' + Y + ' 편람)와 기준이 다를 수 있습니다.</div>';
    } else {
      h += '<p class="muted" style="margin:8px 0 0">인증 5년 · 3년차 사후점검평가 · <a href="#/guide">자세히 보기</a></p>';
    }
    return h + '</div></section>';
  }
  /* 평가주기 카드 숨기기·펼치기 (localStorage acc-cycle-fold) */
  function cycleFolded() { try { return localStorage.getItem('acc-cycle-fold') === '1'; } catch (e) { return false; } }
  function bindSlides(root) {
    root.querySelectorAll('.cycle-tg').forEach(function (b) {
      b.addEventListener('click', function () {
        var sec = b.closest('.cycle'), open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        sec.classList.toggle('folded', !open);
        sec.querySelector('.cycle-body').hidden = !open;
        try { localStorage.setItem('acc-cycle-fold', open ? '0' : '1'); } catch (e) {}
      });
    });
    root.querySelectorAll('.cycle [data-slides]').forEach(function (b) {
      b.addEventListener('click', function () { openSlides(b.textContent.trim(), DATA.meta.briefing, b.getAttribute('data-slides').split(',').map(Number)); });
    });
  }

  /* ---------- 평가영역 화면 ---------- */
  function viewArea(id) {
    var a = AREAS.filter(function (x) { return x.id === id; })[0];
    if (!a) { viewHome(); return; }
    setTitle(a.id + '. ' + a.name); setTab('home');
    var ne = a.criteria.reduce(function (s, c) { return s + c.elements.length; }, 0);
    var h = '<div class="crumbs"><span><a href="#/">평가체계</a></span><span>' + esc(a.id + '. ' + a.name) + '</span></div>';
    h += '<section class="card field-hero ' + areaCls(a) + '"><div class="muted">평가영역 ' + esc(a.id) + ' · 평가준거 ' + a.criteria.length + '개 · 평가요소 ' + ne + '개</div><h2>' + esc(a.name) + '</h2>' + (a.desc ? '<p style="margin:8px 0 0;color:var(--text-2)">' + esc(a.desc) + '</p>' : '') + '</section>';
    h += '<div class="card" style="padding:4px 10px">' + a.criteria.map(function (c) { return renderCrit(c, c.elements, true); }).join('') + '</div>';
    var pos = AREAS.indexOf(a), prev = AREAS[pos - 1], next = AREAS[pos + 1];
    h += '<div class="pager">' +
      (prev ? '<a href="#/a/' + prev.id + '"><small>‹ 이전 영역</small>' + esc(prev.id + '. ' + prev.name) + '</a>' : '<span class="ghost"></span>') +
      (next ? '<a class="next" href="#/a/' + next.id + '"><small>다음 영역 ›</small>' + esc(next.id + '. ' + next.name) + '</a>' : '<span class="ghost"></span>') + '</div>';
    $app.innerHTML = h;
  }

  /* ---------- 평가준거 화면 ---------- */
  function viewCrit(id) {
    var c = CRIT[id];
    if (!c) { viewHome(); return; }
    setTitle(c.id + ' ' + c.name); setTab('home');
    var h = '<div class="crumbs">' + crumbArea(c._area) + '<span>' + esc(c.id + ' ' + c.name) + '</span></div>';
    h += '<section class="card field-hero ' + areaCls(c._area) + '"><div class="muted">평가준거 ' + esc(c.id) + ' · ' + c.elements.length + '개 평가요소 · 편람 ' + c.page + '쪽</div><h2>' + esc(c.name) + '</h2><p style="margin:8px 0 0;color:var(--text-2)">' + esc(c.desc) + '</p></section>';
    h += '<div class="card" style="padding:4px 10px">' + renderCrit(c, c.elements, true) + '</div>';
    h += '<p class="muted" style="margin:4px 4px 12px">평가준거 판정(평가요소 3개 결과로 P·CP·F)은 모든 준거에 같으므로 <a href="#/judge">판정 기준</a> 화면에 모아 두었습니다.</p>';
    var pos = ALLCRIT.indexOf(c), prev = ALLCRIT[pos - 1], next = ALLCRIT[pos + 1];
    h += '<div class="pager">' +
      (prev ? '<a href="#/c/' + prev.id + '"><small>‹ 이전 준거</small>' + esc(prev.id + ' ' + prev.name) + '</a>' : '<span class="ghost"></span>') +
      (next ? '<a class="next" href="#/c/' + next.id + '"><small>다음 준거 ›</small>' + esc(next.id + ' ' + next.name) + '</a>' : '<span class="ghost"></span>') + '</div>';
    $app.innerHTML = h;
  }
  function critJudgeTable() {
    return '<div class="table-wrap"><table><thead><tr><th>준거 판정</th><th>평가요소(3개) 판정 결과</th></tr></thead><tbody>' +
      '<tr><td>' + judgeChip('충족(P)') + '</td><td>3개 평가요소가 모두 충족(P)</td></tr>' +
      '<tr><td>' + judgeChip('조건부충족(CP)') + '</td><td>1~2개 평가요소가 조건부충족(CP)</td></tr>' +
      '<tr><td>' + judgeChip('미충족(F)') + '</td><td>3개 평가요소가 모두 조건부충족(CP), 또는 1개 이상 미충족(F)</td></tr></tbody></table></div>';
  }
  function elemJudgeTable() {
    return '<div class="table-wrap"><table><thead><tr><th>요소 판정</th><th>판단항목(a, b, c …) 결과</th></tr></thead><tbody>' +
      '<tr><td>' + judgeChip('충족(P)') + '</td><td>판단항목 모두가 기대 및 요구수준을 만족</td></tr>' +
      '<tr><td>' + judgeChip('조건부충족(CP)') + '</td><td>일부 충족 또는 보완이 요구됨</td></tr>' +
      '<tr><td>' + judgeChip('미충족(F)') + '</td><td>모두 충족하지 않거나 전반적인 보완이 요구됨</td></tr></tbody></table></div>' +
      '<div class="callout">※ 판단항목 일부가 충족하더라도 평가요소의 취지나 교육의 질에 중대한 영향을 준다고 판단되면 미충족(F)으로 판정할 수 있습니다(4주기 예외 적용).</div>';
  }

  /* ---------- 사이드바 ---------- */
  var $side = document.getElementById('sidebar');
  var $scrim = document.getElementById('scrim');
  var $menu = document.getElementById('menuBtn');
  function renderSidebar() {
    var h = '<div class="side-head"><b>편람 목차</b><div class="side-tools"><button type="button" class="side-tool side-tool-ic" data-all="open" aria-label="모두 펼치기" title="모두 펼치기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg></button><button type="button" class="side-tool side-tool-ic" data-all="close" aria-label="모두 접기" title="모두 접기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20l5-5 5 5M7 4l5 5 5-5"/></svg></button></div></div><nav class="side-nav" aria-label="평가영역·준거·요소">';
    h += '<a class="side-link side-all" href="#/" data-key="home">평가체계 <span>5개 영역</span></a>';
    h += '<ul class="tree">';
    AREAS.forEach(function (a) {
      var ne = a.criteria.reduce(function (s, c) { return s + c.elements.length; }, 0);
      h += '<li class="t1 ' + areaCls(a) + '" data-node="a' + a.id + '"><button class="tg" type="button" aria-label="접기/펼치기" aria-expanded="true">' + caret() + '</button><a class="t1-link" href="#/a/' + a.id + '" data-key="a' + a.id + '"><i>' + esc(a.id) + '</i><span class="tn">' + esc(a.name) + '</span><span class="tp">' + ne + '요소</span></a><ul>';
      a.criteria.forEach(function (c) {
        h += '<li class="t2" data-node="' + c.id + '"><button class="tg" type="button" aria-label="접기/펼치기" aria-expanded="true">' + caret() + '</button><a class="t2-link" href="#/c/' + c.id + '" data-key="c' + c.id + '"><em>' + esc(c.id) + '</em><span class="tn">' + esc(c.name) + '</span></a><ul>';
        c.elements.forEach(function (e) {
          h += '<li class="t4"><a class="t4-link" href="#/e/' + e.id + '" data-key="e' + e.id + '"><em>' + esc(e.id) + '</em><span class="tn">' + esc(short(e)) + '</span><span class="tp">' + (e.type === '정량' ? '정량' : '') + '</span></a></li>';
        });
        h += '</ul></li>';
      });
      h += '</ul></li>';
    });
    h += '</ul>';
    h += '</nav><div class="side-extra">' +
      '<a class="side-link" href="#/guide" data-key="guide"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg><b>평가 안내 · 일정</b></a>' +
      '<a class="side-link" href="#/judge" data-key="judge"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/></svg><b>판정 기준</b></a>' +
      '<a class="side-link" href="#/changes" data-key="changes"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h11M4 12h7M4 17h11"/><path d="M17 10l3 3-3 3"/></svg><b>' + Y + ' 주요 변경</b></a>' +
      '<a class="side-link" href="#/qa" data-key="qa"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.5M12 16.5h.01"/></svg><b>백문백답</b></a>' +
      '<a class="side-link" href="#/refs" data-key="refs"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><rect x="9" y="12" width="6" height="5" rx="1"/><path d="M10.5 12v-1a1.5 1.5 0 0 1 3 0v1"/></svg><b>참고자료</b></a>' +
      '<a class="side-link" href="#/search" data-key="search"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><b>검색</b></a></div>';
    $side.innerHTML = '<div class="sidebar-inner">' + h + '</div>';
    var collapsed = {};
    AREAS.forEach(function (a, i) { if (i) collapsed['a' + a.id] = 1; });
    try { var st = localStorage.getItem('acc-toc5'); if (st) collapsed = JSON.parse(st) || collapsed; } catch (e) {}
    function save() { try { localStorage.setItem('acc-toc5', JSON.stringify(collapsed)); } catch (e) {} }
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
      var tg = e.target.closest('.tg');
      if (tg) { var li = tg.closest('[data-node]'); setNode(li, li.classList.contains('collapsed')); save(); return; }
      var all = e.target.closest('[data-all]');
      if (all) { var open = all.getAttribute('data-all') === 'open'; $side.querySelectorAll('[data-node]').forEach(function (li) { setNode(li, open); }); save(); return; }
      if (e.target.closest('a')) closeSide();
    });
  }
  var expandTo = function () {};
  function markSidebar(path) {
    var keys = [];
    if (path.indexOf('/e/') === 0) { var e = BY_ID[path.slice(3)]; if (e) { keys = ['e' + e.id, 'c' + e._crit.id, 'a' + e._area.id]; expandTo(['a' + e._area.id, e._crit.id]); } }
    else if (path.indexOf('/c/') === 0) { var cc = CRIT[path.slice(3)]; if (cc) { keys = ['c' + cc.id, 'a' + cc._area.id]; expandTo(['a' + cc._area.id]); } }
    else if (path.indexOf('/a/') === 0) { keys = ['a' + path.slice(3)]; }
    else if (path === '/guide' || path === '/judge' || path === '/changes' || path === '/search' || path === '/qa' || path === '/refs') keys = [path.slice(1)];
    else keys = ['home'];
    $side.querySelectorAll('[data-key]').forEach(function (a) {
      var on = keys.indexOf(a.getAttribute('data-key')) >= 0;
      a.classList.toggle('on', on);
      if (on && keys[0] === a.getAttribute('data-key')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var cur = $side.querySelector('[aria-current="page"]'), nav = [$side.querySelector('.sidebar-inner'), $side].filter(function (x) { return x && x.scrollHeight > x.clientHeight + 1; })[0];
    if (cur && nav && keys[0] !== 'home') {
      var nr = nav.getBoundingClientRect(), cr = cur.getBoundingClientRect();
      if (cr.top < nr.top || cr.bottom > nr.bottom) nav.scrollTop += cr.top - nr.top - nr.height / 3;
    }
  }
  function openSide() { document.body.classList.add('side-open'); $menu.setAttribute('aria-expanded', 'true'); }
  function closeSide() { document.body.classList.remove('side-open'); $menu.setAttribute('aria-expanded', 'false'); }
  var $sBtn = document.getElementById('settingsBtn');
  var $sPanel = document.getElementById('settingsPanel');
  function setSettings(open) { $sPanel.hidden = !open; $sBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  $sBtn.addEventListener('click', function (e) { e.stopPropagation(); setSettings($sPanel.hidden); });
  document.addEventListener('click', function (e) { if (!$sPanel.hidden && !$sPanel.contains(e.target)) setSettings(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setSettings(false); });

  /* ---------- 문서 쪽 이미지 팝업 (설명회 슬라이드) ---------- */
  var $doc = document.getElementById('docModal');
  var docLast = null;
  function closeDoc() { if ($doc.hidden) return; $doc.hidden = true; document.body.classList.remove('modal-open'); if (docLast) docLast.focus(); }
  function openDoc(title, sub, imgs, pdf, lead) {
    docLast = document.activeElement; setSettings(false);
    document.getElementById('docTitle').innerHTML = esc(title) + (sub ? ' <small>' + esc(sub) + '</small>' : '');
    var $pdf = document.getElementById('docPdf');
    $pdf.hidden = !pdf; if (pdf) $pdf.href = pdf;
    document.getElementById('docBody').innerHTML = (lead ? '<div class="doc-lead">' + lead + '</div>' : '') + imgs.map(function (m) {
      return '<figure class="doc-page"><img src="' + esc(m.src) + '" alt="' + esc(m.alt) + '" loading="lazy">' + (m.cap ? '<figcaption>' + esc(m.cap) + '</figcaption>' : '') + '</figure>';
    }).join('');
    resetZoom();
    document.getElementById('docBody').scrollTop = 0; document.getElementById('docBody').scrollLeft = 0;
    $doc.hidden = false; document.body.classList.add('modal-open');
    $doc.querySelector('.modal-close').focus();
  }
  function openSlides(title, sub, nums, lead) {
    openDoc(title, sub, nums.map(function (n) {
      return { src: slideSrc(n), alt: '설명회 자료 ' + n + '쪽: ' + slideTitle(n), cap: '설명회 자료 ' + n + '쪽 · ' + slideTitle(n) };
    }), '', lead);
  }
  $doc.addEventListener('click', function (e) { if (e.target === $doc || e.target.closest('.modal-close')) closeDoc(); });
  /* 팝업 확대·축소 (두 손가락 핀치, 두 번 탭, ± 버튼, PC는 Ctrl+휠) */
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
        if (now - lastTap < 300) {
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
    function () { return window.innerWidth < 600 ? 1.5 : 1; },
    function (z) { $docBody.style.setProperty('--zoom', z); },
    function () { var f = $docBody.querySelector('.doc-page'); return f ? f.offsetTop : 0; });
  function resetZoom() { docZoom.reset(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDoc(); });
  window.addEventListener('hashchange', closeDoc);
  document.getElementById('judgeOpen').addEventListener('click', function (e) { e.stopPropagation(); openSlides('판정기준 및 체계', DATA.meta.briefing, [31, 32]); });
  document.getElementById('slidesOpen').addEventListener('click', function (e) { e.stopPropagation(); openSlides('정량지표 12개', DATA.meta.briefing, [43]); });

  $menu.addEventListener('click', function () { document.body.classList.contains('side-open') ? closeSide() : openSide(); });
  $scrim.addEventListener('click', closeSide);
  // 휴대폰: 왼쪽 가장자리에서 오른쪽으로 밀면 목차 열기, 열린 목차를 왼쪽으로 밀면 닫기
  (function () {
    var sx = 0, sy = 0, mode = '';
    document.addEventListener('touchstart', function (e) {
      if (window.innerWidth >= 1000 || e.touches.length !== 1) { mode = ''; return; }
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      var open = document.body.classList.contains('side-open');
      mode = open ? 'close' : (sx <= 32 && $doc.hidden && $sPanel.hidden ? 'open' : '');
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

  /* ---------- 주요 확인 및 유의사항 그리기 ---------- */
  function lines(s) { return String(s).split('\n').map(esc).join('<br>'); }
  // ㅇ(1단) → -(2단) → ※(참고) 를 겹친 목록으로
  function renderNotes(blocks) {
    var h = '', open1 = false, open2 = false;
    function close2() { if (open2) { h += '</ul>'; open2 = false; } }
    function close1() { close2(); if (open1) { h += '</li></ul>'; open1 = false; } }
    function sub(html) { if (!open1) { h += '<ul class="dots"><li style="list-style:none;margin-left:-18px">'; open1 = true; } if (!open2) { h += '<ul class="dots">'; open2 = true; } h += html; }
    blocks.forEach(function (b) {
      if (b.t === 'p') {
        if (b.lv === 1) { close1(); h += '<ul class="dots"><li>' + esc(b.x); open1 = true; }
        else if (b.lv === 2) sub('<li>' + esc(b.x) + '</li>');
        else if (b.lv === 'note') sub('<li class="note">※ ' + esc(b.x) + '</li>');
        else if (b.lv === 'def') sub('<li class="note">☞ ' + esc(b.x) + '</li>');
        else { close1(); h += '<p style="margin:6px 0">' + esc(b.x) + '</p>'; }
        return;
      }
      close1();
      if (b.t === 'box') {
        h += '<div class="callout"><b>★ ' + esc(b.title) + '</b><ul class="dots">' + b.items.map(function (it) {
          return '<li' + (it.lv === 'note' ? ' class="note"' : '') + '>' + (it.lv === 'note' ? '※ ' : '') + esc(it.x) + '</li>';
        }).join('') + '</ul></div>';
      } else if (b.t === 'table') {
        h += '<h4>★ ' + esc(b.title) + '</h4><div class="table-wrap"><table><thead><tr>' + b.head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          b.rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i === 0 ? ' style="white-space:nowrap;font-weight:700"' : '') + '>' + (b.head[i] === '판단' ? judgeChip(c) : lines(c)) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table></div>' + (b.foot ? '<span class="muted">※ ' + esc(b.foot) + '</span>' : '');
      }
      // terms(용어 해설)는 구역 제목의 "용어 해설" 버튼 팝업으로
    });
    close1();
    return h;
  }

  /* ---------- 백문백답 (2026 컨설팅 자료집) ---------- */
  var QA_NOTE = '';
  function makeQaNote() {
    var q = HB.qaYear || Y;
    QA_NOTE = q + '년 심사(자료범위 ' + (q - 2) + '~' + (q - 1) + '학년도) 기준 답변입니다.' +
      (q < Y ? ' ' + Y + '년 심사는 자료범위가 ' + (Y - 2) + '~' + (Y - 1) + '학년도로 ' + (Y - q) + '년씩 늦춰지고, ' + Y + ' 편람에서 바뀐 기준이 있으면 편람이 우선합니다.' : '');
  }
  function qaAnswer(a) {
    var h = '', open1 = false, open2 = false, ex = [];
    function flushEx() { if (ex.length) { closeAll(); h += '<div class="callout"><b>작성 예시</b>' + ex.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join('') + '</div>'; ex = []; } }
    function close2() { if (open2) { h += '</ul>'; open2 = false; } }
    function closeAll() { close2(); if (open1) { h += '</li></ul>'; open1 = false; } }
    a.forEach(function (l) {
      if (l.lv === 'ex') { ex.push(l.x); return; }
      flushEx();
      if (l.lv === 1) { closeAll(); h += '<ul class="dots"><li>' + esc(l.x); open1 = true; return; }
      if (!open1) { h += '<ul class="dots"><li style="list-style:none;margin-left:-18px">'; open1 = true; }
      if (!open2) { h += '<ul class="dots">'; open2 = true; }
      h += l.lv === 'note' ? '<li class="note">※ ' + esc(l.x) + '</li>' : '<li>' + esc(l.x) + '</li>';
    });
    flushEx(); closeAll();
    return h;
  }
  function qaItem(q, open) {
    return '<details class="fold qa" id="qa-' + q.id.slice(2) + '"' + (open ? ' open' : '') + '><summary><span class="chip score">' + esc(q.id) + '</span><span class="qa-q">' + esc(q.q) + '</span>' + caret() + '</summary>' +
      '<div class="qa-body">' + qaAnswer(q.a) + '<div class="qa-foot">' +
      q.els.map(function (id) { return BY_ID[id] ? '<a class="chip" href="#/e/' + id + '">평가요소 ' + esc(id) + '</a>' : ''; }).join('') +
      '<span class="muted">' + esc(QA.meta.short) + ' ' + q.page + '쪽</span>' +
      '<button type="button" class="sec-tool" data-qa-page="' + esc(q.id) + '" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>원문 쪽</button></div></div></details>';
  }
  function bindQA(root) {
    root.querySelectorAll('[data-qa-page]').forEach(function (b) {
      b.addEventListener('click', function () {
        var q = QA.items.filter(function (x) { return x.id === b.getAttribute('data-qa-page'); })[0];
        openDoc(q.id + ' 원문', QA.meta.short + ' ' + q.page + '쪽', [{ src: img((HB.qaDocs || 'docs/qa/') + 'p' + (q.pdf < 10 ? '0' : '') + q.pdf + '.jpg'), alt: QA.meta.title + ' ' + q.page + '쪽', cap: QA.meta.title + ' ' + q.page + '쪽 (' + QA.meta.published + ')' }], '');
      });
    });
  }
  function viewQA(params) {
    setTitle('백문백답'); setTab('qa');
    if (!QA) { $app.innerHTML = '<p class="empty">백문백답 자료를 불러오지 못했습니다.</p>'; return; }
    var cat = params.c || '전체', want = params.id || '';
    var h = '<section class="card summary"><div class="muted">' + esc(QA.meta.title) + ' · ' + esc(QA.meta.publisher) + ' · ' + esc(QA.meta.published) + '</div>' +
      '<div class="total"><b>질문 ' + QA.items.length + '개</b><span class="muted">질문을 누르면 답변이 펼쳐집니다</span></div>' +
      '<div class="callout warn" style="margin-top:10px">※ ' + esc(QA_NOTE) + '</div></section>';
    h += '<div class="filters" role="group" aria-label="분류">' + ['전체'].concat(QA.cats).map(function (c) {
      var n = c === '전체' ? QA.items.length : QA.items.filter(function (q) { return q.cat === c; }).length;
      return '<button class="filter" data-c="' + esc(c) + '" aria-pressed="' + (c === cat) + '">' + esc(c.replace(/^영역 (\d)\. .*/, '영역 $1')) + ' ' + n + '</button>';
    }).join('') + '</div>';
    QA.cats.forEach(function (c) {
      if (cat !== '전체' && cat !== c) return;
      var items = QA.items.filter(function (q) { return q.cat === c; });
      h += '<h3 class="section-title">' + esc(c) + ' <span class="muted" style="font-weight:600">' + items.length + '</span></h3><section class="card" style="padding:4px 10px 12px">' +
        items.map(function (q) { return qaItem(q, q.id === want); }).join('') + '</section>';
    });
    $app.innerHTML = h;
    $app.querySelectorAll('[data-c]').forEach(function (b) {
      b.addEventListener('click', function () { var c = b.getAttribute('data-c'); location.hash = '#/qa' + (c === '전체' ? '' : '?c=' + encodeURIComponent(c)); });
    });
    bindQA($app);
    if (want) setTimeout(function () { var t = document.getElementById('qa-' + want.slice(2)); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 70 }); }, 30);
  }

  /* ---------- 평가요소 상세 ---------- */
  function viewElement(id) {
    var e = BY_ID[id];
    if (!e) { $app.innerHTML = '<p class="empty">평가요소를 찾을 수 없습니다.</p>'; return; }
    var c = e._crit, br = DATA.brief[id], forms = formsOf(e), calc = calcOf(e), pk = postKeys(e);
    setTitle(e.id + ' ' + short(e)); setTab('home');

    var secs = [];
    var h = '<div class="crumbs" id="detailTop">' + crumbArea(e._area) + '<span><a href="#/c/' + c.id + '">' + esc(c.id + ' ' + c.name) + '</a></span></div>';
    h += '<section class="card detail-head"><div class="iid">평가요소 ' + esc(e.id) + '</div><h2>' + esc(e.q) + '</h2><div class="chips">' + typeChip(e.type) +
      (pk.length ? '<span class="chip">사후점검 ' + pk.join('·') + '</span>' : '') + (e.quant && e.quant.tags.indexOf('사후') >= 0 ? '<span class="chip">사후점검</span>' : '') +
      (e.quant && e.quant.tags.indexOf('모니터링') >= 0 ? '<span class="chip">사후 모니터링</span>' : '') +
      (br ? '<span class="chip score">' + Y + ' ' + esc(br.kind) + '</span>' : '') + '<span class="chip">편람 ' + e.page + '쪽</span></div></section>';

    var body = '';
    function sec(key, title, html, tool) { secs.push([key, title]); body += '<section class="card sec" id="s-' + key + '"><h3>' + esc(title) + (tool || '') + '</h3>' + html + '</section>'; }
    var icBook = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>';
    var icTable = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/></svg>';

    // 1. 판단항목
    var it = '';
    if (e.quant) {
      it += '<p class="muted" style="margin-top:-4px">판단항목: ' + esc(e.quant.name) + ' (' + e.quant.tags.map(esc).join(' · ') + ')</p>';
      it += '<div class="table-wrap"><table class="vert-scale"><thead><tr><th>판정</th><th>기준</th></tr></thead><tbody>' + e.quant.crit.map(function (t) {
        var m = t.match(/^(충족|조건부충족|미충족)\s*:\s*(.*)$/);
        var lab = m ? { '충족': '충족(P)', '조건부충족': '조건부충족(CP)', '미충족': '미충족(F)' }[m[1]] : '';
        return '<tr><td>' + judgeChip(lab) + '</td><td>' + esc(m ? m[2] : t) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
      if (calc) {
        it += '<h4>산출식</h4><div class="formula">' + esc(calc.formula[0]) + ' = ' + esc(calc.formula[1]) + ' ÷ ' + esc(calc.formula[2]) + (/%/.test(calc.formula[0]) ? ' × 100' : '') + '</div>';
        if (calc.notes && calc.notes.length) it += '<ul class="dots" style="font-size:var(--fs-md);color:var(--text-2)">' + calc.notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      }
    } else {
      it += '<ul class="el-list abc">' + e.items.map(function (x) {
        return '<li class="el-item"><span class="t">' + esc(x.x) + '</span>' + (x.tags.indexOf('사후') >= 0 ? '<span class="ev" title="사후점검평가 점검항목">사후</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    sec('it', '판단항목', it, '<button type="button" class="sec-tool" data-judge aria-haspopup="dialog">' + icTable + '판정 기준</button>');

    // 2. 평가활용 참고자료
    var rf = '<p class="muted" style="margin-top:-4px">자료 예시이며 모두 갖출 필요는 없습니다. 실제 운영 현황을 보여 주는 다른 자료로 대체할 수 있습니다.</p><ul class="plain">' +
      e.refs.map(function (r, i) {
        return '<li><b style="color:var(--primary);margin-right:6px">' + (i + 1) + '.</b>' + esc(r.x) + (r.sub.length ? '<ul class="dots" style="margin-top:4px;font-size:var(--fs-md);color:var(--text-2)">' + r.sub.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') + '</li>';
      }).join('') + '</ul>';
    sec('rf', '평가활용 참고자료', rf);

    // 3. 주요 확인 및 유의사항
    var terms = e.notes.filter(function (b) { return b.t === 'terms'; });
    var termBtn = terms.length ? '<button type="button" class="sec-tool" data-terms aria-haspopup="dialog">' + icBook + '용어 해설</button>' : '';
    sec('nt', '주요 확인 및 유의사항', renderNotes(e.notes.filter(function (b) { return ['form', 'forms', 'calc'].indexOf(b.t) < 0; })) || '<p class="muted">-</p>', termBtn);

    // 4. 작성양식
    if (forms.length) {
      sec('fm', '작성양식', '<p class="muted" style="margin-top:-4px">항목을 누르면 작성 내용 안내가 팝업으로 열립니다. 표 원문은 편람 쪽수를 확인하세요.</p>' +
        forms.map(function (f, fi) {
          return '<button type="button" class="form form-btn" data-form="' + fi + '" aria-haspopup="dialog"><span class="lbl 표">표</span><span class="ttl">' + esc(f.title) + '<small>편람 ' + esc(f.page) + '쪽</small></span>' +
            '<svg class="pdf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg></button>';
        }).join(''));
    }

    // 5. 설명회 해설 (편람 원문과 구분)
    if (br) {
      sec('br', '설명회 해설', '<p class="muted" style="margin-top:-4px">' + esc(DATA.meta.briefing) + '에서 안내한 내용을 요약했습니다. 편람 원문이 아닙니다. 항목을 누르면 설명회 자료 쪽이 팝업으로 열립니다.</p>' +
        br.pts.map(function (p, pi) {
          return '<button type="button" class="form form-btn ch-btn" data-br="' + pi + '" aria-haspopup="dialog"><span class="lbl 변경">' + esc(br.kind.split('·')[0]) + '</span><span class="ttl">' + p + '</span>' +
            '<svg class="pdf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h11M4 12h7M4 17h11"/><path d="M17 10l3 3-3 3"/></svg></button>';
        }).join('') + '<p class="muted" style="margin:6px 0 0">설명회 자료 ' + br.slides.join(', ') + '쪽</p>');
    }

    // 6. 판정
    var jd = '';
    if (e.quant) {
      jd += '<p style="margin:0">정량 평가요소는 판단항목의 기준값으로 판정합니다.</p>';
      if (['1.3.3', '1.6.3', '2.2.2'].indexOf(e.id) >= 0) jd += '<div class="callout">※ 상향된 정량 기준 경과 조치: 3주기 기준은 충족하나 4주기 기준 미만이면 충족(개선권고)으로 판정합니다(설명회 자료 22쪽).</div>';
    } else {
      jd += '<details class="calc" data-calc><summary><svg class="calc-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><h4>판단항목별로 골라 보기</h4><span class="calc-hint">판정 연습</span>' + caret() + '</summary><div class="calc-body"><div class="muted">판단항목마다 기대·요구수준을 만족했는지 고르면 예상 요소 판정을 보여 줍니다. (연습용 · 이 기기에만 저장)</div>' +
        e.items.map(function (x) {
          return '<div class="judge-row"><span><b>' + x.k + ')</b> ' + esc(x.x) + '</span><span class="filters" role="group" aria-label="' + x.k + ') 판단"><button type="button" class="filter" data-k="' + x.k + '" data-v="y" aria-pressed="false">충족</button><button type="button" class="filter" data-k="' + x.k + '" data-v="n" aria-pressed="false">미흡</button></span></div>';
        }).join('') + '<div class="out" data-out></div></div></details>';
    }
    jd += '<p class="muted" style="margin:8px 0 0">P·CP·F 판정 기준은 모든 요소에 같으므로 <a href="#/judge">판정 기준</a> 화면에 모아 두었습니다.</p>';
    sec('jd', e.quant ? '판정' : '판정 연습', jd);

    // 7. 관련 질문 (백문백답)
    var rq = QA_BY_EL[id] || [];
    if (rq.length) sec('qa', '관련 질문', '<p class="muted" style="margin-top:-4px">' + esc(QA.meta.title) + '에서 이 평가요소와 관련된 질문입니다. ' + esc(QA_NOTE) + '</p>' + rq.map(function (q) { return qaItem(q, false); }).join(''));

    h += '<nav class="toc" aria-label="평가요소 내 이동">' + secs.map(function (s) { return '<a href="#s-' + s[0] + '" data-sec="' + s[0] + '">' + esc(s[1]) + '</a>'; }).join('') + '</nav>';
    h += body;
    var pos = INDEX.indexOf(e), prev = INDEX[pos - 1], next = INDEX[pos + 1];
    h += '<div class="pager">' +
      (prev ? '<a href="#/e/' + prev.id + '"><small>‹ 이전 요소</small>' + esc(prev.id + ' ' + short(prev)) + '</a>' : '<span class="ghost"></span>') +
      (next ? '<a class="next" href="#/e/' + next.id + '"><small>다음 요소 ›</small>' + esc(next.id + ' ' + short(next)) + '</a>' : '<span class="ghost"></span>') +
      '</div>';
    $app.innerHTML = h;

    $app.querySelectorAll('.toc a').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        setTocOn(a);
        spyLock = Date.now() + 1200;
        var t = document.getElementById('s-' + a.getAttribute('data-sec'));
        if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' });
      });
    });
    var jb = $app.querySelector('[data-judge]');
    if (jb) jb.addEventListener('click', function () { openInfo('평가요소 판정 기준', e.id, elemJudgeTable() + '<h4>평가준거 판정</h4>' + critJudgeTable(), true); });
    var tb = $app.querySelector('[data-terms]');
    if (tb) tb.addEventListener('click', function () {
      openInfo('용어 해설', e.id + ' ' + short(e), '<ul class="dots">' + terms.map(function (t) { return t.items.map(function (x) { return '<li>' + esc(x.x) + '</li>'; }).join(''); }).join('') + '</ul>');
    });
    $app.querySelectorAll('[data-form]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = forms[+b.getAttribute('data-form')];
        openInfo('작성양식', e.id + ' ' + short(e), '<p style="margin:0 0 6px"><b>' + esc(f.title) + '</b></p>' + (f.desc ? '<p style="margin:0">' + esc(f.desc) + '</p>' : '') + '<div class="callout">※ 표 원문은 편람 ' + esc(f.page) + '쪽에 있습니다.</div>');
      });
    });
    $app.querySelectorAll('[data-br]').forEach(function (b) {
      b.addEventListener('click', function () {
        var bi = +b.getAttribute('data-br');
        var lead = '<b class="doc-lead-t">설명회 해설 요약</b><ul class="dots">' + br.pts.map(function (p, i) { return '<li' + (i === bi ? ' class="hl"' : '') + '>' + p + '</li>'; }).join('') + '</ul>';
        openSlides('설명회 해설', e.id + ' ' + short(e), br.slides, lead);
      });
    });
    bindQA($app);
    var box = $app.querySelector('[data-calc]');
    if (box) bindJudge(box, e);
    setupScrollSpy();
  }
  function bindJudge(box, e) {
    var key = 'acc-judge-' + e.id, st = {};
    try { st = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (er) {}
    var out = box.querySelector('[data-out]');
    function draw() {
      box.querySelectorAll('[data-k]').forEach(function (b) { b.setAttribute('aria-pressed', st[b.getAttribute('data-k')] === b.getAttribute('data-v') ? 'true' : 'false'); });
      var ks = e.items.map(function (x) { return x.k; });
      var done = ks.filter(function (k) { return st[k]; }).length, ys = ks.filter(function (k) { return st[k] === 'y'; }).length;
      var v;
      if (done < ks.length) v = '<span class="muted">' + ks.length + '개 중 ' + done + '개 선택</span>';
      else if (ys === ks.length) v = judgeChip('충족(P)') + ' 판단항목 모두 기대·요구수준 만족';
      else if (ys === 0) v = judgeChip('미충족(F)') + ' 모두 충족하지 않거나 전반적인 보완 필요';
      else v = judgeChip('조건부충족(CP)') + ' 일부 충족 또는 보완 필요';
      out.innerHTML = '<div class="row"><span>예상 요소 판정</span><span>' + v + '</span></div>';
    }
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-k]'); if (!b) return;
      var k = b.getAttribute('data-k'), val = b.getAttribute('data-v');
      if (st[k] === val) delete st[k]; else st[k] = val;
      try { localStorage.setItem(key, JSON.stringify(st)); } catch (er) {}
      draw();
    });
    draw();
  }

  /* ---------- 공용 팝업 (판정 기준·용어 해설·작성양식) ---------- */
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

  /* 화면 바탕: 자동(기기 설정) · 흰 바탕 · 검은 바탕 (전공심화 편람과 같은 jsh-theme 저장값 공유) */
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

  /* ---------- 검색 ---------- */
  function searchDocs() {
    var list = [];
    INDEX.forEach(function (e) {
      list.push({ e: e, where: '평가요소', text: e.q });
      e.items.forEach(function (x) { list.push({ e: e, where: '판단항목 ' + x.k + ')', text: x.x }); });
      if (e.quant) e.quant.crit.forEach(function (x) { list.push({ e: e, where: '판단기준', text: x }); });
      e.refs.forEach(function (r) { list.push({ e: e, where: '평가활용 참고자료', text: r.x + ' ' + r.sub.join(' ') }); });
      (function walk(arr) {
        arr.forEach(function (b) {
          if (b.x) list.push({ e: e, where: b.t === 'terms' ? '용어 해설' : '주요 확인 및 유의사항', text: b.x });
          if (b.items) b.items.forEach(function (x) { list.push({ e: e, where: b.t === 'terms' ? '용어 해설' : '주요 확인 및 유의사항', text: x.x || x.title || '' }); });
          if (b.t === 'table') b.rows.forEach(function (r) { list.push({ e: e, where: b.title, text: r.join(' ') }); });
          if (b.t === 'form') list.push({ e: e, where: '작성양식', text: b.title + ' ' + b.desc });
        });
      })(e.notes);
      if (DATA.brief[e.id]) DATA.brief[e.id].pts.forEach(function (p) { list.push({ e: e, where: '설명회 해설', text: p.replace(/<[^>]+>/g, '') }); });
    });
    if (QA) QA.items.forEach(function (q) { list.push({ qa: q, where: '질문', text: q.q }); q.a.forEach(function (l) { list.push({ qa: q, where: '답변', text: l.x }); }); });
    return list;
  }
  function highlight(t, q) {
    var h = esc(t);
    q.split(/\s+/).filter(Boolean).forEach(function (w) {
      h = h.replace(new RegExp(esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
    });
    return h;
  }
  function snippet(t, q) {
    var i = t.toLowerCase().indexOf(q.toLowerCase().split(/\s+/)[0]);
    if (i < 0 || t.length < 90) return t;
    var s = Math.max(0, i - 30);
    return (s ? '…' : '') + t.slice(s, s + 110) + (s + 110 < t.length ? '…' : '');
  }
  function viewSearch(q) {
    setTitle('검색'); setTab('search');
    if (!DOCS) DOCS = searchDocs();
    state.query = q || '';
    var sugg = ['대학평의원회', '의견수렴', '이월금', '감사', '자체평가', '교육만족도', '취업률', 'ALO', '현장비치', '불인정'];
    $app.innerHTML = '<div class="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '<input id="q" type="search" enterkeyhint="search" placeholder="예: 대학평의원회, 이월금, 불인정" value="' + esc(state.query) + '" autocomplete="off">' +
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
    var q2 = q;
    var $r = document.getElementById('results');
    if (!q) { $r.innerHTML = '<p class="empty">검색어를 입력하거나 위 추천어를 눌러 보세요.</p>'; return; }
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var groups = {}, order = [];
    DOCS.forEach(function (d) {
      var t = d.text.toLowerCase();
      if (terms.every(function (x) { return t.indexOf(x) >= 0; })) {
        var k = d.qa ? d.qa.id : d.e.id;
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(d);
      }
    });
    if (!order.length) { $r.innerHTML = '<p class="empty">"' + esc(q) + '"에 대한 결과가 없습니다.</p>'; return; }
    var total = order.reduce(function (n, id) { return n + groups[id].length; }, 0);
    var qaIds = order.filter(function (id) { return id.indexOf('Q.') === 0; });
    order = order.filter(function (id) { return id.indexOf('Q.') !== 0; });
    var h = '<p class="muted" style="margin:4px 4px 10px">평가요소 ' + order.length + '개 · 백문백답 ' + qaIds.length + '개에서 ' + total + '건</p>';
    order.forEach(function (id) {
      var e = BY_ID[id], hits = groups[id];
      h += '<a class="card result" href="#/e/' + id + '"><div style="display:flex;gap:8px;align-items:center"><span class="chip score">' + esc(id) + '</span><b style="flex:1">' + highlight(short(e), q) + '</b>' + typeChip(e.type) + '</div>';
      hits.slice(0, 3).forEach(function (d) {
        h += '<div class="where">' + esc(d.where) + '</div><div class="snip">' + highlight(snippet(d.text, q), q) + '</div>';
      });
      if (hits.length > 3) h += '<div class="where">외 ' + (hits.length - 3) + '건 더 있음</div>';
      h += '</a>';
    });
    if (qaIds.length) h += '<h3 class="section-title">백문백답 <span class="muted" style="font-weight:600">' + esc(QA.meta.short) + '</span></h3>';
    qaIds.forEach(function (id) {
      var q = groups[id][0].qa, hits = groups[id];
      h += '<a class="card result" href="#/qa?id=' + id + '"><div style="display:flex;gap:8px;align-items:center"><span class="chip score">' + esc(id) + '</span><b style="flex:1">' + highlight(q.q, q2) + '</b><span class="chip">' + esc(q.cat.replace(/^영역 (\d)\. .*/, '영역 $1')) + '</span></div>';
      hits.filter(function (d) { return d.where === '답변'; }).slice(0, 2).forEach(function (d) { h += '<div class="where">답변 · ' + q.page + '쪽</div><div class="snip">' + highlight(snippet(d.text, q2), q2) + '</div>'; });
      h += '</a>';
    });
    $r.innerHTML = h;
  }

  /* ---------- 평가 안내 (편람 Ⅱ·Ⅲ장 + 설명회) ---------- */
  function viewGuide() {
    setTitle('평가 안내 · 일정'); setTab('guide');
    var h = '';
    h += '<section class="card fold-card"><details class="fold" open><summary><span class="fold-t"><b>편람 읽는 법</b><small>기준 체계 · 일러두기</small></span><span class="fold-side"><span class="fold-row"><span class="fold-hint">펼쳐 보기</span>' + caret() + '</span></span></summary><div class="fold-body">';
    h += '<div class="fold-sec"><h4>기준 체계</h4><ul class="dots"><li>평가영역 5개 → 평가준거 30개 → 평가요소 90개 → 판단항목 201개(a, b, c …)</li><li>사후점검평가는 판단항목 102개(약 50%)로, 운영실적·평가 및 환류 개선실적·정량지표 중심입니다. 이 페이지에서는 ‘사후’로 표시합니다.</li><li>평가자는 판단항목을 중심으로 입증자료와 실제 운영 현황을 종합 검토해 평가요소의 충족 여부를 판단합니다.</li></ul><p class="muted" style="margin:6px 0 0">편람 81~83쪽 · 설명회 자료 41~42쪽</p></div>';
    h += '<div class="fold-sec"><h4>일러두기</h4><ul class="dots">' + DATA.notice.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul><p class="muted" style="margin:6px 0 0">편람 105쪽</p></div>';
    h += '</div></details></section>';

    h += cycleCard(true);
    h += '<section class="card"><h3 class="card-h">평가요소를 볼 때 순서</h3><div class="kv">' +
      [['① 판단항목', 'a), b), c)는 평가의 기본 기준입니다. 취지 범위 안에서 객관적 사실로 추가 확인할 수 있지만, 새 요구사항을 임의로 더할 수 없습니다.'],
       ['② 평가활용 참고자료', '대학이 제출한 입증자료로 사실을 확인합니다. 심사대상 기간 안의 자료, 참고자료 범위 안의 자료만 확인합니다.'],
       ['③ 주요 확인 및 유의사항', '중점 확인사항과 인정·불인정 기준입니다. 적용은 평가원의 해석을 따릅니다.'],
       ['④ 판정', '판단항목 결과로 요소를 충족(P)·조건부충족(CP)·미충족(F)으로 판정하고, 준거·영역으로 올라갑니다.']].map(function (p) { return '<div><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></div>'; }).join('') + '</div></section>';

    h += '<section class="card"><h3 class="card-h">심사대상 기간</h3><ul class="dots"><li><b>평가인증 심사</b>: 심사연도 직전 2개 학년도(' + (Y - 2) + '~' + (Y - 1) + '학년도), 회계는 ' + (Y - 3) + '~' + (Y - 2) + '회계연도</li><li><b>사후점검평가</b>: 심사연도 직전 3개 학년도(' + (Y - 3) + '~' + (Y - 1) + '학년도), 회계는 ' + (Y - 4) + '~' + (Y - 2) + '회계연도</li><li>심사대상 기간 이후 개선된 사항은 인정하지 않습니다(사실관계의 오류·정정·불일치만 인정).</li></ul><p class="muted" style="margin:6px 0 0">설명회 자료 7, 22쪽</p></section>';

    h += '<section class="card"><h3 class="card-h">평가인증 절차 체계</h3><ul class="timeline"><li><b>① 심사</b><span>평가팀</span></li><li><b>② 검토</b><span>평가실무위원회</span></li><li><b>③ 심의</b><span>전문대학평가인증위원회</span></li><li><b>④ 판정</b><span>전문대학평가인증위원회</span></li></ul><p class="muted" style="margin:6px 0 0">설명회 자료 12쪽</p></section>';

    var G = DATA.guide || {};
    if (G.schedule) h += '<section class="card"><h3 class="card-h">' + esc(G.schedule.title) + '</h3><ul class="timeline">' +
      G.schedule.items.map(function (x) { return '<li><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul>' +
      (G.schedule.note ? '<div class="callout">' + esc(G.schedule.note) + '</div>' : '') + '</section>';
    if (G.submit) h += '<section class="card"><h3 class="card-h">' + esc(G.submit.title) + '</h3><div class="table-wrap"><table><thead><tr>' + G.submit.head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      G.submit.rows.map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
      (G.submit.src ? '<p class="muted" style="margin:6px 0 0">' + esc(G.submit.src) + '</p>' : '') + '</section>';
    $app.innerHTML = h; bindSlides($app);
  }

  /* ---------- 판정 기준 ---------- */
  function viewJudge() {
    setTitle('판정 기준'); setTab('guide');
    var h = '<section class="card sec"><h3>1. 평가요소 판정<button type="button" class="sec-tool" data-slides="31,32" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>설명회 31~32쪽</button></h3>' + elemJudgeTable() + '<div class="callout">※ 충족(P)에 개선권고가 제시된 경우에도 상위 준거·영역 판정에서는 충족(P)으로 적용하고, 차회 평가에서 확인합니다.</div></section>';
    h += '<section class="card sec"><h3>2. 평가준거 판정</h3>' + critJudgeTable() + '</section>';
    h += '<section class="card sec"><h3>3. 평가영역 판정</h3><div class="table-wrap"><table><thead><tr><th>영역 판정</th><th>평가준거(6개) 판정 결과</th></tr></thead><tbody>' +
      '<tr><td>' + judgeChip('충족(P)') + '</td><td>6개 준거 모두 P, 또는 P 5개와 CP 1개</td></tr><tr><td>' + judgeChip('조건부충족(CP)') + '</td><td>P 4개와 CP 2개</td></tr><tr><td>' + judgeChip('미충족(F)') + '</td><td>CP 3개 이상, 또는 F 1개 이상</td></tr></tbody></table></div></section>';
    h += '<section class="card sec"><h3>4. 인증 판정<button type="button" class="sec-tool" data-slides="30" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>설명회 30쪽</button></h3><h4 style="margin-top:0">평가인증 심사</h4><div class="table-wrap"><table><thead><tr><th>유형</th><th>판정기준</th><th>인증기간</th><th>추후 확인사항</th></tr></thead><tbody>' +
      '<tr><td>인증</td><td>평가영역 5개 모두 충족(P)</td><td>5년</td><td>차회 평가(사후점검평가): 준거 CP, P(개선권고)</td></tr>' +
      '<tr><td>조건부인증</td><td>영역 4개 P, 1개 CP</td><td>1년 인증 후 요건 충족 시 4년</td><td>차년도 보완평가: 준거 CP</td></tr>' +
      '<tr><td>인증유예</td><td>영역 4개 P와 1개 F, 또는 3개 P와 2개 CP</td><td>1년 이내 요건 충족 시 4년 이내</td><td>차년도 보완평가: 준거 CP, F</td></tr>' +
      '<tr><td>불인증</td><td>위 어떤 기준에도 해당하지 않음</td><td>-</td><td>-</td></tr></tbody></table></div>' +
      '<h4>사후점검평가</h4><div class="table-wrap"><table><thead><tr><th>유형</th><th>판정기준</th><th>인증 연계</th></tr></thead><tbody>' +
      '<tr><td>만족</td><td>평가영역 모두 충족(P)</td><td>인증유지</td></tr><tr><td>시정권고</td><td>CP 판정 사유가 있고 12개월 이내 개선이 확실시</td><td>인증유지(시정조치)</td></tr><tr><td>불만족</td><td>1개 이상 F, 또는 시정조치 미이행·부족</td><td>인증철회</td></tr></tbody></table></div></section>';
    h += '<section class="card sec"><h3>4주기 경과 조치<button type="button" class="sec-tool" data-slides="22,23" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>설명회 22~23쪽</button></h3><ul class="dots"><li><b>신규 추가·수정된 정성 판단항목</b>: 4주기 기준 미만이면 충족(개선권고). CP·F 판정은 유예합니다. 해당 판단항목은 평가요소 화면의 ‘2027 변경’ 표시와 설명회 해설에서 확인할 수 있습니다.</li><li><b>상향된 정량 기준</b>(1.3.3 교육비 환원율, 1.6.3 취업률 등): 3주기 기준은 충족하나 4주기 기준 미만이면 충족(개선권고), 3주기 기준도 미만이면 CP 또는 F.</li><li>예외 적용 기준: 2024학년도, 2023~2024회계연도.</li></ul></section>';
    $app.innerHTML = h;
    $app.querySelectorAll('[data-slides]').forEach(function (b) {
      b.addEventListener('click', function () { openSlides(b.textContent.trim(), DATA.meta.briefing, b.getAttribute('data-slides').split(',').map(Number).filter(function (n) { return DATA.slideTitles[n]; })); });
    });
  }

  /* ---------- 2027 주요 변경 ---------- */
  function viewChanges() {
    setTitle(Y + ' 주요 변경'); setTab('changes');
    var h = '<h3 class="section-title" style="margin-top:4px">평가요소별 변경 · 설명회 해설</h3>';
    INDEX.forEach(function (e) {
      var b = DATA.brief[e.id]; if (!b) return;
      h += '<a class="card result" href="#/e/' + e.id + '"><div style="display:flex;gap:8px;align-items:center"><span class="chip score">' + esc(e.id) + '</span><b style="flex:1">' + esc(short(e)) + '</b><span class="chip">' + esc(b.kind) + '</span></div><ul class="dots" style="margin-top:8px;font-size:14px;color:var(--text-2)">' + b.pts.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul><div class="where">설명회 자료 ' + b.slides.join(', ') + '쪽</div></a>';
    });
    var qs = INDEX.filter(function (e) { return e.type === '정량'; });
    function crit(e, k) { var x = (e.quant.crit || []).filter(function (t) { return t.indexOf(k + ':') === 0; })[0]; return x ? x.slice(k.length + 1).trim() : '-'; }
    h += '<h3 class="section-title">정량지표 기준 (' + qs.length + '개)</h3><section class="card"><div class="table-wrap"><table><thead><tr><th>평가요소</th><th>충족</th><th>조건부충족</th><th>비고</th></tr></thead><tbody>' +
      qs.map(function (e) { return '<tr><td><a href="#/e/' + e.id + '">' + esc(e.id + ' ' + e.quant.name) + '</a></td><td>' + esc(crit(e, '충족')) + '</td><td>' + esc(crit(e, '조건부충족')) + '</td><td>' + (e.quant.tags.indexOf('모니터링') >= 0 ? '사후 모니터링' : '사후점검') + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="muted" style="margin:8px 4px 0">표는 좌우로 밀어서 볼 수 있습니다. · 출처: 편람 각 평가요소, 설명회 자료 43쪽</p></section>';
    $app.innerHTML = h;
  }

  /* ---------- 참고자료 (비밀번호로 암호화된 파일) ----------
     파일은 AES-GCM 으로 암호화해 refs/*.bin 으로 올리고, 목록은 data/refs.json.
     비밀번호 → PBKDF2(SHA-256) 키. 서버가 없으므로 관리자 작업은 GitHub API(관리자 토큰)로 직접 커밋. */
  var GH_REPO = 'nightbird91/CCU-Jung', GH_BASE = 'accreditation/', GH_BRANCH = 'main';
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
      if (r.status === 401 || r.status === 403) throw new Error('GitHub 토큰 권한이 없습니다. 토큰을 확인해 주세요.');
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
    btn.disabled = true; btn.textContent = '확인 중…'; tokMsg('GitHub에 토큰을 확인하고 있습니다…');
    gh('GET', 'data/refs.json').then(function () {
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
  /* 이번 편람의 설명회 자료에 없는 쪽을 가리키는 버튼은 숨김(편람을 바꿔도 화면이 깨지지 않게) */
  function hideMissingSlides() {
    var has = function (b) { return b.getAttribute('data-slides').split(',').some(function (n) { return DATA.slideTitles[n]; }); };
    document.querySelectorAll('[data-slides]').forEach(function (b) { b.hidden = !has(b); });
    var j = document.getElementById('judgeOpen'), q = document.getElementById('slidesOpen');
    if (j) j.hidden = !DATA.slideTitles[31]; if (q) q.hidden = !DATA.slideTitles[43];
  }
  function route() {
    var hash = location.hash.replace(/^#/, '') || '/';
    var path = hash.split('?')[0];
    var qs = hash.indexOf('?') >= 0 ? hash.slice(hash.indexOf('?') + 1) : '';
    var params = {};
    qs.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); params[p[0]] = decodeURIComponent(p[1] || ''); });
    if (spy) { spy.disconnect(); spy = null; }
    if (path.indexOf('/e/') === 0) viewElement(path.slice(3));
    else if (path.indexOf('/c/') === 0) viewCrit(path.slice(3));
    else if (path.indexOf('/a/') === 0) viewArea(path.slice(3));
    else if (path === '/search') viewSearch(params.q);
    else if (path === '/guide') viewGuide();
    else if (path === '/judge') viewJudge();
    else if (path === '/changes') viewChanges();
    else if (path === '/qa') viewQA(params);
    else if (path === '/refs') viewRefs();
    else viewHome();
    hideMissingSlides();
    markSidebar(path);
    if (path !== lastRoute) window.scrollTo(0, 0);
    lastRoute = path;
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', function () { $top.classList.toggle('show', window.scrollY > 600); }, { passive: true });
  $top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---------- 불러오기 ---------- */
  function loadJSON(path) {
    var inl = document.querySelector('script[type="application/json"][data-src="' + path + '"]');
    if (inl) return Promise.resolve(JSON.parse(inl.textContent));
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : 0;
    return fetch(path, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(timer); throw new Error(e && e.name === 'AbortError' ? '응답 시간 초과' : '네트워크 오류'); });
  }
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
  /* ---------- 기준 편람(연도별) ----------
     data/handbooks.json 에 편람을 한 줄씩 추가하면 설정의 '기준 편람'에서 고를 수 있습니다.
     맨 위(또는 "default": true) 편람이 처음 열립니다. 자세한 방법은 data/README.md */
  function renderHbInfo() {
    var $sel = document.getElementById('hbSelect');
    $sel.innerHTML = HBS.map(function (h) { return '<option value="' + esc(h.id) + '"' + (h === HB ? ' selected' : '') + '>' + esc(h.name) + '</option>'; }).join('');
    document.getElementById('hbInfo').innerHTML =
      '<div class="settings-row"><span>평가연도</span><b>' + Y + '</b></div>' +
      '<div class="settings-row"><span>주기</span><b>' + esc(DATA.meta.cycle) + '</b></div>' +
      '<div class="settings-row"><span>심사대상 기간</span><b>' + (Y - 2) + '~' + (Y - 1) + '학년도 (회계 ' + (Y - 3) + '~' + (Y - 2) + ')</b></div>' +
      '<div class="settings-row"><span>발간</span><b>' + esc(DATA.meta.published) + '</b></div>';
  }
  function useHandbook(h) {
    return Promise.all([loadJSON(h.data), h.qa ? loadJSON(h.qa).catch(function () { return null; }) : Promise.resolve(null)]).then(function (r) {
      HB = h; Y = h.year || parseInt(h.id, 10); DATA = r[0]; QA = r[1];
      try { localStorage.setItem('acc-hb', h.id); } catch (e) {}
      state.filter = '전체';
      buildIndex(); makeQaNote();
      QA_BY_EL = {};
      if (QA) QA.items.forEach(function (q) { q.els.forEach(function (id) { (QA_BY_EL[id] = QA_BY_EL[id] || []).push(q); }); });
      var t1 = document.querySelector('.hero-title .ht-1'); if (t1) t1.textContent = Y + ' 전문대학';
      var ct = document.getElementById('chgTab'); if (ct) ct.textContent = CHG();
      renderHbInfo();
      renderSidebar();
      document.getElementById('footer').innerHTML = '출처 : ' + esc(DATA.meta.title) + ' (' + esc(DATA.meta.publisher) + ', ' + esc(DATA.meta.published) + '), ' + esc(DATA.meta.briefing) + ' 자료' +
        (QA ? ', ' + esc(QA.meta.title) + '(' + esc(QA.meta.published) + ')' : '') + '. 설명회 해설과 백문백답은 편람 원문과 구분해 표시했습니다. 본 페이지는 열람 편의를 위한 정리본이며, 정확한 내용은 편람 원문을 확인하세요.';
      lastRoute = '';
      route();
    });
  }
  document.getElementById('hbSelect').addEventListener('change', function (e) {
    var h = HBS.filter(function (x) { return x.id === e.target.value; })[0];
    if (h && h !== HB) { showLoading(h.name + '을(를) 불러오는 중입니다'); useHandbook(h).catch(fail); }
  });
  function boot() {
    showLoading();
    return loadJSON('data/handbooks.json').then(function (list) {
      HBS = list;
      var saved = null; try { saved = localStorage.getItem('acc-hb'); } catch (e) {}
      var h = list.filter(function (x) { return x.id === saved; })[0] || list.filter(function (x) { return x.default; })[0] || list[0];
      return useHandbook(h);
    }).catch(fail);
  }
  boot();
})();
