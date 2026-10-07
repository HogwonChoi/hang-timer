'use strict';

/* ================= 운동 정의 ================= */
// fingers: i=검지 m=중지 r=약지 p=새끼
const EX = {
  half4: { name: '4봉 하프크림프', grip: 'half', fingers: 'imrp' },
  open3: { name: '3봉 오픈크림프', grip: 'open', fingers: 'imr' },
  full4: { name: '4봉 풀크림프', grip: 'full', fingers: 'imrp' },
  full3: { name: '3봉 풀크림프', grip: 'full', fingers: 'imr' },
};
const GRIP_EN = { half: 'Half Crimp', open: 'Open Crimp', full: 'Full Crimp' };

// 완료 후 선택하는 홀드 (보드별 깊이 mm)
const BOARDS = {
  bm1000: { name: 'BM 1000', mm: [15, 20, 25, 45, 50, 53] },
  bm2000: { name: 'BM 2000', mm: [15, 20, 22, 26, 30, 33, 35, 40, 45, 50, 53] },
  crimp: { name: '크림프', mm: [6, 8, 10] },
};

// one: 한손 세트(왼손 → 손 바꾸기 → 오른손)
const ROUTINES = {
  1: {
    title: '웜업',
    items: [
      { ex: 'half4', reps: 1 }, { ex: 'open3', reps: 1 },
      { ex: 'full4', reps: 1 }, { ex: 'full3', reps: 1 },
      { ex: 'half4', reps: 1, one: true }, { ex: 'open3', reps: 1, one: true },
    ],
  },
  2: {
    title: '마무리',
    items: [
      { ex: 'half4', reps: 2 }, { ex: 'open3', reps: 2 },
      { ex: 'full4', reps: 2 }, { ex: 'full3', reps: 2 },
      { ex: 'half4', reps: 1, one: true }, { ex: 'open3', reps: 1, one: true },
    ],
  },
};

const SET_LEN = 60;
const PHASE_LABEL = { prep: 'GET READY', hang: 'HANG', rest: 'REST', switch: 'SWITCH HANDS' };
const SIDE_LABEL = { both: '양손', L: '왼손', R: '오른손' };

/* ================= 설정 저장 ================= */
const SETTINGS_KEY = 'hang-settings';
const LOG_KEY = 'hang-log';
const settings = Object.assign(
  { routine: 1, hang: 20, sw: 10, prep: 10, sound: 'beep', cd: 5, listOpen: false, board: 'bm2000', mm: null },
  JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
);
delete settings.voice; // 이전 버전 설정값 정리
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

/* ================= 시퀀스 생성 ================= */
function buildSteps({ routine, hang, sw, prep }) {
  const sets = [];
  for (const item of ROUTINES[routine].items) {
    for (let r = 1; r <= item.reps; r++) sets.push({ ...item, rep: r });
  }
  const steps = [{ type: 'prep', dur: prep, set: 0 }];
  sets.forEach((s, i) => {
    const base = { ex: s.ex, rep: s.rep, reps: s.reps, set: i + 1 };
    if (s.one) {
      steps.push({ ...base, type: 'hang', dur: hang, side: 'L' });
      steps.push({ ...base, type: 'switch', dur: sw, side: 'L' });
      steps.push({ ...base, type: 'hang', dur: hang, side: 'R' });
    } else {
      steps.push({ ...base, type: 'hang', dur: hang, side: 'both' });
    }
    if (i < sets.length - 1) steps.push({ ...base, type: 'rest', dur: SET_LEN - hang });
  });
  return { steps, totalSets: sets.length };
}

