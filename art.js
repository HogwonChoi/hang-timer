'use strict';
/* art.js — 행보드 인터벌 타이머용 인라인 SVG 아트 (의존성 없음)
   전역: handSVG(fingers, side, grip) / BOARD_HOLDS / BOARD_NAMES / boardSVG(boardKey, selectedId)
   handSVG 는 원형 아이콘(손가락 수 + 크림프 종류)을 그린다. side 는 호출 호환용 인자
   주의: 전역 CSS 가 svg{fill:none;stroke:currentColor;stroke-width:2} 이므로
        모든 도형은 fill / stroke 를 직접 선언한다. 내부 헬퍼는 IIFE 안에 가둔다. */

const ART_ = (function () {

  /* ================= 디자인 토큰 ================= */
  const T = {
    mint: '#2FD3A0', ink: '#0D0E11',
    text: '#F5F5F6', muted: '#8A8F99',
    wd0: '#F0DFC2', wd1: '#D9C3A0', wd2: '#C09B71', wd3: '#A87C52', wd4: '#7A5433',
    slotA: '#6E4D31', slotB: '#36230F',
    badge: '#FFFFFF', badgeInk: '#241A10', engrave: '#5C3F27',
  };

  let uid = 0;
  const nid = () => 'a' + (++uid);

  const txt = (x, y, s, size, fill, w) =>
    `<text x="${x}" y="${y}" dy=".34em" text-anchor="middle" fill="${fill}" stroke="none"` +
    ` font-size="${size}" font-weight="${w || 800}" font-family="system-ui,-apple-system,sans-serif"` +
    ` style="font-variant-numeric:tabular-nums">${s}</text>`;

  /* ================= 그립 아이콘 ================= */
  // 원 안에 손가락 수(큰 숫자) + 크림프 종류(작은 영문). 글자색은 현재 단계 색(--accent)을 따른다
  const GRIP_LABEL = { open: 'OPEN', half: 'HALF', full: 'FULL' };

  function hand(fingers, side, grip) {
    const n = (typeof fingers === 'string' && fingers.length) || 4;
    return '<svg class="art grip-icon" viewBox="0 0 64 64">' +
      '<circle cx="32" cy="32" r="30" fill="#1F2229" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>' +
      txt(32, 28, n, 27, T.text, 800) +
      `<text x="32" y="45" dy=".34em" text-anchor="middle" stroke="none" font-size="9" font-weight="800"` +
      ` letter-spacing="1.2" font-family="system-ui,-apple-system,sans-serif"` +
      ` style="fill:var(--accent,#FF5B4A)">${GRIP_LABEL[grip] || ''}</text></svg>`;
  }

  /* ================= 보드 ================= */
  const boardDefs = u => `<defs>` +
    `<linearGradient id="bw${u}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${T.wd1}"/><stop offset=".55" stop-color="${T.wd2}"/>` +
    `<stop offset="1" stop-color="${T.wd3}"/></linearGradient>` +
    `<linearGradient id="bk${u}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${T.slotB}"/><stop offset=".7" stop-color="${T.slotA}"/>` +
    `<stop offset="1" stop-color="#8A6440"/></linearGradient>` +
    `<linearGradient id="bp${u}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#9C7850"/><stop offset=".45" stop-color="${T.wd1}"/>` +
    `<stop offset="1" stop-color="#9A7349"/></linearGradient></defs>`;

  // 흰 알약 배지 + 숫자 (선택 시 민트 배지 + 어두운 숫자)
  function badge(cx, cy, label, sel) {
    const fs = label.length > 2 ? 11 : 13;
    const w = label.length * fs * 0.6 + 11;
    return `<rect x="${(cx - w / 2).toFixed(1)}" y="${cy - 9}" width="${w.toFixed(1)}" height="18" rx="9"` +
      ` fill="${sel ? T.mint : T.badge}" stroke="none"/>` + txt(cx, cy, label, fs, sel ? T.ink : T.badgeInk, 800);
  }

  // 선택 가능한 홀드: 음각 슬롯 + 배지 + 넓은 탭 영역
  function holdG(h, x, y, w, ht, sel, u, round) {
    const r = round ? Math.min(w, ht) / 2 : Math.min(9, ht / 2.6);
    return `<g data-hold="${h.id}" style="cursor:pointer">` +
      `<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${ht + 10}" rx="${r + 5}"` +
      ` fill="#000" fill-opacity="0" stroke="none" pointer-events="all"/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${ht}" rx="${r}" fill="url(#bk${u})"` +
      ` stroke="${sel ? T.mint : '#6B4A2E'}" stroke-width="${sel ? 2.6 : 1.2}"/>` +
      (sel ? `<rect x="${x}" y="${y}" width="${w}" height="${ht}" rx="${r}" fill="${T.mint}" fill-opacity=".18" stroke="none"/>` : '') +
      badge(x + w / 2, y + ht / 2, h.label, sel) + '</g>';
  }

  // 장식: 슬로퍼 존(각도 라벨) / 저그 / 레일
  const sloperG = (cx, cy, w, h, deg, u) => {
    const r = Math.min(h / 2, 16);
    return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${r}"` +
      ` fill="url(#bp${u})" stroke="#8A6241" stroke-opacity=".7" stroke-width="1"/>` +
      `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${r}"` +
      ` fill="#1B0F05" fill-opacity=".1" stroke="none"/>` + txt(cx, cy, deg, 12, T.engrave, 700);
  };
  const jugG = (cx, cy, w, h, u) =>
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2.4}"` +
    ` fill="url(#bp${u})" stroke="#8A6241" stroke-opacity=".75" stroke-width="1"/>` +
    `<rect x="${cx - w / 2 + 3.5}" y="${cy - h / 2 + 3.5}" width="${w - 7}" height="${(h * 0.42).toFixed(1)}"` +
    ` rx="${(h * 0.2).toFixed(1)}" fill="url(#bk${u})" stroke="none"/>`;
  const railG = (cx, cy, w, h, u) =>
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}"` +
    ` fill="url(#bp${u})" stroke="#8A6241" stroke-opacity=".6" stroke-width="1"/>`;

  const find = (key, id) => BOARD_HOLDS[key].find(h => h.id === id);

  function bm1000(sel, u) {
    const g = id => find('bm1000', id);
    let s = `<rect x="3" y="4" width="354" height="128" rx="40" fill="url(#bw${u})" stroke="#6E4F34" stroke-width="2"/>` +
      `<rect x="9" y="10" width="342" height="116" rx="34" fill="none" stroke="#F0DEC2" stroke-opacity=".22" stroke-width="1.4"/>`;
    // 윗줄: 35° / 15 / 20° / 저그 / 저그 / 20° / 15 / 35°
    s += sloperG(42, 32, 52, 34, '35\u00B0', u);
    s += holdG(g('t2'), 71, 15, 42, 34, sel === 't2', u);
    s += sloperG(132, 32, 34, 32, '20\u00B0', u);
    s += jugG(164, 32, 28, 30, u) + jugG(196, 32, 28, 30, u);
    s += sloperG(228, 32, 34, 32, '20\u00B0', u);
    s += holdG(g('t7'), 247, 15, 42, 34, sel === 't7', u);
    s += sloperG(318, 32, 52, 34, '35\u00B0', u);
    // 가운뎃줄: 깊은 포켓 7
    [['m1', 43, 40], ['m2', 89, 40], ['m3', 135, 40], ['m4', 180, 46],
    ['m5', 226, 40], ['m6', 272, 40], ['m7', 317, 40]]
      .forEach(([id, cx, w]) => { s += holdG(g(id), cx - w / 2, 57, w, 38, sel === id, u); });
    // 아랫줄: 엣지 6
    [['b1', 51], ['b2', 102], ['b3', 152], ['b4', 203], ['b5', 254], ['b6', 305]]
      .forEach(([id, cx]) => { s += holdG(g(id), cx - 23, 101, 46, 26, sel === id, u); });
    return `<svg class="board-art" viewBox="0 0 360 136">${boardDefs(u)}${s}</svg>`;
  }

  function bm2000(sel, u) {
    const g = id => find('bm2000', id);
    let s = `<rect x="3" y="4" width="354" height="144" rx="16" fill="url(#bw${u})" stroke="#6E4F34" stroke-width="2"/>` +
      `<rect x="9" y="10" width="342" height="132" rx="11" fill="none" stroke="#F0DEC2" stroke-opacity=".22" stroke-width="1.4"/>`;
    s += `<text x="180" y="20" dy=".34em" text-anchor="middle" fill="${T.engrave}" fill-opacity=".55" stroke="none"` +
      ` font-size="9" font-weight="700" font-family="system-ui,-apple-system,sans-serif"` +
      ` style="letter-spacing:.22em">beastmaker</text>`;
    // 윗줄 슬로퍼(장식)
    [[42, 62, '45\u00B0'], [110, 60, '35\u00B0'], [180, 56, '20\u00B0'], [250, 60, '35\u00B0'], [318, 62, '45\u00B0']]
      .forEach(([cx, w, d]) => { s += sloperG(cx, 34, w, 28, d, u); });
    // 상단 중앙 포켓 2 + 좌우 레일(장식)
    s += railG(70, 61, 108, 22, u) + railG(290, 61, 108, 22, u);
    s += holdG(g('u1'), 126, 48, 48, 26, sel === 'u1', u);
    s += holdG(g('u2'), 186, 48, 48, 26, sel === 'u2', u);
    // 가운뎃줄 9 (m2/m8 은 작은 원형 모노 포켓)
    [['m1', 27, 30, 0], ['m2', 59, 28, 1], ['m3', 99, 46, 0], ['m4', 142, 30, 0], ['m5', 180, 36, 0],
    ['m6', 218, 30, 0], ['m7', 261, 46, 0], ['m8', 301, 28, 1], ['m9', 333, 30, 0]]
      .forEach(([id, cx, w, rd]) => {
        const ht = rd ? 28 : 32, y = rd ? 82 : 80;
        s += holdG(g(id), cx - w / 2, y, w, ht, sel === id, u, rd);
      });
    // 아랫줄 9 (b2/b8 은 작은 원형 2핑거 포켓)
    [['b1', 27, 30, 0], ['b2', 59, 28, 1], ['b3', 99, 34, 0], ['b4', 142, 30, 0], ['b5', 180, 36, 0],
    ['b6', 218, 30, 0], ['b7', 261, 34, 0], ['b8', 301, 28, 1], ['b9', 333, 30, 0]]
      .forEach(([id, cx, w, rd]) => {
        s += holdG(g(id), cx - w / 2, 116, w, 28, sel === id, u, rd);
      });
    return `<svg class="board-art" viewBox="0 0 360 152">${boardDefs(u)}${s}</svg>`;
  }

  function crimpBoard(sel, u) {
    const lipH = { c10: 18, c8: 14, c6: 11 };
    let s = '';
    BOARD_HOLDS.crimp.forEach((h, i) => {
      const cx = 66 + i * 114, x = cx - 50, on = sel === h.id, lh = lipH[h.id] + 8, by = 22 + lh;
      const bcy = by + (100 - by) * 0.4;
      s += `<g data-hold="${h.id}" style="cursor:pointer">`;
      s += `<rect x="${x - 6}" y="16" width="112" height="92" rx="16" fill="#000" fill-opacity="0" stroke="none" pointer-events="all"/>`;
      // 엣지 레일 — 두께가 깊이(mm)를 뜻한다
      s += `<rect x="${x - 3}" y="22" width="106" height="${lh}" rx="5" fill="url(#bp${u})"` +
        ` stroke="${on ? T.mint : '#6E4F34'}" stroke-width="${on ? 2.6 : 1.4}"/>`;
      s += `<rect x="${x - 3}" y="22" width="106" height="3" rx="1.5" fill="#FAF0DD" fill-opacity=".55" stroke="none"/>`;
      // 블록 몸통
      s += `<rect x="${x}" y="${by}" width="100" height="${100 - by}" rx="11" fill="url(#bw${u})"` +
        ` stroke="${on ? T.mint : '#6E4F34'}" stroke-width="${on ? 2.6 : 1.4}"/>`;
      if (on) s += `<rect x="${x}" y="${by}" width="100" height="${100 - by}" rx="11" fill="${T.mint}" fill-opacity=".14" stroke="none"/>`;
      s += `<circle cx="${cx - 30}" cy="${by + 9}" r="3" fill="#6B4A2E" fill-opacity=".55" stroke="none"/>`;
      s += `<circle cx="${cx + 30}" cy="${by + 9}" r="3" fill="#6B4A2E" fill-opacity=".55" stroke="none"/>`;
      s += badge(cx, bcy, h.label, on);
      s += txt(cx, bcy + 17, 'mm', 10, T.engrave, 700);
      s += '</g>';
    });
    return `<svg class="board-art" viewBox="0 0 360 112">${boardDefs(u)}${s}</svg>`;
  }

  function board(key, sel) {
    const u = nid();
    if (key === 'bm2000') return bm2000(sel, u);
    if (key === 'crimp') return crimpBoard(sel, u);
    return bm1000(sel, u);
  }

  return { hand, board };
})();

