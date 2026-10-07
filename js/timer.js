'use strict';
// 타이머 엔진 (핑거보드 · ILV 공용), 완료 화면, 화면 꺼짐 감지
/* ================= 타이머 (핑거보드 · ILV 공용) ================= */
const RING = 2 * Math.PI * 90;
const countEl = $('count');
const ringEl = $('ring');
let run = null; // { kind, steps, totalSets, i, end, remain, paused, lastSec, startedAt, setsDone, cfg, title }
const ACTIVE = t => t === 'hang' || t === 'hold'; // 매달려 버티는 단계

function start() {
  unlockAudio();
  if (settings.tab === 'circuit') return startCircuit();
  lockScreen();
  let built, title;
  if (settings.tab === 'ilv') {
    built = buildIlvSteps(settings);
    title = 'ILV Pull-up';
  } else {
    const rt = getRoutine(settings.routine);
    built = buildSteps(rt.items, settings);
    title = rt.title;
  }
  run = { kind: settings.tab, ...built, i: -1, paused: false, startedAt: Date.now(), setsDone: 0, cfg: { ...settings }, title };
  $('run-routine').textContent = title;
  show('run');
  warmUpSound();
  enterStep(0, performance.now());
  loop();
}

// 아이폰은 첫 소리가 늦게 나는 경우가 있어서, 시작 준비 때 작은 소리로 미리 깨워둔다
function warmUpSound() {
  if (voiceOn()) say('Get ready');
  else tone(880, 0.05, 0.12, 0.1, 'square');
}

function enterStep(i, at) {
  const st = run.steps[i];
  run.i = i;
  run.end = at + st.dur * 1000;
  run.lastSec = st.dur;
  run.lastTick = performance.now();
  countEl.textContent = st.dur;
  countEl.classList.remove('last');
  document.body.dataset.phase = st.type;
  $('screen-tip').hidden = st.type !== 'prep';
  renderStep();
}

function renderStep() {
  if (run.kind === 'ilv') return renderIlvStep();
  const { steps, i, totalSets } = run;
  const st = steps[i];
  // 휴식/준비 중에는 다음 매달리기 그립을 미리 보여줌
  const focus = st.type === 'hang' ? st : steps.slice(i + 1).find(s => s.type === 'hang') || st;
  $('phase').textContent = PHASE_LABEL[st.type];
  $('run-count').textContent = `세트 ${Math.max(focus.set, 1)} / ${totalSets}`;
  $('grip-art').innerHTML = handSVG(focus.fingers, focus.side, focus.grip);
  $('grip-tag').textContent = st.type === 'hang' ? '지금' : '다음';
  $('grip-hands').textContent = SIDE_LABEL[focus.side] + (focus.reps > 1 ? ` · ${focus.rep}/${focus.reps}` : '');
  $('grip-name').textContent = exName(focus);
  $('grip-sub').textContent = exSub(focus);

  const nextHang = steps.slice(i + 1).find(s => s.type === 'hang' && s !== focus);
  const after = steps.slice(steps.indexOf(focus) + 1).find(s => s.type === 'hang');
  if (st.type === 'hang') {
    const nx = steps[i + 1];
    $('next').textContent = !nx ? '마지막 세트!'
      : nx.type === 'switch' ? `다음 · 손 바꾸기 ${nx.dur}초 → 오른손`
      : `다음 · 휴식 ${nx.dur}초 → ${nextHang ? exName(nextHang) : ''}`;
  } else {
    $('next').textContent = after ? `그다음 · ${SIDE_LABEL[after.side]} ${exName(after)}` : '이번이 마지막 세트';
  }
  $('progress-bar').style.width = `${(run.setsDone / totalSets) * 100}%`;
}

// ILV 화면: 원 안에 I/L/V, 아래에 1세트 순서 중 현재 위치 표시
const poseSVG = p => '<svg class="art grip-icon" viewBox="0 0 64 64">' +
  '<circle cx="32" cy="32" r="30" fill="#1F2229" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>' +
  `<text x="32" y="33" dy=".34em" text-anchor="middle" stroke="none" font-size="34" font-weight="800"` +
  ` font-family="system-ui,-apple-system,sans-serif" style="fill:var(--accent,#FF5B4A)">${p}</text></svg>`;

