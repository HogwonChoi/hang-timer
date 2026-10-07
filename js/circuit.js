'use strict';
// 서킷: 체크리스트 + 세트 사이 휴식 타이머, 운동 목록 편집
/* ================= 서킷 (체크리스트 + 세트 사이 휴식 타이머) ================= */
let cx = null; // { items, sets, set, checked:Set, resting, restEnd, lastSec, iv, startedAt }

function startCircuit() {
  lockScreen();
  cx = { items: [...settings.cSel], sets: settings.cSets, set: 1, checked: new Set(), resting: false, startedAt: Date.now() };
  show('circuit');
  renderCircuit();
}

function renderCircuit() {
  document.body.dataset.phase = cx.resting ? 'rest' : 'hang';
  $('cx-count').textContent = `세트 ${cx.set} / ${cx.sets}`;
  $('cx-phase').textContent = cx.resting ? 'REST' : 'WORK';
  $('cx-check').hidden = cx.resting;
  $('cx-rest').hidden = !cx.resting;
  $('cx-check').innerHTML = cx.items.map((n, k) => `
    <li><button class="cx-row ${cx.checked.has(k) ? 'on' : ''}" data-k="${k}">
      <span class="cx-box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>${escapeHTML(n)}</button></li>`).join('');
  const done = cx.set - 1 + (cx.resting ? 1 : cx.checked.size / cx.items.length);
  $('cx-progress').style.width = `${(done / cx.sets) * 100}%`;
}

$('cx-check').addEventListener('click', e => {
  const b = e.target.closest('[data-k]');
  if (!b || !cx) return;
  const k = +b.dataset.k;
  if (cx.checked.has(k)) cx.checked.delete(k); else cx.checked.add(k);
  if (cx.checked.size === cx.items.length) {
    if (cx.set >= cx.sets) return finishCircuit(true);
    vibrate(200);
    startCxRest();
  }
  renderCircuit();
});

function startCxRest() {
  cx.resting = true;
  cx.restEnd = performance.now() + settings.cRest * 60000;
  cx.lastSec = null;
  $('cx-rest-next').textContent = `다음 · 세트 ${cx.set + 1} / ${cx.sets}`;
  clearInterval(cx.iv);
  cx.iv = setInterval(cxRestTick, 250);
  cxRestTick();
}

function cxRestTick() {
  const remain = (cx.restEnd - performance.now()) / 1000;
  if (remain <= 0) { sound.go(); return nextCxSet(); }
  const sec = Math.ceil(remain);
  setLight(lightFor(sec));
  if (sec !== cx.lastSec) {
    $('cx-rest-time').textContent = fmt(sec);
    if (cx.lastSec !== null) {
      restTenCue(sec, settings.cRest * 60);
      if (sec <= settings.cd) countdown(sec);
    }
    cx.lastSec = sec;
  }
}

function nextCxSet() {
  clearInterval(cx.iv);
  setLight('');
  cx.set++;
  cx.checked.clear();
  cx.resting = false;
  renderCircuit();
}

function finishCircuit(completed) {
  clearInterval(cx.iv);
  setLight('');
  releaseScreen();
  const c = cx;
  cx = null;
  const sets = completed ? c.sets : c.set - 1 + (c.resting ? 1 : 0);
  const elapsed = Math.round((Date.now() - c.startedAt) / 1000);
  logSession({ ts: Date.now(), type: 'circuit', title: 'Circuit', items: c.items, sets, total: c.sets, sec: elapsed, completed });
  if (!completed) return backToMain();
  sound.done();
  vibrate([200, 100, 200]);
  showDone('circuit', `Circuit · ${c.items.length}개 운동`, elapsed, sets, [`${c.items.length}개`, '운동']);
}

$('btn-cx-skip').addEventListener('click', () => { if (cx) nextCxSet(); });
$('btn-cx-stop').addEventListener('click', () => {
  if (cx && confirm('서킷을 종료할까요? 끝낸 세트까지만 기록돼요')) finishCircuit(false);
});

/* ---------- 서킷 운동 목록 편집 ---------- */
function renderCxEditor() {
  $('cx-list').innerHTML = cxList.map((n, k) => `
    <li class="ed-item cx-item" data-i="${k}">
      <div class="ed-main"><div class="ed-name">${escapeHTML(n)}</div></div>
      <div class="ed-move">
        <button data-act="up" aria-label="위로" ${k === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button>
        <button data-act="down" aria-label="아래로" ${k === cxList.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
      </div>
      <button class="ed-del" data-act="del" aria-label="삭제"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg></button>
    </li>`).join('');
}
$('btn-cx-edit').addEventListener('click', () => { renderCxEditor(); show('cx-editor'); });
$('btn-cx-back').addEventListener('click', () => { renderSetup(); show('setup'); });
$('btn-cx-add').addEventListener('click', () => {
  const n = $('cx-new').value.trim();
  if (!n) return;
  if (cxList.includes(n)) { alert('이미 있는 운동이에요'); return; }
  cxList.push(n);
  saveCx();
  $('cx-new').value = '';
  renderCxEditor();
});
$('cx-new').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-cx-add').click(); });
$('cx-list').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const i = +b.closest('[data-i]').dataset.i;
  const act = b.dataset.act;
  if (act === 'up' && i > 0) [cxList[i - 1], cxList[i]] = [cxList[i], cxList[i - 1]];
  if (act === 'down' && i < cxList.length - 1) [cxList[i + 1], cxList[i]] = [cxList[i], cxList[i + 1]];
  if (act === 'del') cxList.splice(i, 1);
  saveCx();
  renderCxEditor();
});