/* ================= 보드 홀드 데이터 ================= */
const BOARD_HOLDS = {
  bm1000: [
    { id: 't2', mm: 15, label: '15' }, { id: 't7', mm: 15, label: '15' },
    { id: 'm1', mm: 45, label: '45' }, { id: 'm2', mm: 50, label: '50' }, { id: 'm3', mm: 45, label: '45' },
    { id: 'm4', mm: 53, label: '53' }, { id: 'm5', mm: 45, label: '45' }, { id: 'm6', mm: 50, label: '50' },
    { id: 'm7', mm: 45, label: '45' },
    { id: 'b1', mm: 20, label: '20' }, { id: 'b2', mm: 25, label: '25' }, { id: 'b3', mm: 20, label: '20' },
    { id: 'b4', mm: 20, label: '20' }, { id: 'b5', mm: 25, label: '25' }, { id: 'b6', mm: 20, label: '20' },
  ],
  bm2000: [
    { id: 'u1', mm: 40, label: '40' }, { id: 'u2', mm: 20, label: '20' },
    { id: 'm1', mm: 33, label: '33' }, { id: 'm2', mm: 45, label: '45' }, { id: 'm3', mm: 35, label: '35\u00B750' },
    { id: 'm4', mm: 30, label: '30' }, { id: 'm5', mm: 53, label: '53' }, { id: 'm6', mm: 30, label: '30' },
    { id: 'm7', mm: 35, label: '50\u00B735' }, { id: 'm8', mm: 45, label: '45' }, { id: 'm9', mm: 33, label: '33' },
    { id: 'b1', mm: 15, label: '15' }, { id: 'b2', mm: 26, label: '26' }, { id: 'b3', mm: 20, label: '20' },
    { id: 'b4', mm: 20, label: '20' }, { id: 'b5', mm: 22, label: '22' }, { id: 'b6', mm: 20, label: '20' },
    { id: 'b7', mm: 20, label: '20' }, { id: 'b8', mm: 26, label: '26' }, { id: 'b9', mm: 15, label: '15' },
  ],
  crimp: [
    { id: 'c10', mm: 10, label: '10' }, { id: 'c8', mm: 8, label: '8' }, { id: 'c6', mm: 6, label: '6' },
  ],
};

const BOARD_NAMES = { bm1000: 'Beastmaker 1000', bm2000: 'Beastmaker 2000', crimp: '크림프 엣지' };

/* ================= 공개 API ================= */
function handSVG(fingers, side, grip) { return ART_.hand(fingers, side, grip); }
function boardSVG(boardKey, selectedId) { return ART_.board(boardKey, selectedId); }
