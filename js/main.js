'use strict';
// 시작: 첫 화면 그리기, 공유 링크 처리, 처음 사용법 안내, 오프라인 캐시 등록

/* ---------- 처음 사용법 안내 (3장) ---------- */
let introAt = 0;
const INTRO_N = 3;
const isInstalled = () => navigator.standalone || matchMedia('(display-mode: standalone)').matches;

function showIntro(i) {
  introAt = i;
  document.querySelectorAll('.intro-slide').forEach(s => { s.hidden = +s.dataset.slide !== i; });
  document.querySelectorAll('#intro-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
  $('btn-intro-next').textContent = i === INTRO_N - 1 ? '시작하기' : '다음';
  $('intro').hidden = false;
}
function closeIntro() {
  $('intro').hidden = true;
  settings.seenIntro = true;
  saveSettings();
}
if (isInstalled()) $('intro-install').innerHTML = '홈 화면 앱으로 실행 중이에요.<br>인터넷이 없어도 동작해요.';
$('btn-intro-next').addEventListener('click', () => (introAt < INTRO_N - 1 ? showIntro(introAt + 1) : closeIntro()));
$('btn-intro-skip').addEventListener('click', closeIntro);
$('btn-intro-again').addEventListener('click', () => { show('setup'); showIntro(0); });

/* ================= 시작 ================= */
renderSetup();
const openedFromLink = location.hash.length > 1; // 공유 링크로 열면 안내보다 가져오기를 먼저
importFromHash();
if (!settings.seenIntro && !openedFromLink) showIntro(0);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
