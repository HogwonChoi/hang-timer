'use strict';

/* ================= 운동 정의 ================= */
// 손가락 조합 (i=검지 m=중지 r=약지 p=새끼). 이름은 영어권 클라이머 표준 용어, 손가락은 한국어로 보조 표기
// pick: 편집 화면 버튼 글자, who: 쓰는 손가락
const FINGERS = {
  imrp: { label: '4 Finger', pick: '4 Finger', who: '검지~새끼' },
  imr: { label: 'Front 3', pick: 'Front 3', who: '검지·중지·약지' },
  mrp: { label: 'Back 3', pick: 'Back 3', who: '중지·약지·새끼' },
  im: { label: 'Front 2', pick: 'Front 2', who: '검지·중지' },
  mr: { label: 'Middle 2', pick: 'Middle 2', who: '중지·약지' },
  rp: { label: 'Back 2', pick: 'Back 2', who: '약지·새끼' },
  i: { label: 'Mono Index', pick: 'Index', who: '검지' },
  m: { label: 'Mono Middle', pick: 'Middle', who: '중지' },
  r: { label: 'Mono Ring', pick: 'Ring', who: '약지' },
  p: { label: 'Mono Pinky', pick: 'Pinky', who: '새끼' },
};
const FINGER_GROUPS = [
  ['4 Finger', ['imrp']],
  ['3 Finger', ['imr', 'mrp']],
  ['2 Finger', ['im', 'mr', 'rp']],
  ['Mono', ['i', 'm', 'r', 'p']],
];
const GRIPS = {
  half: { ko: '하프크림프', en: 'Half Crimp' },
  open: { ko: '오픈크림프', en: 'Open Hand' },
  full: { ko: '풀크림프', en: 'Full Crimp' },
};
const exName = it => `${FINGERS[it.fingers].label} ${GRIPS[it.grip].en}`;
const exSub = it => `${GRIPS[it.grip].ko} · ${FINGERS[it.fingers].who}`;

// 완료 후 선택하는 홀드 보드 (홀드 목록·그림은 art.js의 BOARD_HOLDS / boardSVG)
const BOARDS = { bm1000: 'BM 1000', bm2000: 'BM 2000', crimp: '크림프' };

// 기본 루틴. one: 한손 세트(왼손 → 손 바꾸기 → 오른손)
const ex = (fingers, grip, reps = 1, one = false) => ({ fingers, grip, reps, one });
const BUILTIN = [
  {
    id: 'r1', title: '웜업', builtin: true,
    items: [ex('imrp', 'half'), ex('imr', 'open'), ex('imrp', 'full'), ex('imr', 'full'),
      ex('imrp', 'half', 1, true), ex('imr', 'open', 1, true)],
  },
  {
    id: 'r2', title: '마무리', builtin: true,
    items: [ex('imrp', 'half', 2), ex('imr', 'open', 2), ex('imrp', 'full', 2), ex('imr', 'full', 2),
      ex('imrp', 'half', 1, true), ex('imr', 'open', 1, true)],
  },
];

const SET_LEN = 60;
const PHASE_LABEL = { prep: 'GET READY', hang: 'HANG', rest: 'REST', switch: 'SWITCH HANDS', pull: 'PULL-UP', hold: 'HOLD' };
const SIDE_LABEL = { both: '양손', L: '왼손', R: '오른손' };

/* ================= 저장 ================= */
const SETTINGS_KEY = 'hang-settings';
const LOG_KEY = 'hang-log';
const ROUTINES_KEY = 'hang-routines';
const CX_KEY = 'hang-circuit-ex';
const settings = Object.assign(
  {
    tab: 'fb', routine: 'r1', hang: 20, sw: 10, prep: 10, sound: 'beep', cd: 5, listOpen: false,
    board: 'bm2000', hold: null, weight: 0,
    cSel: [], cSets: 3, cRest: 6,                       // 서킷: 고른 운동, 세트 수, 세트 사이 휴식(분)
    ilvHold: 10, ilvPull: 2, ilvSets: 3, ilvRestMin: 2, // ILV: 자세 유지(초), 턱걸이(초), 세트 수, 휴식(분)
  },
  JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
);
delete settings.voice; // 이전 버전 설정값 정리
delete settings.mm;
if (settings.ilvRest) { settings.ilvRestMin = Math.max(1, Math.round(settings.ilvRest / 60)); delete settings.ilvRest; }
if (typeof settings.routine === 'number') settings.routine = `r${settings.routine}`;
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

