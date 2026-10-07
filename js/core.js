'use strict';
// 공통: 운동 정의, 설정 저장, 단계(시퀀스) 생성, 소리, 화면 꺼짐 방지, DOM 도우미

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
const readLog = () => JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
const writeLog = log => localStorage.setItem(LOG_KEY, JSON.stringify(log));

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

// 음성 모드 여부 / 영어로 읽기 (이전 말은 끊고 바로 읽음)
const voiceOn = () => settings.sound === 'voice' && 'speechSynthesis' in window;
function say(text, rate = 1.15) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}

function countdown(n) {
  if (voiceOn()) say(['', 'One', 'Two', 'Three', 'Four', 'Five'][n]);
  else sound.beep();
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
const escapeHTML = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
// 손 그림 handSVG(fingers, side, grip), 보드 그림 boardSVG 는 art.js