/* ================= 소리 ================= */
let ctx = null;
function unlockAudio() {
  if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iOS 무음 스위치 무시
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  // iOS 음성 잠금 해제용 무음 발화
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

function tone(freq, start, dur, vol = 0.5, type = 'sine') {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter(); // 사각파의 거친 고음만 살짝 깎아 전자 타이머 느낌
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.frequency.value = 5000;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  gain.gain.setValueAtTime(vol, t + dur - 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// IFSC 공식 타이머 규격 주파수: 낮은음 880Hz, 높은음 1760Hz
const sound = {
  beep: () => tone(880, 0, 0.2, 0.3, 'square'),                               // 카운트다운 "뚜"
  stop: () => { tone(880, 0, 1.1, 0.3, 'square'); vibrate(700); },            // 매달리기 종료 "뚜우~~"
  go: () => { tone(1760, 0, 0.8, 0.22, 'square'); vibrate(250); },            // 매달리기 시작 "띠이~"
  done: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.32, 0.45, 'triangle')),
};

let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  voice = vs.find(v => /Samantha|Google US English/.test(v.name))
    || vs.find(v => v.lang === 'en-US') || vs[0] || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function countdown(n) {
  if (settings.sound === 'voice' && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(['', 'One', 'Two', 'Three', 'Four', 'Five'][n]);
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    u.rate = 1.15;
    speechSynthesis.speak(u);
  } else {
    sound.beep();
  }
}

// 설정 화면 "들어보기": 카운트다운 → 종료음 → 시작음
let previewTimers = [];
function preview() {
  unlockAudio();
  previewTimers.forEach(clearTimeout);
  const { cd } = settings;
  previewTimers = [];
  for (let n = cd; n >= 1; n--) previewTimers.push(setTimeout(() => countdown(n), (cd - n) * 1000));
  previewTimers.push(setTimeout(sound.stop, cd * 1000));
  previewTimers.push(setTimeout(sound.go, cd * 1000 + 1800));
}

function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }

/* ================= 화면 꺼짐 방지 ================= */
let wakeLock = null;
async function lockScreen() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* 미지원 브라우저 */ }
}
function releaseScreen() { if (wakeLock) wakeLock.release(); wakeLock = null; }

