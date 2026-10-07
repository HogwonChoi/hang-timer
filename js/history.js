'use strict';
// 기록: 목록, 그래프, 상세(운동 빼기·삭제·메모)
/* ================= 기록 ================= */
// type 없는 예전 기록은 핑거보드
const logType = l => l.type || 'fb';
const logTitle = l => l.title ?? (l.routine === 2 ? '마무리' : '웜업'); // 이전 버전 기록은 루틴 번호만 있음
const TYPE_LABEL = { fb: 'Fingerboard', circuit: 'Circuit', ilv: 'ILV' };
let histFilter = 'all';

function logLine(l, time) {
  return logDetail(l, time) + (l.memo ? `<small class="log-memo">“${escapeHTML(l.memo)}”</small>` : '');
}
function logDetail(l, time) {
  const base = `${time} · ${l.sets}/${l.total}세트 · ${fmt(l.sec)}`;
  const chips = [];
  if (l.mm) chips.push(`${BOARDS[l.board]} · ${l.mm}mm`);
  if (l.weight) chips.push(weightLabel(l.weight));
  const chipHTML = chips.map(c => `<span class="chip">${c}</span>`).join('');
  switch (logType(l)) {
    case 'circuit':
      return `<small>${base}</small><small class="log-items">${(l.items || []).map(escapeHTML).join(' · ')}</small>`;
    case 'ilv':
      return `<small>${base} · 유지 ${l.holdSec}s · 턱걸이 ${l.pullSec}s</small>${chipHTML}`;
    default:
      return `<small>${base} · 매달리기 ${l.hang}초</small>${chipHTML}`;
  }
}

function renderHistory() {
  document.querySelectorAll('[data-hf]').forEach(b => b.classList.toggle('active', b.dataset.hf === histFilter));
  const all = readLog();
  const log = histFilter === 'all' ? all : all.filter(l => logType(l) === histFilter);
  const now = new Date();
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // 월요일 시작
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const done = log.filter(l => l.completed);
  $('h-week').textContent = done.filter(l => l.ts >= weekStart).length;
  $('h-month').textContent = done.filter(l => l.ts >= monthStart).length;
  $('h-all').textContent = done.length;
  $('charts').innerHTML = done.length ? chartsHTML(done, weekStart) : '';

  if (!log.length) { $('log-list').innerHTML = '<p class="empty">아직 기록이 없어요</p>'; return; }
  let html = '', lastDay = '';
  for (const l of log) {
    const d = new Date(l.ts);
    const day = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    if (day !== lastDay) { html += `<div class="log-day">${day}</div>`; lastDay = day; }
    const time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
    const kind = histFilter === 'all' ? `<span class="log-kind">${TYPE_LABEL[logType(l)]}</span>` : '';
    html += `<button class="log-item" data-ts="${l.ts}"><div class="log-main">${kind}<b>${escapeHTML(logTitle(l))}</b>${logLine(l, time)}</div>
      <span class="chip ${l.completed ? 'badge-ok' : 'badge-stop'}">${l.completed ? '완료' : '중단'}</span></button>`;
  }
  $('log-list').innerHTML = html;
}

/* ---------- 기록 상세: 메모 수정 / 서킷 운동 빼기 / 기록 삭제 ---------- */
let openLog = null; // { ts, keep:Set }

function renderLogModal() {
  const l = readLog().find(x => x.ts === openLog.ts);
  const d = new Date(l.ts);
  $('lm-kind').textContent = TYPE_LABEL[logType(l)];
  $('lm-title').textContent = logTitle(l);
  $('lm-meta').innerHTML = `${d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} `
    + `${d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}<br>${l.sets}/${l.total}세트 · ${fmt(l.sec)}`
    + (l.weight ? ` · ${weightLabel(l.weight)}` : '') + (l.mm ? ` · ${BOARDS[l.board]} ${l.mm}mm` : '');
  const isCx = logType(l) === 'circuit';
  $('lm-body').innerHTML = isCx
    ? '<p class="lm-hint">안 한 운동은 눌러서 빼세요</p>' + (l.items || []).map((n, k) => `
      <button class="cx-row lm-row ${openLog.keep.has(k) ? '' : 'off'}" data-k="${k}">
        <span class="cx-box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>${escapeHTML(n)}</button>`).join('')
    : '';
}

$('log-list').addEventListener('click', e => {
  const b = e.target.closest('[data-ts]');
  if (!b) return;
  const l = readLog().find(x => x.ts === +b.dataset.ts);
  if (!l) return;
  openLog = { ts: l.ts, keep: new Set((l.items || []).map((_, k) => k)) };
  $('lm-memo').value = l.memo || '';
  renderLogModal();
  $('log-modal').hidden = false;
});
$('lm-body').addEventListener('click', e => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  const k = +b.dataset.k;
  if (openLog.keep.has(k)) openLog.keep.delete(k); else openLog.keep.add(k);
  renderLogModal();
});
const closeLogModal = () => { $('log-modal').hidden = true; openLog = null; renderHistory(); };
$('lm-close').addEventListener('click', closeLogModal);
$('lm-save').addEventListener('click', () => {
  const log = readLog();
  const l = log.find(x => x.ts === openLog.ts);
  const memo = $('lm-memo').value.trim();
  if (memo) l.memo = memo; else delete l.memo;
  if (logType(l) === 'circuit') {
    const items = l.items.filter((_, k) => openLog.keep.has(k));
    if (!items.length) {
      if (!confirm('운동을 모두 뺐어요. 이 기록을 삭제할까요?')) return;
      writeLog(log.filter(x => x.ts !== openLog.ts));
      return closeLogModal();
    }
    l.items = items;
  }
  writeLog(log);
  closeLogModal();
});
$('lm-del').addEventListener('click', () => {
  if (!confirm('이 기록을 삭제할까요?')) return;
  writeLog(readLog().filter(x => x.ts !== openLog.ts));
  closeLogModal();
});