function renderIlvStep() {
  const { steps, i, totalSets } = run;
  const st = steps[i];
  const nx = steps[i + 1];
  $('phase').textContent = PHASE_LABEL[st.type];
  $('run-count').textContent = `세트 ${st.set} / ${totalSets}`;
  $('grip-art').innerHTML = poseSVG(st.pose);
  $('grip-tag').textContent = st.type === 'hold' ? '지금' : '다음';
  $('grip-hands').textContent = `${st.idx + 1} / ${ILV_ORDER.length}`;
  $('grip-name').textContent = st.type === 'hold' ? `${POSE_NAME[st.pose]} ${st.dur}초`
    : st.type === 'pull' ? `턱걸이 1개 → ${POSE_NAME[st.pose]}`
    : `턱걸이 1개 → ${POSE_NAME[st.pose]}부터`;
  $('grip-sub').innerHTML = ILV_ORDER.map((p, k) =>
    `<span class="seq ${k === st.idx ? 'cur' : k < st.idx || (st.type === 'hold' && k === st.idx) ? 'past' : ''}">${p}</span>`).join(' ');
  $('next').textContent = st.type === 'hold'
    ? (!nx ? '마지막 자세!' : nx.type === 'rest' ? `세트 끝 · 휴식 ${nx.dur}초` : `다음 · 턱걸이 1개 → ${POSE_NAME[nx.pose]}`)
    : st.type === 'pull' ? `올라가서 ${POSE_NAME[st.pose]} ${run.cfg.ilvHold}초 버티기`
    : st.type === 'rest' ? '휴식 끝나면 턱걸이 1개부터' : '시작하면 턱걸이 1개부터';
  $('progress-bar').style.width = `${(run.setsDone / totalSets) * 100}%`;
}

// 턱걸이 단계 시작 신호: 짧은 비프 (음성 모드는 "Pull up, L sit")
function pullCue(pose) {
  if (voiceOn()) say(`Pull up, ${POSE_SAY[pose]}`, 1.2);
  else tone(587, 0, 0.28, 0.3, 'square'); // 카운트다운(880Hz)보다 낮은 음으로 구분
}

function tick() {
  if (!run || run.paused) return;
  const now = performance.now();
  // 화면 꺼짐 이벤트 없이 앱이 멈췄다 돌아온 경우(3초 넘게 틱이 끊김): 그 시간은 멈춘 것으로 치고 물어본다
  if (run.lastTick && now - run.lastTick > 3000) {
    run.end += now - run.lastTick;
    run.lastTick = now;
    return interrupted();
  }
  run.lastTick = now;
  while (now >= run.end) {
    const st = run.steps[run.i];
    if (st.countsSet) run.setsDone++;
    const nextI = run.i + 1;
    if (nextI >= run.steps.length) return finish(true);
    const late = now - run.end > 1000;
    if (!late) {
      const nx = run.steps[nextI];
      if (ACTIVE(st.type) && nx.type !== 'pull') sound.stop();   // 버티기 끝 "뚜우~"
      if (ACTIVE(nx.type)) sound.go();                           // 버티기 시작 "띠이~"
      else if (nx.type === 'pull') pullCue(nx.pose);              // 턱걸이 "뚜"
    }
    enterStep(nextI, run.end);
  }
  const remain = (run.end - now) / 1000;
  const sec = Math.ceil(remain);
  const st = run.steps[run.i];
  const cdOn = st.type !== 'pull' && sec <= settings.cd; // 짧은 턱걸이 단계는 카운트다운 소리 없음
  setLight(st.type === 'pull' ? '' : lightFor(sec));
  // 숫자·소리는 초가 바뀔 때만 갱신, 링은 매 프레임 부드럽게
  if (sec !== run.lastSec) {
    run.lastSec = sec;
    countEl.textContent = sec;
    countEl.classList.toggle('last', cdOn);
    if (st.type === 'rest') restTenCue(sec, st.dur);
    if (cdOn && sec >= 1) {
      countdown(sec);
      countEl.classList.remove('beat'); void countEl.offsetWidth; countEl.classList.add('beat');
    }
  }
  ringEl.style.strokeDashoffset = RING * (1 - remain / st.dur);
}

