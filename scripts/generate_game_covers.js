const fs = require('fs');
const path = require('path');

const WIDTH = 960;
const HEIGHT = 540;

const games = [
  {
    slug: 'reversi',
    title: 'REVERSI',
    subtitle: 'Online Masa Oyunu',
    theme: ['#113a63', '#2f855a', '#efd39a'],
    art: reversiArt
  },
  {
    slug: 'xox',
    title: 'XOX',
    subtitle: 'Online Masa Oyunu',
    theme: ['#0f3f63', '#2563eb', '#bfdbfe'],
    art: xoxArt
  },
  {
    slug: 'sos',
    title: 'SOS',
    subtitle: 'Online Masa Oyunu',
    theme: ['#17395c', '#8b5cf6', '#fde68a'],
    art: sosArt
  },
  {
    slug: 'kutu-doldurmaca',
    title: 'KUTU DOLDURMACA',
    subtitle: 'Online Masa Oyunu',
    theme: ['#153f68', '#3b82f6', '#f8fafc'],
    art: dotsArt
  },
  {
    slug: 'yilanlar-ve-merdivenler',
    title: 'YILANLAR VE MERDIVENLER',
    subtitle: 'Online Masa Oyunu',
    theme: ['#24452f', '#84cc16', '#fde68a'],
    art: snakesArt
  },
  {
    slug: '9-tas',
    title: '9 TAS',
    subtitle: 'Online Masa Oyunu',
    theme: ['#40203b', '#ec4899', '#fbcfe8'],
    art: nineMenArt
  },
  {
    slug: '3-tas',
    title: '3 TAS',
    subtitle: 'Online Masa Oyunu',
    theme: ['#11424a', '#14b8a6', '#ccfbf1'],
    art: threeMenArt
  },
  {
    slug: 'kuyulamac',
    title: 'KUYULAMAC',
    subtitle: 'Online Masa Oyunu',
    theme: ['#5b341c', '#f59e0b', '#fde68a'],
    art: kuyulamacArt
  },
  {
    slug: 'mangala',
    title: 'MANGALA',
    subtitle: 'Online Masa Oyunu',
    theme: ['#5a3418', '#d97706', '#fde68a'],
    art: mangalaArt
  },
  {
    slug: 'abalone',
    title: 'ABALONE',
    subtitle: 'Online Masa Oyunu',
    theme: ['#4a2d17', '#f97316', '#fed7aa'],
    art: abaloneArt
  },
  {
    slug: 'tavla',
    title: 'TAVLA',
    subtitle: 'Online Masa Oyunu',
    theme: ['#4c2d24', '#fb7185', '#fecdd3'],
    art: tavlaArt
  },
  {
    slug: 'koridor',
    title: 'KORIDOR',
    subtitle: 'Online Masa Oyunu',
    theme: ['#1c3b55', '#38bdf8', '#bae6fd'],
    art: koridorArt
  },
  {
    slug: 'domino',
    title: 'DOMINO',
    subtitle: 'Online Masa Oyunu',
    theme: ['#30364a', '#a78bfa', '#ddd6fe'],
    art: dominoArt
  },
  {
    slug: 'go',
    title: 'GO',
    subtitle: 'Online Masa Oyunu',
    theme: ['#3d2a16', '#d97706', '#fef3c7'],
    art: goArt
  },
  {
    slug: 'dama',
    title: 'DAMA',
    subtitle: 'Online Masa Oyunu',
    theme: ['#43210d', '#b45309', '#fde68a'],
    art: damaArt
  },
  {
    slug: 'capraz-dama',
    title: 'CAPRAZ DAMA',
    subtitle: 'Online Masa Oyunu',
    theme: ['#203252', '#2563eb', '#bfdbfe'],
    art: caprazDamaArt
  },
  {
    slug: 'satranc',
    title: 'SATRANC',
    subtitle: 'Online Masa Oyunu',
    theme: ['#2d3748', '#64748b', '#f8fafc'],
    art: satrancArt
  },
  {
    slug: 'dortlu-birlestir',
    title: '4LU BIRLESTIR',
    subtitle: 'Online Masa Oyunu',
    theme: ['#1e3a8a', '#2563eb', '#facc15'],
    art: connectFourArt
  },
  {
    slug: 'mastermind',
    title: 'MASTERMIND',
    subtitle: 'Online Masa Oyunu',
    theme: ['#3f2256', '#a855f7', '#f5d0fe'],
    art: mastermindArt
  },
  {
    slug: 'kizma-birader',
    title: 'KIZMA BIRADER',
    subtitle: 'Online Masa Oyunu',
    theme: ['#173463', '#3b82f6', '#fef08a'],
    art: ludoArt
  },
  {
    slug: 'nane-okey',
    title: 'NANE OKEY',
    subtitle: 'Windows Oyunu',
    theme: ['#0f3d2b', '#2e8b57', '#e7d7ad'],
    art: okeyArt
  },
  {
    slug: 'kenan-desert',
    title: 'KENAN',
    subtitle: 'Sunucu Oyunu',
    theme: ['#22456f', '#f59e0b', '#fed7aa'],
    art: kenanArt
  }
];