/* ================= DOM ================= */
const $ = id => document.getElementById(id);
const screens = ['setup', 'settings', 'run', 'done', 'history'];
function show(name) {
  screens.forEach(s => { $(s).hidden = s !== name; });
  window.scrollTo(0, 0);
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/* ================= 그립 그림 ================= */
// 앞에서 본 손: 보드 엣지에 걸린 손가락(흰색), 안 쓰는 손가락은 접혀서 흐리게
const FINGER_X = [['p', 8], ['r', 17.5], ['m', 27], ['i', 36.5]];
function handSVG(fingers, side) {
  const hands = side === 'both' ? ['L', 'R'] : [side === 'R' ? 'R' : 'L'];
  const CW = 50, GAP = 10;
  const W = hands.length * CW + (hands.length - 1) * GAP;
  let body = '';
  hands.forEach((h, k) => {
    const ox = k * (CW + GAP);
    const X = x => (h === 'L' ? ox + x : ox + CW - x);
    for (const [f, cx] of FINGER_X) {
      const on = fingers.includes(f);
      const top = on ? 10 : 27;
      body += `<rect class="${on ? 'h-on' : 'h-off'}" x="${X(cx) - 3}" y="${top}" width="6" height="${44 - top}" rx="3"/>`;
    }
    body += `<rect class="h-on" x="${h === 'L' ? ox + 4.5 : ox + CW - 40}" y="36" width="35.5" height="26" rx="11"/>`;
    body += `<line class="h-thumb" x1="${X(36)}" y1="56" x2="${X(45)}" y2="45"/>`;
  });
  body += `<rect class="h-board" x="-4" y="5" width="${W + 8}" height="13" rx="4"/>`;
  return `<svg class="art" viewBox="-5 0 ${W + 10} 64">${body}</svg>`;
}

/* ================= 설정 화면 ================= */
function renderSetup() {
  document.querySelectorAll('[data-routine]').forEach(b => b.classList.toggle('active', +b.dataset.routine === settings.routine));
  document.querySelectorAll('[data-sound]').forEach(b => b.classList.toggle('active', b.dataset.sound === settings.sound));
  document.querySelectorAll('[data-cd]').forEach(b => b.classList.toggle('active', +b.dataset.cd === settings.cd));
  $('routine-list').innerHTML = ROUTINES[settings.routine].items.map(it => {
    const e = EX[it.ex];
    const tags = [
      `<span class="chip">${it.one ? '한손 · 좌/우' : '양손'}</span>`,
      it.reps > 1 ? `<span class="chip chip-accent">×${it.reps}</span>` : '',
    ].join('');
    return `<li><div class="ex-art">${handSVG(e.fingers, it.one ? 'L' : 'both')}</div>
      <div class="ex-name">${e.name}</div>
      <div class="ex-tags">${tags}</div></li>`;
  }).join('');
  const open = settings.listOpen;
  $('routine-list').hidden = !open;
  $('btn-list').setAttribute('aria-expanded', open);
  $('list-label').textContent = open ? '접기' : '펼치기';
  $('v-hang').textContent = settings.hang;
  $('v-sw').textContent = settings.sw;
  $('v-prep').textContent = settings.prep;
  $('rest-hint').textContent = `휴식 ${SET_LEN - settings.hang}초`;
  const { steps, totalSets } = buildSteps(settings);
  $('list-summary').textContent = `${ROUTINES[settings.routine].items.length}개 동작 · ${totalSets}세트`;
  $('total').textContent = fmt(steps.reduce((a, s) => a + s.dur, 0));
  $('total-sets').textContent = totalSets;
}

$('btn-list').addEventListener('click', () => {
  settings.listOpen = !settings.listOpen; saveSettings(); renderSetup();
});
$('btn-settings').addEventListener('click', () => show('settings'));
$('btn-settings-back').addEventListener('click', () => show('setup'));

document.querySelectorAll('[data-routine]').forEach(b => b.addEventListener('click', () => {
  settings.routine = +b.dataset.routine; saveSettings(); renderSetup();
}));
document.querySelectorAll('[data-sound]').forEach(b => b.addEventListener('click', () => {
  settings.sound = b.dataset.sound; saveSettings(); renderSetup();
}));
document.querySelectorAll('[data-cd]').forEach(b => b.addEventListener('click', () => {
  settings.cd = +b.dataset.cd; saveSettings(); renderSetup();
}));
document.querySelectorAll('.stepper').forEach(st => st.querySelectorAll('button').forEach(b => {
  b.addEventListener('click', () => {
    const k = st.dataset.key;
    const v = settings[k] + (+b.dataset.d) * (+st.dataset.step);
    settings[k] = Math.min(+st.dataset.max, Math.max(+st.dataset.min, v));
    saveSettings(); renderSetup();
  });
}));
$('btn-preview').addEventListener('click', preview);

/* ================= 타이머 ================= */
const RING = 2 * Math.PI * 90;
let run = null; // { steps, totalSets, i, end, remain, paused, lastSec, startedAt, setsDone, cfg }

function start() {
  unlockAudio();
  lockScreen();
  const { steps, totalSets } = buildSteps(settings);
  run = { steps, totalSets, i: -1, paused: false, startedAt: Date.now(), elapsed: 0, setsDone: 0, cfg: { ...settings } };
  $('run-routine').textContent = `루틴 ${settings.routine} · ${ROUTINES[settings.routine].title}`;
  show('run');
  enterStep(0, performance.now());
  loop();
}

function enterStep(i, at) {
  const st = run.steps[i];
  run.i = i;
  run.end = at + st.dur * 1000;
  run.lastSec = st.dur;
  document.body.dataset.phase = st.type;
  renderStep();
}

function renderStep() {
  const { steps, i, totalSets } = run;
  const st = steps[i];
  // 휴식/준비 중에는 다음 매달리기 그립을 미리 보여줌
  const focus = st.type === 'hang' ? st : steps.slice(i + 1).find(s => s.type === 'hang') || st;
  const ex = EX[focus.ex];
  $('phase').textContent = PHASE_LABEL[st.type];
  $('run-count').textContent = `세트 ${Math.max(focus.set, 1)} / ${totalSets}`;
  $('grip-art').innerHTML = handSVG(ex.fingers, focus.side);
  $('grip-tag').textContent = st.type === 'hang' ? '지금' : '다음';
  $('grip-hands').textContent = SIDE_LABEL[focus.side] + (focus.reps > 1 ? ` · ${focus.rep}/${focus.reps}` : '');
  $('grip-name').textContent = ex.name;
  $('grip-sub').textContent = `${GRIP_EN[ex.grip]} · ${ex.fingers.length} Fingers`;

  const nextHang = steps.slice(i + 1).find(s => s.type === 'hang' && s !== focus);
  const after = steps.slice(steps.indexOf(focus) + 1).find(s => s.type === 'hang');
  if (st.type === 'hang') {
    const nx = steps[i + 1];
    $('next').textContent = !nx ? '마지막 세트!'
      : nx.type === 'switch' ? `다음 · 손 바꾸기 ${nx.dur}초 → 오른손`
      : `다음 · 휴식 ${nx.dur}초 → ${nextHang ? EX[nextHang.ex].name : ''}`;
  } else {
    $('next').textContent = after ? `그다음 · ${SIDE_LABEL[after.side]} ${EX[after.ex].name}` : '이번이 마지막 세트';
  }
  $('progress-bar').style.width = `${(run.setsDone / totalSets) * 100}%`;
}

function tick() {
  if (!run || run.paused) return;
  const now = performance.now();
  // 백그라운드 복귀 시 밀린 단계를 한 번에 처리
  while (now >= run.end) {
    const st = run.steps[run.i];
    if (st.type === 'hang') {
      if (st.side !== 'L') run.setsDone++;
    }
    const nextI = run.i + 1;
    if (nextI >= run.steps.length) return finish(true);
    const late = now - run.end > 1000;
    if (!late) {
      if (st.type === 'hang') sound.stop();
      if (run.steps[nextI].type === 'hang') sound.go();
    }
    enterStep(nextI, run.end);
  }
  const remain = (run.end - now) / 1000;
  const sec = Math.ceil(remain);
  const st = run.steps[run.i];
  const countEl = $('count');
  if (sec !== run.lastSec) {
    run.lastSec = sec;
    if (sec <= settings.cd && sec >= 1) {
      countdown(sec);
      countEl.classList.remove('beat'); void countEl.offsetWidth; countEl.classList.add('beat');
    }
  }
  countEl.textContent = sec;
  countEl.classList.toggle('last', sec <= settings.cd);
  $('ring').style.strokeDashoffset = RING * (1 - remain / st.dur);
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
    run.paused = false;
    $('btn-pause').textContent = '일시정지';
    document.body.classList.remove('paused');
  } else {
    run.remain = run.end - now;
    run.paused = true;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    $('btn-pause').textContent = '계속';
    document.body.classList.add('paused');
  }
}

