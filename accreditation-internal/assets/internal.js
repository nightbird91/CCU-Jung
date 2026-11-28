/* 기관평가인증 편람 내부용(담당자 전용) 기능
   - 화면·편람 데이터·기본 기능은 보급용(../accreditation/)의 app.js·style.css·data 를 그대로 씁니다.
     보급용을 고치면 내부용에도 함께 반영되고, 이 파일과 internal.css 를 고치면 내부용만 바뀝니다.
   - 이 파일은 app.js 보다 먼저 읽혀 window.ACC_EXT(확장 연결점)를 등록합니다.
   - 담당자 명단은 data/staff.enc.json 에 암호화되어 있습니다(PBKDF2-SHA256 → AES-GCM). 공개 저장소이므로 평문 명단·원본 엑셀은 올리지 않습니다.
     · 담당자 몫(people[]): 담당자마다 '전화번호 뒤 4자리'로 따로 잠금 → 4자리를 넣으면 그 사람의 평가요소만 열림(이름 목록은 보이지 않음)
     · 전체 명단(admin)·확인값(acheck): '담당자 지정 관리자 비밀번호'로 잠금 → 담당자 현황표, 양식 받기, 명단 올리기, 비밀번호 바꾸기
     · 처음(acheck 없음)에는 보급용 '참고자료 다운로드 비밀번호'로 확인하고, 관리자가 이후 새 비밀번호로 바꿀 수 있음
   - 기기 저장(localStorage): acci-mode(일반/담당자 전용), acci-who(고른 이름), acci-all(전체 보기),
     acci-prog(내 준비 체크리스트), acci-roster(풀린 명단, '이 기기에서 기억'을 고른 경우. 아니면 sessionStorage) */