const outDir = path.join(__dirname, '..', 'frontend', 'public', 'images');

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function frameSvg({ slug, title, subtitle, theme, art }) {
  const [bgA, bgB, accent] = theme;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="${slug}-title ${slug}-desc">
  <title id="${slug}-title">${esc(title)} oyun kartı</title>
  <desc id="${slug}-desc">${esc(title)} için ortak temada oyun kartı görseli.</desc>
  <defs>
    <linearGradient id="${slug}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bgA}"/>
      <stop offset="1" stop-color="${bgB}"/>
    </linearGradient>
    <linearGradient id="${slug}-panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,.18)"/>
      <stop offset="1" stop-color="rgba(255,255,255,.06)"/>
    </linearGradient>
    <filter id="${slug}-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#081018" flood-opacity=".28"/>
    </filter>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#${slug}-bg)"/>
  <circle cx="132" cy="92" r="118" fill="${accent}" opacity=".22"/>
  <circle cx="830" cy="434" r="154" fill="#ffffff" opacity=".08"/>
  <g filter="url(#${slug}-shadow)">
    <rect x="56" y="42" width="848" height="456" rx="34" fill="rgba(14,20,26,.18)"/>
    <rect x="74" y="60" width="812" height="420" rx="28" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.16)"/>
    <rect x="104" y="100" width="752" height="254" rx="26" fill="rgba(7,10,14,.18)" stroke="rgba(255,255,255,.12)"/>
    ${art({ accent, bgA, bgB, slug })}
    <text x="118" y="405" fill="rgba(255,255,255,.72)" font-family="Verdana, sans-serif" font-size="16" font-weight="700" letter-spacing="3">${esc(subtitle.toUpperCase())}</text>
    <text x="118" y="448" fill="#fff7ea" font-family="Georgia, serif" font-size="48" font-weight="700">${esc(title)}</text>
  </g>