function skip() {
  if (!run) return;
  const st = run.steps[run.i];
  if (st.type === 'hang' && st.side !== 'L') run.setsDone++;
  const nextI = run.i + 1;
  if (nextI >= run.steps.length) return finish(true);
  if (run.paused) togglePause();
  if (run.steps[nextI].type === 'hang') sound.go();
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
  doneTs = null;
  if (r.setsDone > 0) {
    doneTs = Date.now();
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    log.unshift({ ts: doneTs, routine: r.cfg.routine, hang: r.cfg.hang, sets: r.setsDone, total: r.totalSets, sec: elapsed, completed });
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  }
  if (!completed) { document.body.dataset.phase = 'idle'; show('setup'); return; }
  sound.done();
  vibrate([200, 100, 200]);
  document.body.dataset.phase = 'done';
  $('done-sub').textContent = `루틴 ${r.cfg.routine} · ${ROUTINES[r.cfg.routine].title}`;
  $('d-time').textContent = fmt(elapsed);
  $('d-sets').textContent = r.setsDone;
  $('d-hang').textContent = `${r.cfg.hang}s`;
  renderHold();
  show('done');
}

/* ================= 완료 후 홀드 선택 ================= */
let doneTs = null;
function renderHold() {
  $('board-seg').innerHTML = Object.entries(BOARDS).map(([k, b]) =>
    `<button class="seg ${k === settings.board ? 'active' : ''}" data-board="${k}">${b.name}</button>`).join('');
  $('mm-grid').innerHTML = BOARDS[settings.board].mm.map(mm =>
    `<button class="mm ${mm === settings.mm ? 'active' : ''}" data-mm="${mm}">${mm}<small>mm</small></button>`).join('');
}
$('board-seg').addEventListener('click', e => {
  const b = e.target.closest('[data-board]');
  if (!b) return;
  settings.board = b.dataset.board;
  if (!BOARDS[settings.board].mm.includes(settings.mm)) settings.mm = null;
  saveSettings(); renderHold();
});
$('mm-grid').addEventListener('click', e => {
  const b = e.target.closest('[data-mm]');
  if (!b) return;
  settings.mm = settings.mm === +b.dataset.mm ? null : +b.dataset.mm; // 다시 누르면 선택 해제
  saveSettings(); renderHold();
});
function saveHold() {
  if (!doneTs || !settings.mm) return;
  const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  const entry = log.find(l => l.ts === doneTs);
  if (entry) { entry.board = settings.board; entry.mm = settings.mm; }
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

$('btn-start').addEventListener('click', start);
$('btn-pause').addEventListener('click', togglePause);
$('btn-skip').addEventListener('click', skip);
$('btn-stop').addEventListener('click', () => {
  if (!run.paused) togglePause();
  if (confirm('운동을 종료할까요?')) finish(false);
});
$('btn-done').addEventListener('click', () => { saveHold(); document.body.dataset.phase = 'idle'; show('setup'); });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && run) { lockScreen(); if (ctx) ctx.resume(); }
});