let customs = JSON.parse(localStorage.getItem(ROUTINES_KEY) || '[]');
const saveCustoms = () => localStorage.setItem(ROUTINES_KEY, JSON.stringify(customs));
const allRoutines = () => [...BUILTIN, ...customs];
const getRoutine = id => allRoutines().find(r => r.id === id) || BUILTIN[0];

const CX_DEFAULT = ['턱걸이', '링 코어', '푸시업 맨땅', '푸시업 인클라인', '푸시업 디클라인',
  '밴드 사레레 천천히', '밴드 사레레 빠르게', '언더 크림프 친업', '코어 발 멀리 찍기', '머슬업'];
let cxList = JSON.parse(localStorage.getItem(CX_KEY) || 'null') || CX_DEFAULT;
const saveCx = () => localStorage.setItem(CX_KEY, JSON.stringify(cxList));

/* ================= 시퀀스 생성 ================= */
// countsSet: 이 단계가 끝나면 세트 1개 완료로 센다
function buildSteps(items, { hang, sw, prep }) {
  const sets = [];
  for (const item of items) {
    for (let r = 1; r <= item.reps; r++) sets.push({ ...item, rep: r });
  }
  const steps = [{ type: 'prep', dur: prep, set: 0 }];
  sets.forEach((s, i) => {
    const base = { fingers: s.fingers, grip: s.grip, rep: s.rep, reps: s.reps, set: i + 1 };
    if (s.one) {
      steps.push({ ...base, type: 'hang', dur: hang, side: 'L' });
      steps.push({ ...base, type: 'switch', dur: sw, side: 'L' });
      steps.push({ ...base, type: 'hang', dur: hang, side: 'R', countsSet: true });
    } else {
      steps.push({ ...base, type: 'hang', dur: hang, side: 'both', countsSet: true });
    }
    if (i < sets.length - 1) steps.push({ ...base, type: 'rest', dur: SET_LEN - hang });
  });
  return { steps, totalSets: sets.length };
}
const totalSec = steps => steps.reduce((a, s) => a + s.dur, 0);