</svg>`;
}

function boardBase() {
  return `
    <rect x="244" y="122" width="472" height="212" rx="26" fill="rgba(20,26,34,.22)"/>
    <rect x="264" y="142" width="432" height="172" rx="18" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.16)"/>
  `;
}

function reversiArt() {
  return `
    ${boardBase()}
    <rect x="296" y="162" width="368" height="132" rx="16" fill="#0f7c52"/>
    <g stroke="rgba(248,243,228,.18)" stroke-width="3">
      <path d="M342 162v132M388 162v132M434 162v132M480 162v132M526 162v132M572 162v132M618 162v132"/>
      <path d="M296 195h368M296 228h368M296 261h368"/>
    </g>
    <g>
      <circle cx="454" cy="213" r="22" fill="#fbf4df"/><circle cx="506" cy="213" r="22" fill="#101713"/>
      <circle cx="454" cy="246" r="22" fill="#101713"/><circle cx="506" cy="246" r="22" fill="#fbf4df"/>
      <circle cx="558" cy="246" r="22" fill="#fbf4df"/><circle cx="402" cy="213" r="22" fill="#101713"/>
    </g>`;
}

function xoxArt() {
  return `
    ${boardBase()}
    <g stroke="#f8fafc" stroke-width="10" stroke-linecap="round">
      <path d="M372 168v120M480 168v120M588 168v120"/>
      <path d="M324 206h312M324 254h312"/>
    </g>
    <g fill="none" stroke-width="12" stroke-linecap="round">
      <path d="M348 181l38 38m0-38-38 38" stroke="#f97316"/>
      <circle cx="480" cy="200" r="25" stroke="#60a5fa"/>
      <path d="M576 237l38 38m0-38-38 38" stroke="#f97316"/>
      <circle cx="372" cy="256" r="25" stroke="#60a5fa"/>
    </g>`;
}

function sosArt() {
  return `
    ${boardBase()}
    <rect x="308" y="178" width="344" height="100" rx="18" fill="rgba(8,12,18,.18)" stroke="rgba(255,255,255,.16)"/>
    <g font-family="Georgia, serif" font-weight="700" font-size="82">
      <text x="344" y="247" fill="#fef3c7">S</text>
      <text x="448" y="247" fill="#bfdbfe">O</text>
      <text x="550" y="247" fill="#fef3c7">S</text>
    </g>
    <path d="M334 260h270" stroke="#ffffff" stroke-width="6" opacity=".22" stroke-linecap="round"/>`;
}

function dotsArt() {
  let dots = '';
  let hLines = '';
  let vLines = '';
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      const cx = 344 + c * 68;
      const cy = 170 + r * 34;
      dots += `<circle cx="${cx}" cy="${cy}" r="8" fill="#f8fafc"/>`;
      if (c < 4) {
        hLines += `<rect x="${cx + 14}" y="${cy - 5}" width="40" height="10" rx="5" fill="${(r + c) % 2 === 0 ? '#60a5fa' : 'rgba(255,255,255,.22)'}"/>`;
      }
      if (r < 4) {
        vLines += `<rect x="${cx - 5}" y="${cy + 14}" width="10" height="20" rx="5" fill="${(r + c) % 2 === 1 ? '#fb923c' : 'rgba(255,255,255,.22)'}"/>`;
      }
    }
  }
  return `${boardBase()}${hLines}${vLines}${dots}<rect x="470" y="218" width="54" height="40" rx="12" fill="rgba(59,130,246,.85)"/><rect x="402" y="218" width="54" height="40" rx="12" fill="rgba(249,115,22,.85)"/>`;
}

function snakesArt() {
  return `
    ${boardBase()}
    <g>
      ${Array.from({ length: 6 }).map((_, c) => `<path d="M316 ${166 + c * 28}h328" stroke="rgba(255,255,255,.14)" stroke-width="2"/>`).join('')}
      ${Array.from({ length: 7 }).map((_, c) => `<path d="M316 ${166}v140" transform="translate(${c * 54} 0)" stroke="rgba(255,255,255,.14)" stroke-width="2"/>`).join('')}
    </g>
    <path d="M368 278c42-88 95-118 156-124" stroke="#fef08a" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M532 176c18 10 24 22 20 38" stroke="#fef08a" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M604 170c-36 18-56 48-64 92-10 52-48 78-112 84" stroke="#22c55e" stroke-width="12" fill="none" stroke-linecap="round"/>
    <circle cx="606" cy="170" r="12" fill="#22c55e"/>
    <circle cx="612" cy="166" r="2.5" fill="#fff"/>
    <circle cx="601" cy="166" r="2.5" fill="#fff"/>
    <circle cx="388" cy="278" r="16" fill="#60a5fa"/>`;
}

function nineMenArt() {
  return `
    ${boardBase()}
    <g stroke="#f8fafc" stroke-width="6" fill="none">
      <rect x="336" y="170" width="288" height="116"/>
      <rect x="390" y="192" width="180" height="72"/>
      <rect x="444" y="214" width="72" height="28"/>
      <path d="M480 170v44M480 242v44M336 228h108M516 228h108"/>
    </g>
    <g>
      <circle cx="336" cy="170" r="14" fill="#f472b6"/>
      <circle cx="624" cy="170" r="14" fill="#f472b6"/>
      <circle cx="390" cy="192" r="14" fill="#fef3c7"/>
      <circle cx="570" cy="264" r="14" fill="#fef3c7"/>
      <circle cx="516" cy="214" r="14" fill="#f472b6"/>
      <circle cx="444" cy="242" r="14" fill="#fef3c7"/>
    </g>`;
}

function threeMenArt() {
  return `
    ${boardBase()}
    <g stroke="#f8fafc" stroke-width="8" stroke-linecap="round">
      <path d="M374 176v116M480 176v116M586 176v116"/>
      <path d="M326 214h308M326 252h308"/>
    </g>
    <g>
      <circle cx="374" cy="214" r="24" fill="#14b8a6"/>
      <circle cx="480" cy="176" r="24" fill="#fef3c7"/>
      <circle cx="586" cy="252" r="24" fill="#14b8a6"/>
    </g>`;
}

function kuyulamacArt() {
  return `
    ${boardBase()}
    <rect x="318" y="182" width="324" height="92" rx="24" fill="rgba(70,34,10,.74)" stroke="rgba(255,248,220,.18)"/>
    <g>${[0,1,2,3,4].map((i) => `<ellipse cx="${364 + i * 68}" cy="228" rx="24" ry="34" fill="rgba(16,10,6,.4)"/>`).join('')}</g>
    <g>${[0,1,2,3,4].map((i) => `<circle cx="${352 + i * 68}" cy="214" r="8" fill="#93c5fd"/><circle cx="${376 + i * 68}" cy="228" r="8" fill="#fef3c7"/><circle cx="${360 + i * 68}" cy="246" r="8" fill="#fb923c"/>`).join('')}</g>`;
}

function mangalaArt() {
  return `
    ${boardBase()}
    <rect x="300" y="178" width="360" height="100" rx="28" fill="rgba(82,44,12,.8)" stroke="rgba(255,244,214,.16)"/>
    <ellipse cx="330" cy="228" rx="28" ry="40" fill="rgba(22,12,6,.34)"/>
    <ellipse cx="630" cy="228" rx="28" ry="40" fill="rgba(22,12,6,.34)"/>
    ${[0,1,2,3,4,5].map((i) => `<ellipse cx="${380 + i * 40}" cy="228" rx="16" ry="28" fill="rgba(22,12,6,.34)"/>`).join('')}
    <g>${[0,1,2,3,4,5].map((i) => `<circle cx="${372 + i * 40}" cy="220" r="7" fill="#fef3c7"/><circle cx="${387 + i * 40}" cy="236" r="7" fill="#60a5fa"/><circle cx="${377 + i * 40}" cy="248" r="7" fill="#f97316"/>`).join('')}</g>`;
}

function abaloneArt() {
  const coords = [
    [402,188],[454,188],[506,188],[558,188],
    [376,226],[428,226],[480,226],[532,226],[584,226],
    [402,264],[454,264],[506,264],[558,264]
  ];
  return `${boardBase()}<g>${coords.map(([x,y], i) => `<circle cx="${x}" cy="${y}" r="22" fill="${i % 3 === 0 ? '#111827' : i % 3 === 1 ? '#f8fafc' : '#111827'}" stroke="${i % 3 === 1 ? '#d1d5db' : '#64748b'}" stroke-width="3"/>`).join('')}</g>`;
}

function tavlaArt() {
  return `
    ${boardBase()}
    <rect x="318" y="168" width="324" height="124" rx="18" fill="#6b3e21"/>
    <path d="M372 178l24 98 24-98M428 178l24 98 24-98M484 178l24 98 24-98M540 178l24 98 24-98" fill="#fef3c7" opacity=".84"/>
    <path d="M400 178l24 98 24-98M456 178l24 98 24-98M512 178l24 98 24-98M568 178l24 98 24-98" fill="#1f2937" opacity=".88"/>
    <rect x="346" y="206" width="46" height="46" rx="12" fill="#fff"/>
    <circle cx="360" cy="220" r="4" fill="#111827"/><circle cx="378" cy="238" r="4" fill="#111827"/>
    <rect x="584" y="206" width="46" height="46" rx="12" fill="#fff"/>
    <circle cx="598" cy="220" r="4" fill="#111827"/><circle cx="616" cy="220" r="4" fill="#111827"/><circle cx="607" cy="238" r="4" fill="#111827"/>`;
}

function koridorArt() {
  return `
    ${boardBase()}
    <g stroke="rgba(255,255,255,.16)" stroke-width="2">
      ${Array.from({ length: 9 }).map((_, i) => `<path d="M340 ${170 + i * 16}h280"/>`).join('')}
      ${Array.from({ length: 9 }).map((_, i) => `<path d="M340 ${170}v128" transform="translate(${i * 35} 0)"/>`).join('')}
    </g>
    <circle cx="408" cy="282" r="18" fill="#fef3c7"/>
    <circle cx="552" cy="186" r="18" fill="#38bdf8"/>
    <rect x="474" y="202" width="16" height="74" rx="8" fill="#f97316"/>
    <rect x="420" y="232" width="74" height="16" rx="8" fill="#f97316"/>`;
}

function dominoArt() {
  return `
    ${boardBase()}
    <g transform="translate(366 182)">
      <rect width="90" height="136" rx="16" fill="#f8fafc"/>
      <path d="M0 68h90" stroke="#1f2937" stroke-width="6"/>
      <circle cx="45" cy="34" r="6" fill="#111827"/>
      <circle cx="27" cy="100" r="6" fill="#111827"/><circle cx="45" cy="118" r="6" fill="#111827"/><circle cx="63" cy="100" r="6" fill="#111827"/>
    </g>
    <g transform="translate(500 162) rotate(10)">
      <rect width="90" height="136" rx="16" fill="#f8fafc"/>
      <path d="M0 68h90" stroke="#1f2937" stroke-width="6"/>
      <circle cx="27" cy="30" r="6" fill="#111827"/><circle cx="63" cy="30" r="6" fill="#111827"/>
      <circle cx="27" cy="104" r="6" fill="#111827"/><circle cx="45" cy="86" r="6" fill="#111827"/><circle cx="63" cy="104" r="6" fill="#111827"/>
    </g>`;
}

function goArt() {
  return `
    ${boardBase()}
    <rect x="320" y="166" width="320" height="124" rx="12" fill="#d29b47"/>
    <g stroke="rgba(80,46,10,.4)" stroke-width="3">
      ${Array.from({ length: 9 }).map((_, i) => `<path d="M352 ${182 + i * 14}h256"/>`).join('')}
      ${Array.from({ length: 9 }).map((_, i) => `<path d="M352 ${182}v112" transform="translate(${i * 32} 0)"/>`).join('')}
    </g>
    <circle cx="448" cy="224" r="20" fill="#111827"/>
    <circle cx="512" cy="224" r="20" fill="#f8fafc" stroke="#d1d5db" stroke-width="3"/>
    <circle cx="544" cy="252" r="20" fill="#111827"/>
    <circle cx="416" cy="252" r="20" fill="#f8fafc" stroke="#d1d5db" stroke-width="3"/>`;
}

function damaArt() {
  return `
    ${boardBase()}
    <rect x="330" y="158" width="300" height="144" rx="18" fill="#5b3a1b"/>
    ${Array.from({ length: 8 }).map((_, r) => Array.from({ length: 8 }).map((__, c) => `<rect x="${342 + c * 36}" y="${170 + r * 16}" width="36" height="16" fill="${(r + c) % 2 === 0 ? '#fef3c7' : '#5b3a1b'}"/>`).join('')).join('')}
    <circle cx="396" cy="202" r="16" fill="#111827"/><circle cx="540" cy="250" r="16" fill="#111827"/><circle cx="504" cy="202" r="16" fill="#f97316"/><circle cx="432" cy="250" r="16" fill="#f97316"/>`;
}

function caprazDamaArt() {
  return `
    ${damaArt()}
    <path d="M414 268l90-52" stroke="#60a5fa" stroke-width="8" stroke-linecap="round" opacity=".9"/>`;
}

function satrancArt() {
  return `
    ${boardBase()}
    <rect x="330" y="158" width="300" height="144" rx="18" fill="#374151"/>
    ${Array.from({ length: 8 }).map((_, r) => Array.from({ length: 8 }).map((__, c) => `<rect x="${342 + c * 36}" y="${170 + r * 16}" width="36" height="16" fill="${(r + c) % 2 === 0 ? '#f8fafc' : '#1f2937'}"/>`).join('')).join('')}
    <path d="M390 234h30l-6-18h-18zM398 216v-28h14v28M468 246h30l-6-18h-18zM476 228v-48h14v48M548 234h30l-6-18h-18zM556 216v-28h14v28" fill="#f8fafc"/>`;
}

function connectFourArt() {
  return `
    ${boardBase()}
    <rect x="350" y="154" width="260" height="156" rx="24" fill="#2563eb"/>
    ${Array.from({ length: 6 }).map((_, r) => Array.from({ length: 7 }).map((__, c) => `<circle cx="${382 + c * 36}" cy="${186 + r * 22}" r="12" fill="${(r === 4 && c > 1 && c < 5) ? '#facc15' : (r + c) % 4 === 0 ? '#f87171' : '#dbeafe'}"/>`).join('')).join('')}`;
}

function mastermindArt() {
  return `
    ${boardBase()}
    <rect x="336" y="164" width="288" height="136" rx="22" fill="rgba(12,8,18,.22)" stroke="rgba(255,255,255,.14)"/>
    ${[0,1,2,3].map((r) => [0,1,2,3,4].map((c) => `<circle cx="${384 + c * 44}" cy="${196 + r * 28}" r="11" fill="${['#fb7185','#f59e0b','#60a5fa','#34d399','#f472b6'][(r + c) % 5]}"/>`).join('')).join('')}
    <rect x="592" y="184" width="18" height="96" rx="9" fill="#f8fafc"/><circle cx="601" cy="214" r="5" fill="#111827"/><circle cx="601" cy="236" r="5" fill="#111827"/><circle cx="601" cy="258" r="5" fill="#f8fafc" stroke="#111827" stroke-width="2"/>`;
}

function ludoArt() {
  return `
    ${boardBase()}
    <rect x="332" y="164" width="112" height="112" rx="22" fill="rgba(34,197,94,.26)" stroke="#22c55e" stroke-width="4"/>
    <rect x="516" y="164" width="112" height="112" rx="22" fill="rgba(168,85,247,.26)" stroke="#a855f7" stroke-width="4"/>
    <rect x="332" y="204" width="296" height="32" rx="16" fill="rgba(255,255,255,.14)"/>
    <circle cx="390" cy="220" r="18" fill="#22c55e"/><circle cx="570" cy="220" r="18" fill="#a855f7"/>
    <circle cx="448" cy="220" r="18" fill="#f97316"/><circle cx="512" cy="220" r="18" fill="#ef4444"/>
    <path d="M480 164v112M332 220h296" stroke="#ffffff" stroke-opacity=".22" stroke-width="6"/>`;
}

function okeyArt() {
  return `
    ${boardBase()}
    <rect x="292" y="158" width="376" height="144" rx="20" fill="#1f5d49"/>
    <g stroke="rgba(255,255,255,.16)" stroke-width="2">
      ${Array.from({ length: 10 }).map((_, i) => `<path d="M320 ${176}v108" transform="translate(${i * 34} 0)"/>`).join('')}
      ${Array.from({ length: 4 }).map((_, i) => `<path d="M292 ${194 + i * 26}h376"/>`).join('')}
    </g>
    <g>
      <rect x="364" y="188" width="50" height="70" rx="6" fill="#fff8ee"/><text x="389" y="233" text-anchor="middle" fill="#dc2626" font-family="Verdana" font-size="28" font-weight="700">1</text>
      <rect x="430" y="188" width="50" height="70" rx="6" fill="#fff8ee"/><text x="455" y="233" text-anchor="middle" fill="#2563eb" font-family="Verdana" font-size="28" font-weight="700">2</text>
      <rect x="496" y="188" width="50" height="70" rx="6" fill="#fff8ee"/><text x="521" y="233" text-anchor="middle" fill="#16a34a" font-family="Verdana" font-size="28" font-weight="700">3</text>
    </g>`;
}

function kenanArt() {
  return `
    ${boardBase()}
    <rect x="288" y="150" width="384" height="156" rx="20" fill="rgba(255,181,89,.28)"/>
    <circle cx="620" cy="178" r="44" fill="#ffd36e"/>
    <path d="M304 272c112-70 212-82 300-28 84 52 144 56 228 10v52H288z" fill="#9e5b2e"/>
    <path d="M288 294c130-48 254-42 364 10 84 40 154 42 220 0v30H288z" fill="#e7a64f"/>
    <path d="M710 196c-6-28 8-56 34-78-2 36-12 62-34 78z" fill="#263025"/>
    <path d="M722 204c26-16 55-15 85 2-30 14-58 13-85-2z" fill="#263025"/>
    <rect x="712" y="196" width="12" height="86" rx="6" fill="#263025"/>`;
}

fs.mkdirSync(outDir, { recursive: true });
games.forEach((game) => {
  fs.writeFileSync(path.join(outDir, `${game.slug}.svg`), frameSvg(game), 'utf8');
});
console.log(`Generated ${games.length} covers in ${outDir}`);