/* ================= 기록 ================= */
function renderHistory() {
  const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  const now = new Date();
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // 월요일 시작
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const done = log.filter(l => l.completed);
  $('h-week').textContent = done.filter(l => l.ts >= weekStart).length;
  $('h-month').textContent = done.filter(l => l.ts >= monthStart).length;
  $('h-all').textContent = done.length;

  if (!log.length) { $('log-list').innerHTML = '<p class="empty">아직 기록이 없어요</p>'; return; }
  let html = '', lastDay = '';
  for (const l of log) {
    const d = new Date(l.ts);
    const day = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    if (day !== lastDay) { html += `<div class="log-day">${day}</div>`; lastDay = day; }
    const time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
    const hold = l.mm ? `<span class="chip">${BOARDS[l.board].name} · ${l.mm}mm</span>` : '';
    html += `<div class="log-item"><div><b>루틴 ${l.routine} · ${ROUTINES[l.routine].title}</b>
      <small>${time} · 매달리기 ${l.hang}초 · ${l.sets}/${l.total}세트 · ${fmt(l.sec)}</small>${hold}</div>
      <span class="chip ${l.completed ? 'badge-ok' : 'badge-stop'}">${l.completed ? '완료' : '중단'}</span></div>`;
  }
  $('log-list').innerHTML = html;
}

$('btn-history').addEventListener('click', () => { renderHistory(); show('history'); });
$('btn-back').addEventListener('click', () => show('setup'));
$('btn-clear').addEventListener('click', () => {
  if (confirm('기록을 모두 삭제할까요?')) { localStorage.removeItem(LOG_KEY); renderHistory(); }
});

/* ================= 시작 ================= */
renderSetup();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