// ILV 1세트: 자세를 바꾸기 전마다 턱걸이 1개 → I L V V L I
const ILV_ORDER = ['I', 'L', 'V', 'V', 'L', 'I'];
const POSE_NAME = { I: 'I 자세', L: 'L 자세', V: 'V 자세' };
const POSE_SAY = { I: 'I hang', L: 'L sit', V: 'V sit' };
function buildIlvSteps({ ilvHold, ilvPull, ilvSets, ilvRestMin, prep }) {
  const ilvRest = ilvRestMin * 60;
  const steps = [{ type: 'prep', dur: prep, set: 1, pose: 'I', idx: 0 }];
  for (let s = 1; s <= ilvSets; s++) {
    ILV_ORDER.forEach((pose, idx) => {
      steps.push({ type: 'pull', dur: ilvPull, set: s, pose, idx });
      steps.push({ type: 'hold', dur: ilvHold, set: s, pose, idx, countsSet: idx === ILV_ORDER.length - 1 });
    });
    if (s < ilvSets) steps.push({ type: 'rest', dur: ilvRest, set: s + 1, pose: 'I', idx: 0 });
  }
  return { steps, totalSets: ilvSets };
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
const screens = ['setup', 'settings', 'editor', 'cx-editor', 'run', 'circuit', 'done', 'history'];
function show(name) {
  screens.forEach(s => { $(s).hidden = s !== name; });
  window.scrollTo(0, 0);
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
// 손 그림 handSVG(fingers, side, grip), 보드 그림 boardSVG 는 art.js

/* ================= 메인 화면 ================= */
const exRowHTML = it => {
  const tags = [
    `<span class="chip">${it.one ? '한손 · 좌/우' : '양손'}</span>`,
    it.reps > 1 ? `<span class="chip chip-accent">×${it.reps}</span>` : '',
  ].join('');
  return `<div class="ex-art">${handSVG(it.fingers, it.one ? 'L' : 'both', it.grip)}</div>
    <div class="ex-name">${exName(it)}</div><div class="ex-tags">${tags}</div>`;
};

const TAB_NAME = { fb: 'Fingerboard', circuit: 'Circuit', ilv: 'ILV Pull-up' };

function renderSetup() {
  const tab = settings.tab;
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ['fb', 'circuit', 'ilv'].forEach(t => { $(`panel-${t}`).hidden = t !== tab; });
  $('eyebrow').textContent = TAB_NAME[tab];
  document.querySelectorAll('.stepper').forEach(st => { st.querySelector('output').textContent = settings[st.dataset.key]; });
  document.querySelectorAll('[data-sound]').forEach(b => b.classList.toggle('active', b.dataset.sound === settings.sound));
  document.querySelectorAll('[data-cd]').forEach(b => b.classList.toggle('active', +b.dataset.cd === settings.cd));

  const rt = getRoutine(settings.routine);
  settings.routine = rt.id;
  $('routine-chips').innerHTML = allRoutines().map(r =>
    `<button class="rchip ${r.id === rt.id ? 'active' : ''}" data-rid="${r.id}">${escapeHTML(r.title)}</button>`).join('')
    + '<button class="rchip rchip-add" id="btn-new">+ 새 루틴</button>';
  $('routine-list').innerHTML = rt.items.map(i => `<li>${exRowHTML(i)}</li>`).join('');
  const open = settings.listOpen;
  $('routine-list').hidden = !open;
  $('btn-list').setAttribute('aria-expanded', open);
  $('btn-edit').textContent = rt.builtin ? '복사해서 편집' : '편집';
  $('btn-share').hidden = !!rt.builtin;
  $('rest-hint').textContent = `휴식 ${SET_LEN - settings.hang}초`;
  const fb = buildSteps(rt.items, settings);
  $('list-summary').textContent = `${rt.items.length}개 동작 · ${fb.totalSets}세트`;

  // 서킷: 목록에서 지워진 운동은 선택에서도 뺀다
  settings.cSel = settings.cSel.filter(n => cxList.includes(n));
  $('cx-pick').innerHTML = cxList.map(n =>
    `<button class="cx-chip ${settings.cSel.includes(n) ? 'active' : ''}" data-cx="${escapeHTML(n)}">${escapeHTML(n)}</button>`).join('')
    || '<p class="chart-empty">목록 편집에서 운동을 추가하세요</p>';

  $('ilv-seq').innerHTML = ILV_ORDER.map(p => `<span class="pose-badge">${p}</span>`).join('<i>›</i>');

  let line;
  if (tab === 'fb') line = `총 <b>${fmt(totalSec(fb.steps))}</b> · ${fb.totalSets}세트`;
  else if (tab === 'circuit') line = `운동 <b>${settings.cSel.length}개</b> · ${settings.cSets}세트 · 휴식 ${settings.cRest}분`;
  else line = `총 <b>${fmt(totalSec(buildIlvSteps(settings).steps))}</b> · ${settings.ilvSets}세트`;
  $('total-line').innerHTML = line;
  $('btn-start').disabled = tab === 'circuit' && !settings.cSel.length;
}

document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
  settings.tab = b.dataset.tab; saveSettings(); renderSetup();
}));
$('cx-pick').addEventListener('click', e => {
  const b = e.target.closest('[data-cx]');
  if (!b) return;
  const n = b.dataset.cx;
  // 선택 순서 = 진행 순서는 목록 순서를 따른다
  settings.cSel = settings.cSel.includes(n) ? settings.cSel.filter(x => x !== n) : cxList.filter(x => x === n || settings.cSel.includes(x));
  saveSettings(); renderSetup();
});