// 완료한 운동만 집계: 최근 8주 주별 횟수 + 종류별 세부 그래프
function chartsHTML(done, weekStart) {
  const WEEK = 7 * 86400000;
  const weeks = Array.from({ length: 8 }, (_, k) => {
    const start = weekStart.getTime() - (7 - k) * WEEK;
    const n = done.filter(l => l.ts >= start && l.ts < start + WEEK).length;
    const d = new Date(start);
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, n, now: k === 7 };
  });
  const maxW = Math.max(1, ...weeks.map(w => w.n));
  const weekBars = weeks.map(w => `
    <div class="vbar ${w.now ? 'now' : ''}"><span class="vbar-n">${w.n || ''}</span>
      <i style="height:${(w.n / maxW) * 100}%"></i><span class="vbar-l">${w.now ? '이번 주' : w.label}</span></div>`).join('');

  const tally = keysOf => {
    const m = new Map();
    for (const l of done) for (const k of [].concat(keysOf(l) || [])) m.set(k, (m.get(k) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const hbars = rows => {
    const max = Math.max(1, ...rows.map(r => r[1]));
    return rows.map(([k, n]) => `<div class="hbar"><span class="hbar-k">${escapeHTML(k)}</span>
      <span class="hbar-track"><i style="width:${(n / max) * 100}%"></i></span><b>${n}회</b></div>`).join('');
  };
  const card = (label, rows, empty) => `<section class="card chart"><div class="label">${label}</div>
    ${rows.length ? hbars(rows) : `<p class="chart-empty">${empty}</p>`}</section>`;

  let detail;
  if (histFilter === 'all') detail = card('종류별 횟수', tally(l => TYPE_LABEL[logType(l)]), '');
  else if (histFilter === 'fb') {
    detail = card('루틴별 횟수', tally(logTitle), '')
      + card('홀드별 횟수', tally(l => (l.mm ? `${BOARDS[l.board]} ${l.mm}mm` : null)), '운동을 마치고 홀드를 고르면 여기에 쌓여요');
  } else if (histFilter === 'circuit') detail = card('운동별 횟수', tally(l => l.items), '');
  else detail = weightTrendHTML(done) + card('중량별 횟수', tally(l => weightLabel(l.weight || 0)), '');

  return `<section class="card chart"><div class="label">주별 운동 횟수</div><div class="vbars">${weekBars}</div></section>${detail}`;
}

$('hist-filter').addEventListener('click', e => {
  const b = e.target.closest('[data-hf]');
  if (b) { histFilter = b.dataset.hf; renderHistory(); }
});
$('btn-history').addEventListener('click', () => { renderHistory(); show('history'); });
$('btn-back').addEventListener('click', () => show('setup'));
$('btn-clear').addEventListener('click', () => {
  if (confirm('기록을 모두 삭제할까요?')) { localStorage.removeItem(LOG_KEY); renderHistory(); }
});

// ILV 중량 변화: 최근 12번을 날짜순 꺾은선으로
function weightTrendHTML(done) {
  const pts = done.slice(0, 12).reverse().map(l => ({ w: l.weight || 0, d: new Date(l.ts) }));
  if (pts.length < 2) return '<section class="card chart"><div class="label">중량 변화</div><p class="chart-empty">2번 이상 하면 변화가 그려져요</p></section>';
  const W = 320, H = 130, PX = 22, PT = 22, PB = 26;
  const ws = pts.map(p => p.w);
  let lo = Math.min(...ws), hi = Math.max(...ws);
  if (hi - lo < 5) { const mid = (hi + lo) / 2; lo = mid - 2.5; hi = mid + 2.5; } // 변화가 작아도 납작하지 않게
  const x = i => PX + (i * (W - PX * 2)) / (pts.length - 1);
  const y = w => PT + ((hi - w) * (H - PT - PB)) / (hi - lo);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ');
  const dots = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.w).toFixed(1)}" r="4" fill="var(--hang)" stroke="none"/>`
    + `<text x="${x(i).toFixed(1)}" y="${(y(p.w) - 9).toFixed(1)}" text-anchor="middle" class="wt-v">${p.w > 0 ? '+' : ''}${p.w}</text>`
    + `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="wt-d">${p.d.getMonth() + 1}/${p.d.getDate()}</text>`).join('');
  return `<section class="card chart"><div class="label">중량 변화 (kg, 최근 ${pts.length}번)</div>
    <svg class="wt-chart" viewBox="0 0 ${W} ${H}"><polyline points="${line}" fill="none" stroke="var(--hang)" stroke-width="2.5"/>${dots}</svg></section>`;
}