// 휴식이 10초 남았을 때 "삐삐" 두 번 (분필·자세 준비용). 휴식이 짧으면 생략
function restTenCue(sec, dur) {
  if (sec !== 10 || dur < 15) return;
  if (voiceOn()) say('Ten seconds');
  else { tone(1175, 0, 0.12, 0.25, 'square'); tone(1175, 0.2, 0.12, 0.25, 'square'); }
  vibrate([80, 80, 80]);
}

let raf = 0, iv = 0;
function loop() {
  cancelAnimationFrame(raf); clearInterval(iv);
  const frame = () => { tick(); if (run) raf = requestAnimationFrame(frame); };
  raf = requestAnimationFrame(frame);
  iv = setInterval(tick, 250); // 화면 프레임이 멈춰도 소리 타이밍 유지
}

function stopLoop() { cancelAnimationFrame(raf); clearInterval(iv); }

function togglePause() {
  if (!run) return;
  const now = performance.now();
  if (run.paused) {
    run.end = now + run.remain;
    run.lastTick = now;
    run.paused = false;
    $('btn-pause').textContent = '일시정지';
    $('phase').textContent = PHASE_LABEL[run.steps[run.i].type];
    document.body.classList.remove('paused');
  } else {
    run.remain = run.end - now;
    run.paused = true;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    $('btn-pause').textContent = '계속';
    $('phase').textContent = 'PAUSED';
    document.body.classList.add('paused');
  }
}

// 분필 묻은 손으로 버튼 찾기 어려우니 화면 아무 데나 두 번 탭하면 일시정지/계속 (한 번 탭은 실수 방지로 무시)
let lastTap = 0;
$('run').addEventListener('pointerup', e => {
  if (!run || e.target.closest('button, .modal')) return;
  const t = performance.now();
  if (t - lastTap < 350) { togglePause(); vibrate(40); lastTap = 0; } else lastTap = t;
});

function skip() {
  if (!run) return;
  const st = run.steps[run.i];
  if (st.countsSet) run.setsDone++;
  const nextI = run.i + 1;
  if (nextI >= run.steps.length) return finish(true);
  if (run.paused) togglePause();
  if (ACTIVE(run.steps[nextI].type)) sound.go();
  enterStep(nextI, performance.now());
}

function finish(completed) {
  stopLoop();
  releaseScreen();
  const r = run;
  run = null;
  document.body.classList.remove('paused');
  $('btn-pause').textContent = '일시정지';
  const elapsed = Math.round((Date.now() - r.startedAt) / 1000);
  const entry = { ts: Date.now(), type: r.kind, title: r.title, sets: r.setsDone, total: r.totalSets, sec: elapsed, completed };
  if (r.kind === 'ilv') Object.assign(entry, { holdSec: r.cfg.ilvHold, pullSec: r.cfg.ilvPull });
  else entry.hang = r.cfg.hang;
  logSession(entry);
  if (!completed) return backToMain();
  sound.done();
  vibrate([200, 100, 200]);
  showDone(r.kind, r.title, elapsed, r.setsDone,
    r.kind === 'ilv' ? [`${r.cfg.ilvHold}s`, '자세 유지'] : [`${r.cfg.hang}s`, '매달리기']);
}

// 1세트라도 했으면 기록. 완료 화면에서 중량·홀드를 덧붙이려고 ts 를 기억해 둔다
function logSession(entry) {
  doneTs = null;
  if (entry.sets <= 0) return;
  doneTs = entry.ts;
  writeLog([entry, ...readLog()]);
}

// 신호등: 평소 초록 → 3초 남으면 노랑 → 1초 남으면 빨강 (링·숫자·화면 테두리 색)
const lightFor = sec => (sec <= 1 ? 'red' : sec <= 3 ? 'yellow' : 'green');
function setLight(l) { if (document.body.dataset.light !== l) document.body.dataset.light = l; }

function backToMain() { setLight(''); document.body.dataset.phase = 'idle'; show('setup'); }

