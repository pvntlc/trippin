// Trippin 앱 아이콘 생성기 (개발용, 앱 번들엔 미포함).
// 디자인: 하늘색 그라데이션 + 입체 종이비행기 + 점선 여행경로.
// 실행: npm install sharp --no-save && node scripts/generate-icons.js
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets");
fs.mkdirSync(OUT, { recursive: true });

// 하늘 그라데이션 정의 (위 밝은 하늘 → 아래 진한 파랑)
const GRAD = `
  <linearGradient id="sky" x1="0.15" y1="0" x2="0.85" y2="1">
    <stop offset="0" stop-color="#6fd0fb"/>
    <stop offset="0.5" stop-color="#2aa6e8"/>
    <stop offset="1" stop-color="#0c6fb8"/>
  </linearGradient>
  <linearGradient id="planeShade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#eaf6ff"/>
    <stop offset="1" stop-color="#bcdcf5"/>
  </linearGradient>
`;

// 점선 여행 경로 + 출발 점 (배경용)
const PATH = `
  <g opacity="0.55">
    <path d="M205 820 C 360 700, 470 760, 540 590 S 760 360, 880 300"
          fill="none" stroke="#ffffff" stroke-width="20"
          stroke-linecap="round" stroke-dasharray="0.1 46"/>
    <circle cx="205" cy="820" r="26" fill="#ffffff"/>
    <circle cx="205" cy="820" r="11" fill="#1f8fd6"/>
  </g>
`;

// 입체 종이비행기 (send 아이콘 두 면 + 중앙 접힘선). 중심 (cx,cy), scale s, 회전 rot.
function plane(cx, cy, s, rot) {
  return `
  <g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${s}) translate(-12.5 -12)">
    <polygon points="2,3 23,12 17,12 2,10" fill="#ffffff"/>
    <polygon points="2,21 23,12 17,12 2,14" fill="url(#planeShade)"/>
    <polyline points="2,10 17,12 2,14" fill="none" stroke="#9cc6ea" stroke-width="0.4"/>
  </g>`;
}

// 1) 풀 아이콘 (iOS/웹/폴백): 그라데이션 + 경로 + 비행기
const iconFull = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${GRAD}</defs>
  <rect width="1024" height="1024" fill="url(#sky)"/>
  ${PATH}
  ${plane(575, 470, 30, -20)}
</svg>`;

// 2) 안드로이드 적응형 전경 (가운데 안전영역, 투명 배경, 비행기만)
const fg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${GRAD}</defs>
  ${plane(512, 512, 26, -20)}
</svg>`;

// 3) 안드로이드 적응형 배경 (그라데이션 + 경로)
const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${GRAD}</defs>
  <rect width="1024" height="1024" fill="url(#sky)"/>
  ${PATH}
</svg>`;

// 4) 스플래시 아이콘 (투명 배경 비행기, 약간 작게)
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${GRAD}</defs>
  ${plane(512, 512, 22, -20)}
</svg>`;

async function render(svg, file, size = 1024) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(OUT, file));
  console.log("  ✓", file);
}

(async () => {
  await render(iconFull, "icon.png");
  await render(fg, "adaptive-icon.png");
  await render(bg, "adaptive-bg.png");
  await render(splash, "splash-icon.png");
  await render(iconFull, "favicon.png", 192);
  console.log("아이콘 생성 완료 →", OUT);
})();