const escapeHTML = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

$('routine-chips').addEventListener('click', e => {
  if (e.target.id === 'btn-new') return openEditor(null);
  const b = e.target.closest('[data-rid]');
  if (!b) return;
  settings.routine = b.dataset.rid; saveSettings(); renderSetup();
});
$('btn-list').addEventListener('click', () => {
  settings.listOpen = !settings.listOpen; saveSettings(); renderSetup();
});
$('btn-edit').addEventListener('click', () => openEditor(getRoutine(settings.routine)));
$('btn-settings').addEventListener('click', () => show('settings'));
$('btn-settings-back').addEventListener('click', () => show('setup'));

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

/* ================= 루틴 편집 ================= */
let draft = null;      // { id, title, items }
let draftOrig = '';    // 변경 여부 확인용
const addSel = { fingers: 'imrp', grip: 'half', one: false };

function openEditor(src) {
  if (!src) {
    draft = { id: null, title: '', items: [] };
  } else if (src.builtin) {
    draft = { id: null, title: `${src.title} 복사`, items: structuredClone(src.items) };
  } else {
    draft = structuredClone(src);
  }
  draftOrig = JSON.stringify(draft);
  $('ed-heading').textContent = draft.id ? '루틴 편집' : '새 루틴';
  $('ed-name').value = draft.title;
  $('btn-ed-delete').hidden = !draft.id;
  renderEditor();
  show('editor');
}

function renderEditor() {
  const { steps, totalSets } = buildSteps(draft.items, settings);
  $('ed-summary').textContent = draft.items.length
    ? `${draft.items.length}개 동작 · ${totalSets}세트 · 총 ${fmt(totalSec(steps))} (매달리기 ${settings.hang}초 기준)`
    : '아래에서 그립을 골라 추가하세요';
  const last = draft.items.length - 1;
  $('ed-list').innerHTML = draft.items.map((x, i) => `
    <li class="ed-item" data-i="${i}">
      <div class="ex-art">${handSVG(x.fingers, x.one ? 'L' : 'both', x.grip)}</div>
      <div class="ed-main">
        <div class="ed-name">${exName(x)}</div>
        <div class="ed-ctl">
          <button class="chip ed-hands" data-act="hands">${x.one ? '한손 · 좌/우' : '양손'}</button>
          <div class="mini-step">
            <button data-act="minus" aria-label="횟수 줄이기">−</button><span>×${x.reps}</span><button data-act="plus" aria-label="횟수 늘리기">+</button>
          </div>
        </div>
      </div>
      <div class="ed-move">
        <button data-act="up" aria-label="위로" ${i === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button>
        <button data-act="down" aria-label="아래로" ${i === last ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
      </div>
      <button class="ed-del" data-act="del" aria-label="삭제"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg></button>
    </li>`).join('');

  $('add-fingers').innerHTML = FINGER_GROUPS.map(([title, keys]) => `
    <div class="add-group"><div class="add-group-t">${title}</div>
      <div class="add-grid g${keys.length}">${keys.map(k => `
        <button class="add-opt ${k === addSel.fingers ? 'active' : ''}" data-fingers="${k}">
          <b>${FINGERS[k].pick}</b>${keys.length < 4 ? `<small>${FINGERS[k].who}</small>` : ''}</button>`).join('')}
      </div></div>`).join('');
  document.querySelectorAll('[data-addgrip]').forEach(b => b.classList.toggle('active', b.dataset.addgrip === addSel.grip));
  document.querySelectorAll('[data-addone]').forEach(b => b.classList.toggle('active', (b.dataset.addone === '1') === addSel.one));
  $('btn-ed-add').textContent = `+ ${exName(addSel)} ${addSel.one ? '(한손)' : '(양손)'} 추가`;
}

