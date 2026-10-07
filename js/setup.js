'use strict';
// 메인 화면: 탭, 핑거보드 루틴 선택, 서킷 운동 선택, ILV 설정, 설정 화면
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
  document.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('active', +b.dataset.q === settings.hang));
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
$('hang-quick').addEventListener('click', e => {
  const b = e.target.closest('[data-q]');
  if (b) { settings.hang = +b.dataset.q; saveSettings(); renderSetup(); }
});
$('btn-preview').addEventListener('click', preview);