// 완료 화면: 핑거보드는 중량+홀드, ILV는 중량만, 서킷은 둘 다 없음
let doneKind = 'fb';
function showDone(kind, title, elapsed, sets, [third, thirdLabel]) {
  doneKind = kind;
  setLight('');
  document.body.dataset.phase = 'done';
  $('done-sub').textContent = title;
  $('d-time').textContent = fmt(elapsed);
  $('d-sets').textContent = sets;
  $('d-hang').textContent = third;
  $('d-hang-l').textContent = thirdLabel;
  $('weight-row').hidden = kind === 'circuit';
  $('hold-pick').hidden = kind !== 'fb';
  $('memo').value = '';
  renderHold();
  renderWeight();
  show('done');
}

/* ================= 완료 후 홀드 선택 (보드 그림 터치) ================= */
let doneTs = null;
const findHold = (board, id) => (BOARD_HOLDS[board] || []).find(h => h.id === id);
function renderHold() {
  $('board-seg').innerHTML = Object.entries(BOARDS).map(([k, name]) =>
    `<button class="seg ${k === settings.board ? 'active' : ''}" data-board="${k}">${name}</button>`).join('');
  $('board-art').innerHTML = boardSVG(settings.board, settings.hold);
  const h = findHold(settings.board, settings.hold);
  $('hold-sel').innerHTML = h ? `선택: <b>${BOARDS[settings.board]} · ${h.mm}mm</b>` : '사용한 홀드를 눌러주세요 (선택 안 해도 돼요)';
}
$('board-seg').addEventListener('click', e => {
  const b = e.target.closest('[data-board]');
  if (!b) return;
  settings.board = b.dataset.board;
  if (!findHold(settings.board, settings.hold)) settings.hold = null;
  saveSettings(); renderHold();
});
$('board-art').addEventListener('click', e => {
  const g = e.target.closest('[data-hold]');
  if (!g) return;
  settings.hold = settings.hold === g.dataset.hold ? null : g.dataset.hold; // 다시 누르면 선택 해제
  saveSettings(); renderHold();
});
// 완료 화면에서 고른 홀드·중량·메모를 방금 저장한 기록에 덧붙인다
function saveDoneExtras() {
  if (!doneTs) return;
  const log = readLog();
  const entry = log.find(l => l.ts === doneTs);
  if (!entry) return;
  const h = findHold(settings.board, settings.hold);
  if (h && doneKind === 'fb') { entry.board = settings.board; entry.mm = h.mm; entry.hold = h.id; }
  if (doneKind !== 'circuit') entry.weight = settings.weight;
  const memo = $('memo').value.trim();
  if (memo) entry.memo = memo;
  writeLog(log);
}

/* ================= 완료 후 추가 중량 ================= */
const weightLabel = w => (w === 0 ? '맨몸' : `${w > 0 ? '+' : '−'}${Math.abs(w)}kg`);
const renderWeight = () => { $('v-weight').textContent = weightLabel(settings.weight); };
[['btn-w-minus', -2.5], ['btn-w-plus', 2.5]].forEach(([id, d]) => $(id).addEventListener('click', () => {
  settings.weight = Math.min(40, Math.max(-40, settings.weight + d));
  saveSettings(); renderWeight();
}));

$('btn-start').addEventListener('click', start);
$('btn-pause').addEventListener('click', togglePause);
$('btn-skip').addEventListener('click', skip);
$('btn-stop').addEventListener('click', () => {
  if (!run.paused) togglePause();
  if (confirm('운동을 종료할까요?')) finish(false);
});
$('btn-done').addEventListener('click', () => { saveDoneExtras(); backToMain(); });


// 화면이 꺼지거나 앱을 벗어나면 소리가 멈추므로 자동 일시정지 → 돌아오면 이어갈지 물어본다
function interrupted() {
  if (!run) return;
  if (!run.paused) togglePause();
  $('resume-modal').hidden = false;
}
document.addEventListener('visibilitychange', () => {
  if (!run) return;
  if (document.visibilityState === 'hidden') {
    if (!run.paused) { togglePause(); run.autoPaused = true; }
  } else {
    lockScreen();
    if (ctx) ctx.resume();
    if (run.autoPaused) { run.autoPaused = false; interrupted(); }
  }
});
$('btn-resume').addEventListener('click', () => {
  $('resume-modal').hidden = true;
  if (run && run.paused) togglePause();
});
$('btn-restart-step').addEventListener('click', () => {
  $('resume-modal').hidden = true;
  if (!run) return;
  if (run.paused) togglePause();
  enterStep(run.i, performance.now());
});