$('ed-list').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const i = +b.closest('[data-i]').dataset.i;
  const items = draft.items;
  const x = items[i];
  switch (b.dataset.act) {
    case 'hands': x.one = !x.one; break;
    case 'minus': x.reps = Math.max(1, x.reps - 1); break;
    case 'plus': x.reps = Math.min(10, x.reps + 1); break;
    case 'up': if (i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]]; break;
    case 'down': if (i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]]; break;
    case 'del': items.splice(i, 1); break;
  }
  renderEditor();
});
$('add-fingers').addEventListener('click', e => {
  const b = e.target.closest('[data-fingers]');
  if (b) { addSel.fingers = b.dataset.fingers; renderEditor(); }
});
document.querySelectorAll('[data-addgrip]').forEach(b => b.addEventListener('click', () => { addSel.grip = b.dataset.addgrip; renderEditor(); }));
document.querySelectorAll('[data-addone]').forEach(b => b.addEventListener('click', () => { addSel.one = b.dataset.addone === '1'; renderEditor(); }));
$('btn-ed-add').addEventListener('click', () => {
  draft.items.push(ex(addSel.fingers, addSel.grip, 1, addSel.one));
  renderEditor();
  $('ed-list').lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('ed-name').addEventListener('input', e => { draft.title = e.target.value; });

$('btn-ed-save').addEventListener('click', () => {
  draft.title = draft.title.trim();
  if (!draft.title) { alert('루틴 이름을 입력해 주세요'); $('ed-name').focus(); return; }
  if (!draft.items.length) { alert('그립을 하나 이상 추가해 주세요'); return; }
  if (draft.id) {
    customs = customs.map(r => (r.id === draft.id ? draft : r));
  } else {
    draft.id = `c${Date.now()}`;
    customs.push(draft);
  }
  saveCustoms();
  settings.routine = draft.id;
  saveSettings(); renderSetup(); show('setup');
});
$('btn-ed-back').addEventListener('click', () => {
  if (JSON.stringify(draft) !== draftOrig && !confirm('저장하지 않고 나갈까요?')) return;
  show('setup');
});
$('btn-ed-delete').addEventListener('click', () => {
  if (!confirm(`'${draft.title}' 루틴을 삭제할까요?`)) return;
  customs = customs.filter(r => r.id !== draft.id);
  saveCustoms();
  settings.routine = 'r1';
  saveSettings(); renderSetup(); show('setup');
});

/* ================= 루틴 공유 (링크 #r=코드) ================= */
const toB64url = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

function shareLink(r) {
  const code = toB64url(JSON.stringify({ t: r.title, i: r.items.map(x => [x.fingers, x.grip, x.reps, x.one ? 1 : 0]) }));
  return `${location.origin}${location.pathname}#r=${code}`;
}

// 링크 전체 또는 코드만 받아서 { title, items } 로. 형식이 틀리면 null
function parseShared(text) {
  const code = (text.match(/r=([\w-]+)/) || [null, text.trim()])[1];
  let data;
  try { data = JSON.parse(fromB64url(code)); } catch { return null; }
  if (!data || typeof data.t !== 'string' || !Array.isArray(data.i) || !data.i.length || data.i.length > 50) return null;
  const items = [];
  for (const [f, g, reps, one] of data.i) {
    if (!FINGERS[f] || !GRIPS[g] || !Number.isInteger(reps) || reps < 1 || reps > 10) return null;
    items.push(ex(f, g, reps, !!one));
  }
  return { title: data.t.slice(0, 20) || '공유받은 루틴', items };
}

// 공유창(카톡 등) → 안 되면 클립보드 복사 → 그것도 안 되면 직접 복사하도록 보여줌
function sendLink(url, title, text) {
  const copy = () => navigator.clipboard.writeText(url)
    .then(() => alert('링크를 복사했어요. 친구에게 보내주세요.'))
    .catch(() => prompt('이 링크를 복사해서 보내주세요', url));
  if (navigator.share) {
    navigator.share({ title, text, url })
      .catch(err => { if (err.name !== 'AbortError') copy(); }); // 사용자가 공유창을 닫은 경우는 무시
  } else {
    copy();
  }
}

$('btn-share').addEventListener('click', () => {
  const r = getRoutine(settings.routine);
  sendLink(shareLink(r), `Hang Timer · ${r.title}`, `'${r.title}' 루틴 (${r.items.length}개 동작)`);
});

/* ---------- 서킷 운동 목록 공유 (링크 #c=코드) ---------- */
function parseCxShared(text) {
  const code = (text.match(/c=([\w-]+)/) || [null, text.trim()])[1];
  let list;
  try { list = JSON.parse(fromB64url(code)); } catch { return null; }
  if (!Array.isArray(list) || !list.length || list.length > 60) return null;
  if (!list.every(n => typeof n === 'string' && n.trim() && n.length <= 24)) return null;
  return list.map(n => n.trim());
}
// 내 목록에 없는 운동만 뒤에 추가 (기존 목록은 그대로)
function mergeCx(list) {
  const added = list.filter(n => !cxList.includes(n));
  cxList.push(...added);
  saveCx();
  return added.length;
}
$('btn-cx-share').addEventListener('click', () => {
  const url = `${location.origin}${location.pathname}#c=${toB64url(JSON.stringify(cxList))}`;
  sendLink(url, 'Hang Timer · 서킷 운동 목록', `서킷 운동 목록 (${cxList.length}개)`);
});
$('btn-cx-import').addEventListener('click', () => {
  const text = prompt('공유받은 목록 링크를 붙여넣어 주세요');
  if (!text) return;
  const list = parseCxShared(text);
  if (!list) { alert('올바른 목록 링크가 아니에요'); return; }
  const n = mergeCx(list);
  alert(n ? `${n}개 운동을 추가했어요` : '이미 모두 있는 운동이에요');
  renderCxEditor();
});

// 편집 화면에서 붙여넣기 → 편집 중인 루틴에 채워 넣고 저장은 사용자가
$('btn-import').addEventListener('click', () => {
  const text = prompt('공유받은 링크를 붙여넣어 주세요');
  if (!text) return;
  const data = parseShared(text);
  if (!data) { alert('올바른 루틴 링크가 아니에요'); return; }
  draft.title = data.title;
  draft.items = data.items;
  $('ed-name').value = data.title;
  renderEditor();
});

// 공유 링크로 앱을 열었을 때 (#r= 루틴, #c= 서킷 목록)
function importFromHash() {
  if (location.hash.startsWith('#c=')) {
    const list = parseCxShared(location.hash);
    history.replaceState(null, '', location.pathname);
    if (!list) { alert('목록 링크가 올바르지 않아요'); return; }
    if (!confirm(`서킷 운동 ${list.length}개를 내 목록에 추가할까요? (이미 있는 건 건너뛰어요)`)) return;
    const n = mergeCx(list);
    settings.tab = 'circuit';
    saveSettings(); renderSetup();
    alert(n ? `${n}개 운동을 추가했어요` : '이미 모두 있는 운동이에요');
    return;
  }
  if (!location.hash.startsWith('#r=')) return;
  const data = parseShared(location.hash);
  history.replaceState(null, '', location.pathname);
  if (!data) { alert('루틴 링크가 올바르지 않아요'); return; }
  if (!confirm(`'${data.title}' 루틴(${data.items.length}개 동작)을 내 루틴에 추가할까요?`)) return;
  const r = { id: `c${Date.now()}`, ...data };
  customs.push(r);
  saveCustoms();
  settings.routine = r.id;
  saveSettings(); renderSetup();
}

/* ================= 타이머 (핑거보드 · ILV 공용) ================= */
const RING = 2 * Math.PI * 90;
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
  if (settings.sound === 'voice' && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance('Get ready');
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  } else {
    tone(880, 0.05, 0.12, 0.1, 'square');
  }
}

function enterStep(i, at) {
  const st = run.steps[i];
  run.i = i;
  run.end = at + st.dur * 1000;
  run.lastSec = st.dur;
  run.lastTick = performance.now();
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
  if (settings.sound === 'voice' && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`Pull up, ${POSE_SAY[pose]}`);
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    u.rate = 1.2;
    speechSynthesis.speak(u);
  } else {
    tone(587, 0, 0.28, 0.3, 'square'); // 카운트다운(880Hz)보다 낮은 음으로 구분
  }
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
  const countEl = $('count');
  const cdOn = st.type !== 'pull' && sec <= settings.cd; // 짧은 턱걸이 단계는 카운트다운 소리 없음
  setLight(st.type === 'pull' ? '' : lightFor(sec));
  if (sec !== run.lastSec) {
    run.lastSec = sec;
    if (cdOn && sec >= 1) {
      countdown(sec);
      countEl.classList.remove('beat'); void countEl.offsetWidth; countEl.classList.add('beat');
    }
  }
  countEl.textContent = sec;
  countEl.classList.toggle('last', cdOn);
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
    run.lastTick = now;
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
  const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  log.unshift(entry);
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
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
function saveHold() {
  const h = findHold(settings.board, settings.hold);
  if (!doneTs) return;
  const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  const entry = log.find(l => l.ts === doneTs);
  if (!entry) return;
  if (h && doneKind === 'fb') { entry.board = settings.board; entry.mm = h.mm; entry.hold = h.id; }
  if (doneKind !== 'circuit') entry.weight = settings.weight;
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
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
$('btn-done').addEventListener('click', () => { saveHold(); backToMain(); });

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
  $('cx-rest-time').textContent = fmt(sec);
  setLight(lightFor(sec));
  if (sec !== cx.lastSec) {
    if (cx.lastSec !== null && sec <= settings.cd) countdown(sec);
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

/* ================= 기록 ================= */
// type 없는 예전 기록은 핑거보드
const logType = l => l.type || 'fb';
const logTitle = l => l.title ?? (l.routine === 2 ? '마무리' : '웜업'); // 이전 버전 기록은 루틴 번호만 있음
const TYPE_LABEL = { fb: 'Fingerboard', circuit: 'Circuit', ilv: 'ILV' };
let histFilter = 'all';

function logLine(l, time) {
  const base = `${time} · ${l.sets}/${l.total}세트 · ${fmt(l.sec)}`;
  const chips = [];
  if (l.mm) chips.push(`${BOARDS[l.board]} · ${l.mm}mm`);
  if (l.weight) chips.push(weightLabel(l.weight));
  const chipHTML = chips.map(c => `<span class="chip">${c}</span>`).join('');
  switch (logType(l)) {
    case 'circuit':
      return `<small>${base}</small><small class="log-items">${(l.items || []).map(escapeHTML).join(' · ')}</small>`;
    case 'ilv':
      return `<small>${base} · 유지 ${l.holdSec}초 · 턱걸이 ${l.pullSec}초</small>${chipHTML}`;
    default:
      return `<small>${base} · 매달리기 ${l.hang}초</small>${chipHTML}`;
  }
}

function renderHistory() {
  document.querySelectorAll('[data-hf]').forEach(b => b.classList.toggle('active', b.dataset.hf === histFilter));
  const all = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
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

/* ---------- 기록 상세: 서킷 운동 빼기 / 기록 삭제 ---------- */
let openLog = null; // { ts, keep:Set }
const readLog = () => JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
const writeLog = log => localStorage.setItem(LOG_KEY, JSON.stringify(log));

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
  $('lm-save').hidden = !isCx;
}

$('log-list').addEventListener('click', e => {
  const b = e.target.closest('[data-ts]');
  if (!b) return;
  const l = readLog().find(x => x.ts === +b.dataset.ts);
  if (!l) return;
  openLog = { ts: l.ts, keep: new Set((l.items || []).map((_, k) => k)) };
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
  const items = l.items.filter((_, k) => openLog.keep.has(k));
  if (!items.length) {
    if (!confirm('운동을 모두 뺐어요. 이 기록을 삭제할까요?')) return;
    writeLog(log.filter(x => x.ts !== openLog.ts));
  } else {
    l.items = items;
    writeLog(log);
  }
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
  else detail = card('중량별 횟수', tally(l => weightLabel(l.weight || 0)), '');

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

/* ================= 시작 ================= */
renderSetup();
importFromHash();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
