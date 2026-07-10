// Yeni kategori ikonları — mevcut /icons/*.png ailesinin diline (terracotta #BB3619,
// kalın yuvarlak-uçlu strok, yüzsüz yuvarlak kafa, alt gölge, şeffaf zemin) uygun
// el-yazımı line-art. sharp ile PNG'e basılır. Çalıştır: node scripts/gen-category-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');

const C = '#BB3619';
const SHADOW = 'rgba(26,18,14,0.06)';

// Ortak sarmalayıcı: 460×600, alt gölge + kalın strok grup.
function wrap(inner, note = '') {
  return `<svg width="460" height="600" viewBox="0 0 460 600" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="230" cy="576" rx="120" ry="15" fill="${SHADOW}"/>
  <g stroke="${C}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${inner}
  </g>
  ${note}
</svg>`;
}

// 8'lik nota (dolgu kafa + sap + bayrak)
function note(cx, cy) {
  return `<g fill="${C}" stroke="none">
    <ellipse cx="${cx}" cy="${cy}" rx="16" ry="13" transform="rotate(-20 ${cx} ${cy})"/>
  </g>
  <g stroke="${C}" stroke-width="12" stroke-linecap="round" fill="none">
    <path d="M${cx + 14} ${cy - 6} L${cx + 14} ${cy - 70}"/>
    <path d="M${cx + 14} ${cy - 70} Q ${cx + 46} ${cy - 60} ${cx + 40} ${cy - 34}"/>
  </g>`;
}

// DANSÇI — neşeli poz: iki kol yukarı (Y), bacaklar açık; sağ üstte nota
const dansci = wrap(
  `
    <circle cx="196" cy="92" r="48"/>
    <path d="M200 140 L 216 298"/>
    <path d="M198 172 Q 150 150 116 96"/>
    <path d="M210 178 Q 258 132 302 100"/>
    <path d="M216 298 Q 190 380 152 452"/>
    <path d="M216 298 Q 244 380 290 452"/>
  `,
  note(362, 168)
);

// STAND-UP / KOMEDYEN — ayakta figür, kaldırılmış elde dik mikrofon (kafadan ayrık)
const standup = wrap(
  `
    <circle cx="168" cy="108" r="44"/>
    <path d="M168 152 L 168 320"/>
    <path d="M168 196 Q 128 212 122 268"/>
    <path d="M168 192 Q 220 198 244 158"/>
    <path d="M244 158 L 231 122"/>
    <path d="M168 320 Q 160 408 146 498"/>
    <path d="M168 320 Q 176 408 192 498"/>
  ` +
    `<rect x="210" y="84" width="30" height="52" rx="15" transform="rotate(18 225 110)" fill="${C}" stroke="none"/>`
);

// TERCÜMAN — figür + iki konuşma balonu (iki dilli diyalog)
const tercuman = wrap(
  `
    <circle cx="168" cy="238" r="46"/>
    <path d="M168 284 L 168 424"/>
    <path d="M168 316 Q 124 330 120 380"/>
    <path d="M168 316 Q 214 322 236 288"/>
    <path d="M168 424 L 150 528"/>
    <path d="M168 424 L 186 528"/>
    <path d="M232 96 h 120 a 26 26 0 0 1 26 26 v 52 a 26 26 0 0 1 -26 26 h -70 l -30 30 v -30 h -20 a 26 26 0 0 1 -26 -26 v -52 a 26 26 0 0 1 26 -26 z"/>
  ` +
    `<g fill="${C}" stroke="none">
       <circle cx="270" cy="148" r="9"/>
       <circle cx="306" cy="148" r="9"/>
       <circle cx="342" cy="148" r="9"/>
     </g>`
);

const ICONS = {
  'dansci.png': dansci,
  'stand-up-komedyen.png': standup,
  'tercuman.png': tercuman,
};

async function main() {
  for (const [name, svg] of Object.entries(ICONS)) {
    await sharp(Buffer.from(svg)).png().toFile(join(OUT, name));
    console.log('yazıldı: public/icons/' + name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