(function () {
  'use strict';
  var STAFF_FILE = 'data/staff.enc.json';
  var GH_REPO = 'nightbird91/CCU-Jung', GH_PATH = 'accreditation-internal/' + STAFF_FILE, GH_BRANCH = 'main';
  var XLSX_SRC = 'assets/vendor/xlsx.full.min.js';
  var ITER = 600000;   // 4자리 번호를 일일이 대입해 보는 시도를 늦추려고 크게
  var ST = [['todo', '준비 전'], ['doing', '작성 중'], ['done', '완료']];

  var A = null;            // app.js 통로(ACC_API)
  var ENC = null;          // 암호화된 명단 파일
  var R = null;            // 풀린 명단 { title, updated, demo, people:[{name,dept}], assign:{ '1.1.1': {main:[], sub:[]} } }
  var MINE = {};           // 내 평가요소 { id: '주' | '부' }
  var PARSED = null;       // 관리자가 고른 엑셀을 읽은 결과
  var CANDS = null;        // 같은 4자리 번호를 쓰는 담당자가 둘 이상일 때 고를 목록
  var adminForm = false;   // 첫 화면에서 '관리자로 열기'를 눌렀는지
  var ADMPW = '';          // 확인된 담당자 지정 관리자 비밀번호(이 창에서만, 저장하지 않음)
  var ADM_OK = 'acc-staff-admin-ok', REF_OK = 'jsh-refs-ok';
  var encLoaded = false;

  function get(k, ss) { try { return (ss ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } }
  function put(k, v, ss) { try { if (v == null) (ss ? sessionStorage : localStorage).removeItem(k); else (ss ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} }
  var mode = get('acci-mode') === 'staff' ? 'staff' : 'general';
  var who = get('acci-who') || '';
  var showAll = get('acci-all') === '1';
  var PROG = {}; try { PROG = JSON.parse(get('acci-prog') || '{}') || {}; } catch (e) { PROG = {}; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function staffOn() { return mode === 'staff' && !!R; }
  function mineOnly() { return staffOn() && !!who && !!R.people.some(function (p) { return p.name === who; }) && !showAll; }
  function deptOf(n) { var p = R && R.people.filter(function (x) { return x.name === n; })[0]; return p ? p.dept : ''; }
  function calcMine() {
    MINE = {};
    if (!R || !who) return;
    Object.keys(R.assign).forEach(function (id) {
      var a = R.assign[id];
      if (a.main.indexOf(who) >= 0) MINE[id] = '주'; else if (a.sub.indexOf(who) >= 0) MINE[id] = '부';
    });
  }
  function prog(id) { var p = (PROG[who] || {})[id]; return p || { st: 'todo', ck: [], memo: '' }; }
  function setProg(id, p) { (PROG[who] = PROG[who] || {})[id] = p; put('acci-prog', JSON.stringify(PROG)); }
  function refDone(e, p) { var n = e.refs.length; return n ? Math.min(n, p.ck.length) : 0; }

  /* ---------- 암호화 (WebCrypto) ---------- */
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64(buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { var bin = atob(s), b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
  function keyOf(pw, salt, iter) {
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function seal(k, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(obj))).then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }
  function open_(k, b) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(b.iv) }, k, unb64(b.ct)).then(function (p) { return JSON.parse(dec.decode(p)); }); }
  function fileKey(pw) { return keyOf(pw, unb64(ENC.kdf.salt), ENC.kdf.iter); }
  function tel4(v) { var d = String(v == null ? '' : v).replace(/\D/g, ''); return d ? ('0000' + d).slice(-4) : ''; }
  /* 담당자: 4자리로 열리는 몫을 모두 찾음(같은 번호를 쓰는 사람이 둘 이상일 수 있음) */
  function unlockStaff(d) {
    return fileKey(d).then(function (k) {
      return Promise.all(ENC.people.map(function (b) { return open_(k, b).catch(function () { return null; }); }));
    }).then(function (list) { list = list.filter(Boolean); if (!list.length) throw new Error('이 번호로 지정된 담당자가 없습니다.'); return list; });
  }
  /* 담당자 지정 관리자 확인: 정해 둔 비밀번호가 있으면 그것으로, 아직 없으면 보급용 참고자료 다운로드 비밀번호로.
     맞으면 전체 명단(있으면)을 돌려줌. 없으면 null */
  function loadRefs() {
    var inl = document.querySelector('script[type="application/json"][data-src="data/refs.json"]');
    return inl ? Promise.resolve(JSON.parse(inl.textContent)) : fetch(window.ACC_ROOT + 'data/refs.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function unlockAdmin(pw) {
    var bad = new Error('담당자 지정 관리자 비밀번호가 맞지 않습니다.');
    if (ENC && ENC.acheck) {
      return keyOf(pw, unb64(ENC.akdf.salt), ENC.akdf.iter).then(function (k) {
        return open_(k, ENC.acheck).then(function (v) { if (v !== ADM_OK) throw bad; return ENC.admin ? open_(k, ENC.admin) : null; });
      }).catch(function () { throw bad; }).then(function (r) { ADMPW = pw; return r; });
    }
    return loadRefs().catch(function () { return {}; }).then(function (refs) {
      if (!refs.check || !refs.kdf) throw new Error('아직 정해진 비밀번호가 없습니다. 처음에는 보급용 관리자 설정의 참고자료 다운로드 비밀번호를 씁니다. 그 비밀번호를 먼저 정해 주세요.');
      return keyOf(pw, unb64(refs.kdf.salt), refs.kdf.iter).then(function (k) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(refs.check.iv) }, k, unb64(refs.check.ct));
      }).then(function (p) { if (dec.decode(p) !== REF_OK) throw bad; }, function () { throw bad; }).then(function () { ADMPW = pw; return null; });
    });
  }
  /* 전체 명단에서 한 사람 몫만 떼어냄: 내 평가요소와 그 요소의 함께 맡은 사람(전화번호 없음) */
  function personal(r, name) {
    var assign = {}, names = {};
    Object.keys(r.assign).forEach(function (id) {
      var a = r.assign[id];
      if (a.main.indexOf(name) >= 0 || a.sub.indexOf(name) >= 0) { assign[id] = a; a.main.concat(a.sub).forEach(function (n) { names[n] = 1; }); }
    });
    names[name] = 1;
    return { v: 2, personal: true, me: name, title: r.title, updated: r.updated, demo: r.demo,
      people: r.people.filter(function (p) { return names[p.name]; }).map(function (p) { return { name: p.name, dept: p.dept }; }), assign: assign };
  }
  /* 파일 만들기: r(전체 명단)이 있고 keep 이 아니면 담당자 몫을 새로 잠그고, 관리자 부분은 adminPw 로 잠금 */
  function buildFile(r, adminPw, keep, step) {
    var out = { v: 3, kind: 'acc-staff', updated: new Date().toISOString().slice(0, 10) }, chain = Promise.resolve();
    if (keep) { out.kdf = ENC.kdf; out.people = ENC.people; }
    else {
      var salt = crypto.getRandomValues(new Uint8Array(16)), keys = {};
      var key = function (pw) { return keys[pw] = keys[pw] || keyOf(pw, salt, ITER); };
      out.kdf = { name: 'PBKDF2', hash: 'SHA-256', iter: ITER, salt: b64(salt) }; out.people = [];
      r.people.forEach(function (p, i) {
        chain = chain.then(function () { if (step) step(i + 1, r.people.length); return key(p.tel); }).then(function (k) { return seal(k, personal(r, p.name)); }).then(function (b) { out.people.push(b); });
      });
      chain = chain.then(function () {
        for (var i = out.people.length - 1; i > 0; i--) { var j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1), t = out.people[i]; out.people[i] = out.people[j]; out.people[j] = t; }   // 순서로 사람을 짐작하지 못하게 섞음
      });
    }
    var asalt = crypto.getRandomValues(new Uint8Array(16));
    out.akdf = { name: 'PBKDF2', hash: 'SHA-256', iter: ITER, salt: b64(asalt) };
    return chain.then(function () { return keyOf(adminPw, asalt, ITER); }).then(function (k) {
      return seal(k, ADM_OK).then(function (c) { out.acheck = c; return r ? seal(k, r) : null; });
    }).then(function (a) { out.admin = a; return out; });
  }

  /* ---------- 명단 불러오기 · 기억 ---------- */
  function loadEnc() {
    var inl = document.querySelector('script[type="application/json"][data-src="' + STAFF_FILE + '"]');
    var p = inl ? Promise.resolve(JSON.parse(inl.textContent)) : fetch(STAFF_FILE + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    return p.then(function (j) { ENC = j; }, function () { ENC = null; }).then(function () {
      encLoaded = true;
      var c = null; try { c = JSON.parse(get('acci-roster') || get('acci-roster', true) || 'null'); } catch (e) {}
      /* 저장소의 명단 파일이 바뀌면(담당자 몫 salt 가 달라지면) 기억한 몫을 버리고 다시 번호를 묻습니다 */
      if (c && c.r && c.r.personal && ENC && c.sig === ENC.kdf.salt) setRoster(c.r);   // 담당자 몫만 기억(관리자 명단은 기억하지 않음)
      else if (c) { put('acci-roster', null); put('acci-roster', null, true); }
      refresh();
    });
  }
  function remember(r, sig, keep) {
    var v = JSON.stringify({ sig: sig, r: r });
    put('acci-roster', keep ? v : null); put('acci-roster', keep ? null : v, true);
  }
  function setRoster(r) {
    R = r; CANDS = null;
    if (r.personal) { who = r.me; showAll = false; put('acci-who', who); put('acci-all', null); }
    else if (who && !r.people.some(function (p) { return p.name === who; })) who = '';
    calcMine();
  }
  function lock() { R = null; CANDS = null; MINE = {}; ADMPW = ''; put('acci-roster', null); put('acci-roster', null, true); refresh(); }
  function refresh() { renderSettings(); renderAdm(); if (A) A.refresh(); }

  /* ---------- 화면 조각 ---------- */
  var icLock = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var icDl = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>';
  function unlockForm(kind) {
    var tel = kind !== 'admin';
    return '<form class="lock-form" data-ai-unlock="' + (tel ? 'tel' : 'admin') + '" autocomplete="off">' +
      (tel ? '<input type="password" class="lock-input ai-tel" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="전화번호 뒤 4자리" aria-label="담당자 전화번호 뒤 4자리" autocomplete="off">'
           : '<input type="password" class="lock-input" placeholder="담당자 지정 관리자 비밀번호" aria-label="담당자 지정 관리자 비밀번호" autocomplete="current-password">') +
      '<button type="submit" class="lock-btn">확인</button></form>' + (tel ? '' : '<p class="lock-msg" role="status" aria-live="polite"></p>') + (!tel ? '' :
      '<label class="ai-keep"><input type="checkbox" data-ai-keep checked> 이 기기에서 기억 <small>공용 PC에서는 끄세요</small></label><p class="lock-msg" role="status" aria-live="polite"></p>');
  }
  function namePicker() {
    var by = {};
    R.people.forEach(function (p) { (by[p.dept || '부서 미기재'] = by[p.dept || '부서 미기재'] || []).push(p.name); });
    var cnt = {};
    Object.keys(R.assign).forEach(function (id) { var a = R.assign[id]; a.main.concat(a.sub).forEach(function (n) { cnt[n] = (cnt[n] || 0) + 1; }); });
    return Object.keys(by).map(function (d) {
      return '<div class="ai-dept">' + esc(d) + '</div><div class="ai-names">' + by[d].map(function (n) {
        return '<button type="button" class="filter" data-ai="pick" data-name="' + esc(n) + '" aria-pressed="' + (n === who) + '">' + esc(n) + ' <small>' + (cnt[n] || 0) + '</small></button>';
      }).join('') + '</div>';
    }).join('');
  }
  function demoNote() { return R && R.demo ? '<p class="ai-demo">가상 견본 명단입니다. 실제 명단은 관리자가 설정 → 담당자 명단 관리에서 올립니다.</p>' : ''; }
  function homeTop() {
    if (mode !== 'staff') return '';
    var h = '<section class="card ai-card' + (R ? ' on' : '') + '" data-ai-card>';
    if (!encLoaded) return h + '<b>담당자 명단을 확인하는 중입니다</b></section>';
    if (!R && !ENC) return h + '<b>담당자 명단이 아직 없습니다</b><p class="muted">관리자가 설정 → 담당자 명단 관리에서 담당자 지정 엑셀을 올리면 쓸 수 있습니다.</p></section>';
    if (!R && CANDS) return h + '<b>담당자를 골라 주세요</b><p class="muted">같은 번호로 지정된 담당자가 여러 명입니다.</p><div class="ai-names">' +
      CANDS.map(function (c, i) { return '<button type="button" class="filter" data-ai="cand" data-i="' + i + '">' + esc(c.me) + ' <small>' + esc((c.people.filter(function (p) { return p.name === c.me; })[0] || {}).dept || '') + '</small></button>'; }).join('') + '</div></section>';
    if (!R) return h + '<b>' + icLock + ' 담당자 전용</b>' +
      (ADMPW ? '<p class="muted">담당자 지정 관리자로 확인되었습니다. 아직 올린 담당자 명단이 없습니다. 설정 → 관리자 설정 → 담당자 명단 관리에서 올려 주세요.</p><button type="button" class="lock-link" data-ai="lock">관리자 나가기</button>'
        : adminForm ? '<p class="muted">담당자 지정 관리자 비밀번호를 넣으면 전체 담당자 현황을 봅니다.</p>' + unlockForm('admin') + '<button type="button" class="lock-link" data-ai="admin-form" data-on="0">담당자 번호로 열기</button>'
        : '<p class="muted">내 전화번호 뒤 4자리를 넣으면 내가 맡은 평가영역·평가준거·평가요소만 바로 보입니다.</p>' + unlockForm('tel') + '<button type="button" class="lock-link" data-ai="admin-form" data-on="1">관리자로 열기</button>') + '</section>';
    var me = who && R.people.some(function (p) { return p.name === who; });
    if (!me) return h + '<b>이름을 골라 주세요</b><p class="muted">이름을 누르면 그 사람이 맡은 평가요소만 평가체계와 목차에 보입니다. 숫자는 맡은 평가요소 수입니다.</p>' + namePicker() + demoNote() +
      '<div class="ai-tools"><a class="lock-link" href="#/staff">담당자 현황 보기</a><button type="button" class="lock-link" data-ai="lock">잠그기</button></div></section>';
    var ids = Object.keys(MINE), INDEX = A.index();
    var els = INDEX.filter(function (e) { return MINE[e.id]; });
    var nm = els.filter(function (e) { return MINE[e.id] === '주'; }).length;
    var c = { todo: 0, doing: 0, done: 0 };
    els.forEach(function (e) { c[prog(e.id).st]++; });
    var areas = {}, crits = {};
    els.forEach(function (e) { areas[e._area.id] = 1; crits[e._crit.id] = 1; });
    h += '<div class="ai-me"><b>' + esc(who) + '</b><span>' + esc(deptOf(who)) + '</span>' + (R.personal ? '' : '<button type="button" class="lock-link" data-ai="rename">다른 담당자 보기</button>') + '</div>' +
      '<p class="muted">평가영역 ' + Object.keys(areas).length + '개 · 평가준거 ' + Object.keys(crits).length + '개 · 평가요소 ' + ids.length + '개 (주 담당 ' + nm + ' · 부 담당 ' + (ids.length - nm) + ')</p>';
    if (els.length) {
      h += '<div class="bar ai-bar" role="img" aria-label="준비 진행: 완료 ' + c.done + ', 작성 중 ' + c.doing + ', 준비 전 ' + c.todo + '">' +
        '<span class="ai-done" style="width:' + (c.done * 100 / els.length) + '%"></span><span class="ai-doing" style="width:' + (c.doing * 100 / els.length) + '%"></span></div>' +
        '<div class="legend"><span><i class="ai-done"></i>완료 ' + c.done + '</span><span><i class="ai-doing"></i>작성 중 ' + c.doing + '</span><span><i></i>준비 전 ' + c.todo + '</span></div>';
    } else h += '<p class="muted">맡은 평가요소가 없습니다.</p>';
    h += '<div class="filters ai-seg" role="group" aria-label="평가체계 보기"><button type="button" class="filter" data-ai="mine" aria-pressed="' + !showAll + '">내 평가요소만</button><button type="button" class="filter" data-ai="all" aria-pressed="' + showAll + '">전체 보기</button></div>' +
      '<div class="ai-tools"><button type="button" class="lock-btn ghost sm" data-ai="dl-mine">' + icDl + '내 평가요소 엑셀</button>' + (R.personal ? '' : '<a class="lock-btn ghost sm" href="#/staff">담당자 현황</a>') + '<button type="button" class="lock-link" data-ai="lock">' + (R.personal ? '나가기' : '잠그기') + '</button></div>' +
      '<p class="muted ai-note">준비 상태와 체크리스트는 이 기기에만 저장됩니다.</p>' + demoNote();
    return h + '</section>';
  }
  function chips(e) {
    if (!staffOn() || !who) return '';
    var r = MINE[e.id]; if (!r) return '';
    var st = prog(e.id).st;
    return '<span class="chip ' + (r === '주' ? 'ai-main' : 'ai-sub') + '">' + r + ' 담당</span>' + (st !== 'todo' ? '<span class="chip ai-' + st + '">' + (st === 'done' ? '완료' : '작성 중') + '</span>' : '');
  }
  function people(list) { return list.length ? list.map(function (n) { return '<b>' + esc(n) + '</b><small>' + esc(deptOf(n)) + '</small>'; }).join(', ') : '<span class="muted">미지정</span>'; }
  function elementTop(e) {
    if (!staffOn()) return '';
    var a = R.assign[e.id] || { main: [], sub: [] }, r = who ? MINE[e.id] : null;
    if (R.personal && !r) return '';
    var h = '<section class="card ai-el' + (r ? ' mine' : '') + '"><div class="ai-who"><span>주 담당</span><div>' + people(a.main) + '</div><span>부 담당</span><div>' + people(a.sub) + '</div></div>';
    if (r) {
      var p = prog(e.id), n = e.refs.length;
      h += '<h3 class="ai-h">내 준비 체크리스트 <span class="chip ' + (r === '주' ? 'ai-main' : 'ai-sub') + '">' + r + ' 담당</span></h3>' +
        '<div class="filters ai-seg" role="group" aria-label="준비 상태">' + ST.map(function (s) { return '<button type="button" class="filter" data-ai="st" data-st="' + s[0] + '" aria-pressed="' + (p.st === s[0]) + '">' + s[1] + '</button>'; }).join('') + '</div>';
      if (n) h += '<div class="ai-ck-h">평가활용 참고자료 준비 <span data-ai-ckn>' + refDone(e, p) + '/' + n + '</span></div><ul class="ai-ck">' + e.refs.map(function (x, i) {
        return '<li><label><input type="checkbox" data-ai-ck="' + i + '"' + (p.ck.indexOf(i) >= 0 ? ' checked' : '') + '><span>' + esc(x.x) + '</span></label></li>';
      }).join('') + '</ul>';
      h += '<label class="admin-field ai-memo-l"><span>메모 <small>이 기기에만 저장</small></span><textarea class="ai-memo" data-ai-memo rows="3" placeholder="자료 위치, 협조 부서, 일정 등">' + esc(p.memo) + '</textarea></label>';
    }
    return h + '</section>';
  }
  function bindElement(root, e) {
    var box = root.querySelector('.ai-el.mine'); if (!box) return;
    box.addEventListener('change', function (ev) {
      var t = ev.target; if (!t.hasAttribute('data-ai-ck')) return;
      var p = prog(e.id), i = +t.getAttribute('data-ai-ck');
      p.ck = p.ck.filter(function (x) { return x !== i; }); if (t.checked) p.ck.push(i);
      if (p.st === 'todo' && p.ck.length) p.st = 'doing';
      setProg(e.id, p);
      box.querySelector('[data-ai-ckn]').textContent = refDone(e, p) + '/' + e.refs.length;
      box.querySelectorAll('[data-ai="st"]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-st') === p.st ? 'true' : 'false'); });
    });
    var timer = 0, m = box.querySelector('[data-ai-memo]');
    m.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { var p = prog(e.id); p.memo = m.value; setProg(e.id, p); }, 300); });
  }
  function sideExtra() {
    if (!staffOn() || R.personal) return '';
    return '<a class="side-link" href="#/staff" data-key="staff"><svg class="side-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.6"/></svg><b>담당자 현황</b></a>';
  }
  function sideCount() { return mineOnly() ? esc(who) + ' · ' + Object.keys(MINE).length + '개' : ''; }

  /* ---------- 담당자 현황 (#/staff) ---------- */
  function viewStaff() {
    var $app = A.app;
    A.setTitle('담당자 현황'); A.setTab('home');
    var h = '<div class="crumbs"><span><a href="#/">평가체계</a></span><span>담당자 현황</span></div>';
    if (!staffOn() || R.personal) {
      if (ADMPW && !R) { h += '<section class="card ai-card on"><b>아직 담당자 명단이 없습니다</b><p class="muted">설정 → 관리자 설정 → 담당자 명단 관리에서 담당자 지정 엑셀을 올려 주세요.</p></section>'; $app.innerHTML = h; return; }
      h += '<section class="card ai-card"><b>' + icLock + ' 관리자 전용</b><p class="muted">' + (mode !== 'staff' ? '설정에서 보기 방식을 \'담당자 전용\'으로 바꾸고 ' : '') + '담당자 지정 관리자 비밀번호를 넣으면 전체 담당자 현황을 볼 수 있습니다.</p>' + (mode === 'staff' && ENC ? unlockForm('admin') : '<button type="button" class="lock-btn sm" data-ai="mode" data-mode="staff">담당자 전용으로 바꾸기</button>') + '</section>';
      $app.innerHTML = h; return;
    }
    var INDEX = A.index(), unassigned = INDEX.filter(function (e) { var a = R.assign[e.id]; return !a || !a.main.length; });
    var nosub = INDEX.filter(function (e) { var a = R.assign[e.id]; return a && a.main.length && !a.sub.length; });
    var cnt = {};
    R.people.forEach(function (p) { cnt[p.name] = { m: 0, s: 0 }; });
    Object.keys(R.assign).forEach(function (id) { var a = R.assign[id]; a.main.forEach(function (n) { (cnt[n] = cnt[n] || { m: 0, s: 0 }).m++; }); a.sub.forEach(function (n) { (cnt[n] = cnt[n] || { m: 0, s: 0 }).s++; }); });
    h += '<section class="card summary"><div class="muted">' + esc(R.title || '담당자 지정') + (R.updated ? ' · ' + esc(R.updated) + ' 기준' : '') + '</div>' +
      '<div class="total"><b>' + R.people.length + '명</b><span class="muted">평가요소 ' + INDEX.length + '개 · 주 담당 지정 ' + (INDEX.length - unassigned.length) + '개 · 미지정 ' + unassigned.length + '개 · 부 담당 없음 ' + nosub.length + '개</span></div>' +
      '<div class="ai-tools"><button type="button" class="lock-btn ghost sm" data-ai="dl-staff">' + icDl + '현황표 엑셀</button></div>' + demoNote() + '</section>';
    if (unassigned.length) h += '<div class="callout"><b>주 담당자가 없는 평가요소</b>' + unassigned.map(function (e) { return '<a class="chip" href="#/e/' + e.id + '">' + esc(e.id) + '</a>'; }).join(' ') + '</div>';
    h += '<h3 class="section-title">담당자별</h3><div class="table-wrap"><table><thead><tr><th>부서</th><th>이름</th><th>주 담당</th><th>부 담당</th><th>계</th></tr></thead><tbody>' +
      R.people.slice().sort(function (a, b) { return (a.dept || '').localeCompare(b.dept || '', 'ko') || a.name.localeCompare(b.name, 'ko'); }).map(function (p) {
        var c = cnt[p.name] || { m: 0, s: 0 };
        return '<tr><td>' + esc(p.dept) + '</td><td><button type="button" class="lock-link" data-ai="pick" data-name="' + esc(p.name) + '">' + esc(p.name) + '</button></td><td>' + c.m + '</td><td>' + c.s + '</td><td><b>' + (c.m + c.s) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>';
    h += '<h3 class="section-title">평가영역별</h3>';
    A.areas().forEach(function (a) {
      h += '<section class="card cat ' + A.areaCls(a) + '"><div class="cat-head"><div class="cat-badge">' + esc(a.id) + '</div><div><div class="meta">평가영역</div><h2>' + esc(a.name) + '</h2></div></div>' +
        '<div class="table-wrap"><table class="ai-tbl"><thead><tr><th>평가요소</th><th>주 담당</th><th>부 담당</th></tr></thead><tbody>';
      a.criteria.forEach(function (c) {
        h += '<tr class="ai-crit"><td colspan="3"><a href="#/c/' + c.id + '">' + esc(c.id + ' ' + c.name) + '</a></td></tr>';
        c.elements.forEach(function (e) {
          var s = R.assign[e.id] || { main: [], sub: [] };
          h += '<tr><td><a href="#/e/' + e.id + '"><b>' + esc(e.id) + '</b> ' + esc(A.short(e)) + '</a></td><td>' + people(s.main) + '</td><td>' + people(s.sub) + '</td></tr>';
        });
      });
      h += '</tbody></table></div></section>';
    });
    h += '<p class="muted" style="margin:4px 4px 12px">각 담당자의 준비 상태는 담당자 본인 기기에만 저장되므로 이 표에는 나오지 않습니다.</p>';
    $app.innerHTML = h;
  }

  /* ---------- 엑셀 (SheetJS, 필요할 때만 불러옴) ---------- */
  var xlsxP = null;
  function xlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxP) xlsxP = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = XLSX_SRC; s.onload = function () { ok(window.XLSX); }; s.onerror = function () { xlsxP = null; no(new Error('엑셀 도구를 불러오지 못했습니다.')); };
      document.head.appendChild(s);
    });
    return xlsxP;
  }
  function saveBook(sheets, name) {
    return xlsx().then(function (X) {
      var wb = X.utils.book_new();
      sheets.forEach(function (s) { var ws = X.utils.aoa_to_sheet(s.rows); if (s.cols) ws['!cols'] = s.cols.map(function (w) { return { wch: w }; }); X.utils.book_append_sheet(wb, ws, s.name); });
      var out = X.write(wb, { bookType: 'xlsx', type: 'array' });
      saveBlob(name, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    });
  }
  function baseRow(e) { return [e._area.id + '. ' + e._area.name, e._crit.id + ' ' + e._crit.name, e.id, A.short(e)]; }
  /* 담당자 지정 양식: 한 줄에 담당 한 건. 앞 세 칸(평가요소 번호·전화·이름)이 필수, 나머지는 권장·참고 */
  var HEAD2 = ['평가요소 번호', '전화번호(뒤 4자리)', '이름', '부서', '구분(주/부)', '평가요소', '영역', '평가준거', '비고'];
  var COLS2 = [13, 16, 10, 16, 11, 40, 22, 26, 20];
  function refCols(e) { return [A.short(e), e._area.id + '. ' + e._area.name, e._crit.id + ' ' + e._crit.name]; }
  function dlTemplate() {
    var rows = [HEAD2].concat(A.index().map(function (e) { return [e.id, '', '', '', '주'].concat(refCols(e), ['']); }));
    return saveBook([{ name: '담당자 지정', rows: rows, cols: COLS2 }, { name: '작성 방법', cols: [110], rows: [
      ['[필수] 평가요소 번호 · 전화번호(뒤 4자리) · 이름'],
      ['  - 한 줄에 담당 한 건입니다. 한 평가요소를 여러 명이 맡으면 그 평가요소 번호로 줄을 더 넣습니다(줄 순서는 상관없음).'],
      ['  - 전화번호 뒤 4자리는 담당자가 사이트에 들어갈 때 쓰는 번호입니다. 같은 사람은 모든 줄에 같은 번호를 적습니다.'],
      ['  - 0으로 시작하는 번호는 셀 서식을 텍스트로 하거나 앞에 \' 를 붙여 주세요(빠져도 4자리로 맞춰 읽습니다).'],
      ['[권장] 부서: 담당자 현황표에 부서별로 묶여 나옵니다.'],
      ['[권장] 구분(주/부): 비우면 주 담당으로 봅니다. 평가요소마다 주 담당 1명을 권합니다.'],
      ['[참고] 평가요소 · 영역 · 평가준거: 확인용으로 미리 채운 칸입니다. 고치거나 지워도 됩니다(평가요소 번호로 짝을 짓습니다).'],
      ['[선택] 비고: 메모용이며 사이트에는 쓰이지 않습니다.'],
      ['올리기: 사이트 설정 → 담당자 명단 관리에서 이 파일을 고르고 관리자 비밀번호를 정해 올립니다. 엑셀 원본은 서버에 올라가지 않습니다.']] }], '담당자지정_양식_' + A.year() + '.xlsx');
  }
  function telOf(n) { var p = R.people.filter(function (x) { return x.name === n; })[0]; return p && p.tel || ''; }
  /* 현황표는 양식과 같은 모양이라 고쳐서 그대로 다시 올릴 수 있음 */
  function dlStaff() {
    var rows = [HEAD2];
    A.index().forEach(function (e) {
      var s = R.assign[e.id] || { main: [], sub: [] };
      s.main.forEach(function (n) { rows.push([e.id, telOf(n), n, deptOf(n), '주'].concat(refCols(e), [''])); });
      s.sub.forEach(function (n) { rows.push([e.id, telOf(n), n, deptOf(n), '부'].concat(refCols(e), [''])); });
      if (!s.main.length && !s.sub.length) rows.push([e.id, '', '', '', '주'].concat(refCols(e), ['미지정']));
    });
    return saveBook([{ name: '담당자 지정', rows: rows, cols: COLS2 }], '담당자현황_' + (R.updated || '') + '.xlsx');
  }
  function dlMine() {
    var rows = [['영역', '평가준거', '평가요소 번호', '평가요소', '구분', '함께 담당', '준비 상태', '참고자료 준비', '평가활용 참고자료', '메모']];
    A.index().forEach(function (e) {
      if (!MINE[e.id]) return;
      var s = R.assign[e.id], p = prog(e.id), with_ = s.main.concat(s.sub).filter(function (n) { return n !== who; });
      rows.push(baseRow(e).concat([MINE[e.id], with_.join(', '), ST.filter(function (x) { return x[0] === p.st; })[0][1], refDone(e, p) + '/' + e.refs.length,
        e.refs.map(function (r, i) { return (p.ck.indexOf(i) >= 0 ? '[V] ' : '[ ] ') + r.x; }).join('\n'), p.memo]));
    });
    return saveBook([{ name: '내 평가요소', rows: rows, cols: [22, 26, 13, 40, 6, 20, 10, 12, 60, 30] }], '내평가요소_' + who + '.xlsx');
  }
  /* 담당자 지정 엑셀 읽기: 한 줄에 평가요소 하나(주/부 담당 열) 또는 한 줄에 담당 하나(이름·부서·구분 열) 모두 받음 */
  function splitNames(v) { return String(v == null ? '' : v).split(/[,，、·\/\n]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function parseBook(buf) {
    return xlsx().then(function (X) {
      var wb = X.read(buf, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var aoa = X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      var hi = -1;
      for (var i = 0; i < Math.min(aoa.length, 20); i++) if (aoa[i].some(function (c) { return /평가요소/.test(c); })) { hi = i; break; }
      if (hi < 0) throw new Error('첫 시트에서 \'평가요소\' 제목 줄을 찾지 못했습니다. 견본 양식을 써 주세요.');
      var col = {};
      aoa[hi].forEach(function (c, j) {
        var n = String(c).replace(/\s/g, '');
        if (/번호/.test(n) && /요소/.test(n)) col.id = j;
        else if (/전화|연락처|뒷?자리/.test(n)) { if (/^주/.test(n)) col.mt = j; else if (/^부담당/.test(n)) col.st = j; else col.tel = j; }
        else if (/부서/.test(n)) { if (/^주/.test(n)) col.md = j; else if (/^부담당/.test(n)) col.sd = j; else col.dept = j; }
        else if (/^주담당/.test(n)) col.mn = j;
        else if (/^부담당/.test(n)) col.sn = j;
        else if (/^(이름|성명|담당자|담당자명)$/.test(n)) col.name = j;
        else if (/^(구분|주\/부|역할)/.test(n)) col.kind = j;
      });
      var BY = {}; A.index().forEach(function (e) { BY[e.id] = e; });
      if (col.id == null) aoa[hi].forEach(function (c, j) { if (col.id == null && aoa.slice(hi + 1, hi + 6).some(function (r) { return BY[String(r[j]).trim()]; })) col.id = j; });
      if (col.id == null) throw new Error('평가요소 번호 열을 찾지 못했습니다.');
      if (col.mn == null && col.name == null) throw new Error('\'주 담당자\' 또는 \'이름\' 열을 찾지 못했습니다.');
      var assign = {}, ppl = {}, unknown = [], order = [], clash = {};
      function person(n, d, t) {
        if (!ppl[n]) { ppl[n] = { dept: d || '', tel: t || '' }; order.push(n); return; }
        if (!ppl[n].dept && d) ppl[n].dept = d;
        if (t) { if (ppl[n].tel && ppl[n].tel !== t) clash[n] = 1; else ppl[n].tel = t; }
      }
      function add(id, kind, names, ds, ts) {
        var a = assign[id] = assign[id] || { main: [], sub: [] };
        names.forEach(function (n, k) { person(n, ds[k] || (ds.length === 1 ? ds[0] : ''), tel4(ts[k] || (ts.length === 1 && names.length === 1 ? ts[0] : ''))); var L = kind === '부' ? a.sub : a.main; if (L.indexOf(n) < 0) L.push(n); });
      }
      function cell(r, c) { return splitNames(c != null ? r[c] : ''); }
      aoa.slice(hi + 1).forEach(function (r) {
        var id = String(r[col.id] || '').trim(); if (!id) return;
        if (!BY[id]) { if (/^\d+\.\d+\.\d+$/.test(id)) unknown.push(id); return; }
        if (col.mn != null) {
          add(id, '주', cell(r, col.mn), cell(r, col.md), cell(r, col.mt));
          if (col.sn != null) add(id, '부', cell(r, col.sn), cell(r, col.sd), cell(r, col.st));
        } else add(id, /부/.test(String(col.kind != null ? r[col.kind] : '')) ? '부' : '주', cell(r, col.name), cell(r, col.dept), cell(r, col.tel));
      });
      Object.keys(assign).forEach(function (id) { var a = assign[id]; a.sub = a.sub.filter(function (n) { return a.main.indexOf(n) < 0; }); });
      var miss = A.index().filter(function (e) { return !assign[e.id] || !assign[e.id].main.length; }).map(function (e) { return e.id; });
      if (!order.length) throw new Error('담당자 이름이 하나도 없습니다.');
      var byTel = {}; order.forEach(function (n) { if (ppl[n].tel) (byTel[ppl[n].tel] = byTel[ppl[n].tel] || []).push(n); });
      return { roster: { v: 2, title: '기관평가인증 담당자 지정', updated: new Date().toISOString().slice(0, 10), people: order.map(function (n) { return { name: n, dept: ppl[n].dept, tel: ppl[n].tel }; }), assign: assign },
        miss: miss, unknown: unknown, noTel: order.filter(function (n) { return !ppl[n].tel; }), clash: Object.keys(clash),
        same: Object.keys(byTel).filter(function (t) { return byTel[t].length > 1; }).map(function (t) { return byTel[t].join('·'); }) };
    });
  }

  /* ---------- GitHub 올리기 (관리자 토큰: 보급용 관리자 설정과 같은 기기 저장값) ---------- */
  function ghToken() { return get('jsh-gh-token') || ''; }
  function ghPutStaff(text) {
    var url = 'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_PATH, H = { Authorization: 'Bearer ' + ghToken(), Accept: 'application/vnd.github+json' };
    return fetch(url + '?ref=' + GH_BRANCH + '&t=' + Date.now(), { headers: H, cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return null; if (!r.ok) throw new Error('GitHub 확인 실패 (' + r.status + ')'); return r.json();
    }).then(function (cur) {
      var body = { message: '내부용: 담당자 명단 갱신(암호화)', content: b64(enc.encode(text)), branch: GH_BRANCH };
      if (cur && cur.sha) body.sha = cur.sha;
      return fetch(url, { method: 'PUT', headers: H, body: JSON.stringify(body) });
    }).then(function (r) { if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? '토큰 권한을 확인해 주세요 (' + r.status + ')' : 'GitHub 저장 실패 (' + r.status + ')'); });
  }
  function download(name, text) { saveBlob(name, new Blob([text], { type: 'application/json' })); }
  function saveBlob(name, blob) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.addEventListener('click', function (e) { e.stopPropagation(); });   // 설정 창이 닫히지 않게
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  /* ---------- 설정 패널 ---------- */
  var $panel = document.getElementById('settingsPanel');
  var $mode = document.createElement('div');
  $mode.className = 'settings-mode'; $mode.id = 'aiMode';
  var theme = document.getElementById('themeBox');   // '화면 바탕' 바로 아래
  theme.parentNode.insertBefore($mode, theme.nextSibling);
  /* 담당자 명단 관리는 보급용과 같은 '관리자 설정' 블록 안, 참고자료 비밀번호 설정 아래에 둠 */
  var $adm = document.createElement('div');
  $adm.className = 'admin-pw ai-admin'; $adm.id = 'aiAdmin';
  document.querySelector('#adminBox .admin-body').appendChild($adm);
  function renderAdm() {
    $adm.hidden = mode !== 'staff';   // 일반 모드에서는 담당자 명단 관리를 숨김
    var h = '<b>담당자 명단 관리 <small>내부용</small></b>';
    if (!ADMPW) {
      h += '<p class="admin-help">담당자 지정 관리자 비밀번호를 넣은 사람만 담당자 지정 양식을 받고 명단을 올릴 수 있습니다.' +
        (ENC && ENC.acheck ? '' : ' 처음 비밀번호는 위 참고자료 다운로드 비밀번호와 같습니다.') + '</p>' + unlockForm('admin');
      $adm.innerHTML = h; return;
    }
    h += '<p class="admin-help">평가요소 번호·전화번호 뒤 4자리·이름을 적은 엑셀을 올리면, 담당자마다 자기 4자리로만 열리게 암호화합니다. 전체 명단은 담당자 지정 관리자 비밀번호로 잠급니다. 엑셀 원본은 저장소에 올라가지 않습니다.</p>' +
      '<button type="button" class="lock-btn ghost sm" data-ai="tpl">' + icDl + '담당자 지정 양식 받기 (엑셀)</button>' +
      '<label class="admin-field"><span>담당자 지정 엑셀</span><input type="file" id="aiFile" accept=".xlsx,.xls,.csv" class="ai-file"></label>' +
      '<div class="ai-parse" id="aiParse" role="status" aria-live="polite">' + (PARSED ? PARSED.html : '') + '</div>' +
      '<div class="ai-sub"><b>담당자 지정 관리자 비밀번호 설정</b><small>' + (ENC && ENC.acheck ? '바꿀 때만 넣으세요. 비우면 지금 비밀번호를 그대로 씁니다.' : '지금은 참고자료 다운로드 비밀번호와 같습니다. 바꿀 때만 넣으세요.') + '</small></div>' +
      '<label class="admin-field"><span>새 비밀번호 <small>8자 이상</small></span><input type="password" id="aiPw" class="lock-input" autocomplete="new-password"></label>' +
      '<label class="admin-field"><span>새 비밀번호 확인</span><input type="password" id="aiPw2" class="lock-input" autocomplete="new-password"></label>' +
      '<div class="admin-row"><button type="button" class="lock-btn sm" data-ai="publish">GitHub 올리기</button><button type="button" class="lock-btn ghost sm" data-ai="enc-dl">파일로 받기</button></div>' +
      '<div class="ai-tools"><button type="button" class="lock-link" data-ai="local">이 기기에서만 미리 적용</button><button type="button" class="lock-link" data-ai="lock">관리자 나가기</button></div>' +
      '<p class="admin-help">엑셀을 고르면 새 명단으로, 고르지 않고 새 비밀번호만 넣으면 비밀번호만 바뀝니다. GitHub에 올리려면 위에 GitHub 토큰이 저장되어 있어야 합니다. 토큰이 없으면 파일로 받아 accreditation-internal/data/staff.enc.json 으로 바꿔 올리면 됩니다.</p>' +
      '<p class="lock-msg" id="aiAdmMsg" role="status" aria-live="polite"></p>';
    $adm.innerHTML = h;
  }

  function renderSettings() {
    var h = '<span id="aiModeLbl">보기 방식</span><div class="theme-seg" role="group" aria-labelledby="aiModeLbl">' +
      '<button type="button" data-ai="mode" data-mode="general" aria-pressed="' + (mode === 'general') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/></svg>일반</button>' +
      '<button type="button" data-ai="mode" data-mode="staff" aria-pressed="' + (mode === 'staff') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>담당자 전용</button></div>';
    if (mode === 'staff') {
      if (!encLoaded) h += '<p class="lock-msg">명단 확인 중…</p>';
      else if (!R && !ENC) h += '<p class="admin-help">아직 담당자 명단이 없습니다.</p>';
      else if (!R) h += CANDS ? '<p class="admin-help">첫 화면에서 담당자를 골라 주세요.</p>' : unlockForm('tel');
      else if (R.personal) h += '<div class="settings-row"><span>담당자</span><b>' + esc(who) + ' <small class="muted">' + esc(deptOf(who)) + '</small></b></div><button type="button" class="lock-link" data-ai="lock">나가기</button>';
      else {
        h += '<label class="settings-row" for="aiWho"><span>담당자</span><select id="aiWho" class="settings-select"><option value="">이름을 고르세요</option>';
        var by = {}; R.people.forEach(function (p) { (by[p.dept || '부서 미기재'] = by[p.dept || '부서 미기재'] || []).push(p.name); });
        Object.keys(by).forEach(function (d) { h += '<optgroup label="' + esc(d) + '">' + by[d].map(function (n) { return '<option' + (n === who ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</optgroup>'; });
        h += '</select></label><button type="button" class="lock-link" data-ai="lock">잠그기</button>';
      }
    }
    $mode.innerHTML = h;
    var sel = document.getElementById('aiWho');
    if (sel) sel.addEventListener('change', function () { pick(sel.value); });
  }
  function pick(n) {
    who = n; showAll = false; put('acci-who', n || null); put('acci-all', null); calcMine();
    if (n) { $panel.hidden = true; document.getElementById('settingsBtn').setAttribute('aria-expanded', 'false'); }
    if (n && location.hash !== '' && location.hash !== '#/') location.hash = '#/'; else refresh();
    renderSettings();
  }
  function admMsg(t, bad) { var m = document.getElementById('aiAdmMsg'); if (!m) return; m.textContent = t || ''; m.classList.toggle('bad', !!bad); }

  document.addEventListener('change', function (ev) {
    if (ev.target.id !== 'aiFile') return;
    var f = ev.target.files[0], out = document.getElementById('aiParse'); PARSED = null; out.innerHTML = '';
    if (!f) return;
    out.textContent = '읽는 중…';
    f.arrayBuffer().then(parseBook).then(function (res) {
      PARSED = res;
      var r = res.roster, n = Object.keys(r.assign).length;
      out.innerHTML = '<b>' + esc(f.name) + '</b><span>담당자 ' + r.people.length + '명 · 평가요소 ' + n + '개 연결</span>' +
        (res.miss.length ? '<span class="bad">주 담당 미지정 ' + res.miss.length + '개: ' + esc(res.miss.slice(0, 12).join(', ')) + (res.miss.length > 12 ? ' 외' : '') + '</span>' : '<span>모든 평가요소에 주 담당자가 있습니다.</span>') +
        (res.unknown.length ? '<span class="bad">편람에 없는 번호 ' + esc(res.unknown.join(', ')) + ' (건너뜀)</span>' : '') +
        (res.noTel.length ? '<span class="bad">전화 뒤 4자리 없음: ' + esc(res.noTel.join(', ')) + '</span>' : '<span>모든 담당자에게 전화 뒤 4자리가 있습니다.</span>') +
        (res.clash.length ? '<span class="bad">같은 사람인데 번호가 다름(처음 값 사용): ' + esc(res.clash.join(', ')) + '</span>' : '') +
        (res.same.length ? '<span>같은 번호를 쓰는 담당자(들어갈 때 이름을 고름): ' + esc(res.same.join(', ')) + '</span>' : '');
      res.html = out.innerHTML;
    }).catch(function (err) { out.innerHTML = '<span class="bad">' + esc(err.message || '읽지 못했습니다.') + '</span>'; });
  });
  function prepare() {
    var np = document.getElementById('aiPw').value, np2 = document.getElementById('aiPw2').value;
    if (np || np2) {
      if (np.length < 8) return Promise.reject(new Error('새 비밀번호는 8자 이상으로 정해 주세요.'));
      if (np !== np2) return Promise.reject(new Error('새 비밀번호 확인이 맞지 않습니다.'));
    }
    var pw = np || ADMPW, src = PARSED ? PARSED.roster : null, full = R && !R.personal ? R : null;
    if (!src && !np) return Promise.reject(new Error('담당자 지정 엑셀을 고르거나 새 비밀번호를 넣어 주세요.'));
    if (src) {
      var noTel = src.people.filter(function (p) { return !/^\d{4}$/.test(p.tel || ''); }).map(function (p) { return p.name; });
      if (noTel.length) return Promise.reject(new Error('전화 뒤 4자리가 없는 담당자가 있습니다: ' + noTel.join(', ')));
      src = JSON.parse(JSON.stringify(src)); delete src.demo; src.updated = new Date().toISOString().slice(0, 10);
    }
    if (!src && !ENC) return Promise.reject(new Error('담당자 지정 엑셀을 먼저 골라 주세요.'));
    admMsg('암호화하는 중…');
    /* 새 엑셀이면 담당자 몫까지 새로, 비밀번호만 바꾸면 담당자 몫은 그대로 두고 관리자 부분만 다시 잠금 */
    return buildFile(src || full, pw, !src, function (i, n) { admMsg('암호화하는 중… 담당자 ' + i + '/' + n); })
      .then(function (file) { return { r: src || full, pw: pw, file: file, text: JSON.stringify(file, null, 1) + '\n', newPw: !!np }; });
  }
  function adopt(x) {
    ENC = x.file; ADMPW = x.pw; PARSED = null; who = '';
    if (x.r) setRoster(x.r);
    if (mode !== 'staff') { mode = 'staff'; put('acci-mode', 'staff'); }
    refresh();
  }

  /* ---------- 클릭·입력 처리 ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ai]'); if (!b) return;
    var act = b.getAttribute('data-ai');
    if (b.closest('#settingsPanel')) ev.stopImmediatePropagation();   // 다시 그린 버튼이 패널 밖으로 판정되어 설정 창이 닫히지 않게
    if (act === 'mode') { mode = b.getAttribute('data-mode'); put('acci-mode', mode); refresh(); }
    else if (act === 'pick') pick(b.getAttribute('data-name'));
    else if (act === 'rename') { who = ''; put('acci-who', null); calcMine(); refresh(); }
    else if (act === 'mine' || act === 'all') { showAll = act === 'all'; put('acci-all', showAll ? '1' : null); refresh(); }
    else if (act === 'lock') lock();
    else if (act === 'admin-form') { adminForm = b.getAttribute('data-on') === '1'; refresh(); var fi = document.querySelector('[data-ai-card] input[type=password]'); if (fi) fi.focus(); }
    else if (act === 'cand') { var c = CANDS[+b.getAttribute('data-i')], kc = CANDS.keep; setRoster(c); remember(c, ENC.kdf.salt, kc); refresh(); }
    else if (act === 'st') {
      var id = location.hash.replace(/^#\/e\//, '').split('?')[0], p = prog(id);
      p.st = b.getAttribute('data-st'); setProg(id, p);
      b.parentNode.querySelectorAll('[data-ai="st"]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    }
    else if (act === 'dl-mine') dlMine().catch(function (e) { alertBox(e.message); });
    else if (act === 'dl-staff') dlStaff().catch(function (e) { alertBox(e.message); });
    else if (act === 'tpl') dlTemplate().catch(function (e) { admMsg(e.message, true); });
    else if (act === 'local') prepare().then(function (x) { adopt(x); admMsg('이 기기에만 적용했습니다. 다른 사람에게는 보이지 않습니다.'); }, function (e) { admMsg(e.message, true); });
    else if (act === 'enc-dl') prepare().then(function (x) { download('staff.enc.json', x.text); admMsg('암호화 파일을 받았습니다. accreditation-internal/data/ 에 같은 이름으로 올리면 됩니다.'); }, function (e) { admMsg(e.message, true); });
    else if (act === 'publish') {
      if (!ghToken()) { admMsg('관리자 설정에 GitHub 토큰을 먼저 저장해 주세요. 또는 암호화 파일을 받아 직접 올려 주세요.', true); return; }
      b.disabled = true;
      prepare().then(function (x) { admMsg('GitHub에 올리는 중…'); return ghPutStaff(x.text).then(function () { return x; }); })
        .then(function (x) { adopt(x); admMsg('올렸습니다. 사이트 반영까지 1~2분 걸립니다.' + (x.newPw ? ' 담당자 지정 관리자 비밀번호가 바뀌었습니다.' : '') + ' 담당자는 각자 전화번호 뒤 4자리로 들어갑니다.'); }, function (e) { admMsg(e.message || '올리지 못했습니다.', true); })
        .then(function () { b.disabled = false; });
    }
  });
  function alertBox(t) { var m = document.querySelector('[data-ai-card] .lock-msg') || document.getElementById('aiAdmMsg'); if (m) { m.textContent = t; m.classList.add('bad'); } }
  document.addEventListener('submit', function (ev) {
    var f = ev.target.closest('[data-ai-unlock]'); if (!f) return;
    ev.preventDefault();
    var inp = f.querySelector('input'), btn = f.querySelector('button'), m = f.parentNode.querySelector('.lock-msg');
    var keep = f.parentNode.querySelector('[data-ai-keep]'), inAdm = !!f.closest('#aiAdmin');
    if (!inp.value) { inp.focus(); return; }
    btn.disabled = true; m.textContent = '확인 중…'; m.classList.remove('bad');
    var kp = !keep || keep.checked, isTel = f.getAttribute('data-ai-unlock') === 'tel';
    if (isTel && !/^\d{4}$/.test(inp.value)) { m.textContent = '숫자 4자리를 넣어 주세요.'; m.classList.add('bad'); btn.disabled = false; inp.select(); return; }
    (isTel ? unlockStaff(inp.value) : unlockAdmin(inp.value).then(function (r) { return [r]; })).then(function (list) {
      if (list.length > 1) { CANDS = list; CANDS.keep = kp; R = null; refresh(); return; }
      adminForm = false;
      if (!list[0]) { R = null; MINE = {}; refresh(); return; }   // 관리자 확인됨, 아직 올린 명단 없음
      who = ''; setRoster(list[0]); if (list[0].personal) remember(list[0], ENC.kdf.salt, kp); refresh();
      if (inAdm) return;
      if (location.hash.indexOf('#/staff') === 0 && list[0].personal) location.hash = '#/';
      var nf = document.querySelector('[data-ai-card] [data-ai="pick"]'); if (nf) nf.focus();
    }, function (err) { m.textContent = err.message; m.classList.add('bad'); btn.disabled = false; inp.select(); });
  }, true);

  /* ---------- app.js 확장 연결점 ---------- */
  window.ACC_ROOT = window.ACC_ROOT == null ? '../accreditation/' : window.ACC_ROOT;
  window.ACC_EXT = {
    ready: function (api) { A = api; calcMine(); },
    visible: function (e) { return !mineOnly() || !!MINE[e.id]; },
    chips: chips,
    homeTop: homeTop,
    elementTop: elementTop,
    bindElement: bindElement,
    sideExtra: sideExtra,
    sideCount: sideCount,
    route: function (path) { if (path === '/staff') { viewStaff(); return true; } return false; }
  };
  renderSettings();
  loadEnc();
})();
