'use strict';
// 핑거보드 루틴 편집 + 루틴·서킷 목록 공유 링크
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
  sendLink(shareLink(r), `Hangry · ${r.title}`, `'${r.title}' 루틴 (${r.items.length}개 동작)`);
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
  sendLink(url, 'Hangry · 서킷 운동 목록', `서킷 운동 목록 (${cxList.length}개)`);
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
