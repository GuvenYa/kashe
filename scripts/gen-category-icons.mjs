// ============================================================================
// KATEGORI IKONLARI — terracotta line-art ailesi (public/icons/*.png)
// ============================================================================
// RENK KARARI (9 Ekim 2026, ana sayfa yenileme brief v3 bolum 4): mevcut aile
// KORUNUR. C = '#BB3619' guncel palette yok; ne eski zumrut/mercan setinde ne de
// lacivert/pembe/cyan setinde. Ama 16 ikonun tamami bu tonda — yani ikonlar
// "bozuk" degil, TUTARLI ama palet disi bir alt-sistem. Eksik 4 ikon da ayni
// dilde uretilir; yalniz yenilerini yeni renkte basmak 16+4 ikonu birbirine
// yabancilastirirdi. Tum ailenin yeni palete tasinmasi ayri bir is olarak acik
// kalir (DESIGN.md → Cok renkli kategori sistemi).
//
// Dil: terracotta #BB3619, kalin yuvarlak-uclu strok (22), yuzsuz yuvarlak kafa,
// alt golge, seffaf zemin, 460x600 tuval. Detay ogeleri daha ince strokla.
//
// Calistir:
//   node scripts/gen-category-icons.mjs                    → TUMUNU yeniden basar
//   node scripts/gen-category-icons.mjs konusmaci akrobat  → yalniz adi gecenleri
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

// Detay grubu — ana figürden ince strok (anten, kumanda kolu, pervane, mikrofon kolu).
function ince(inner, w = 14) {
  return `<g stroke="${C}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${inner}
  </g>`;
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

// KONUŞMACI — kürsü arkasında figür: bir el kürsüde, bir kol anlatırken havada,
// kürsünün üstünde kaz-boynu mikrofon. Bacaklar kürsünün arkasında kalır.
// SUNUCU'dan (elde mikrofon) ve STAND-UP'tan (konuşma balonu) ayrışır.
const konusmaci = wrap(
  `
    <circle cx="232" cy="112" r="48"/>
    <path d="M232 160 L 232 344"/>
    <path d="M232 206 Q 186 240 168 342"/>
    <path d="M232 198 Q 298 180 330 124"/>
    <path d="M130 352 L 316 352 L 292 524 L 154 524 Z"/>
  ` +
    ince(`<path d="M284 348 L 300 266"/>`, 14) +
    `<ellipse cx="303" cy="252" rx="19" ry="16" transform="rotate(12 303 252)" fill="${C}" stroke="none"/>`
);

// INFLUENCER — kaldırılmış elde telefon (çekim), yanında kalp.
// MODEL'den (poz veren figür) telefon + kalp ile ayrışır.
const influencer = wrap(
  `
    <circle cx="186" cy="116" r="48"/>
    <path d="M186 164 L 186 330"/>
    <path d="M186 204 Q 144 236 138 300"/>
    <path d="M186 200 Q 242 208 272 178"/>
    <path d="M186 330 L 164 512"/>
    <path d="M186 330 L 208 512"/>
    <rect x="262" y="98" width="56" height="92" rx="14" transform="rotate(20 290 144)"/>
  ` +
    `<path d="M392 132 C 378 118 356 111 356 90 C 356 76 368 67 379 72 C 384 75 389 80 392 85 C 395 80 400 75 405 72 C 416 67 428 76 428 90 C 428 111 406 118 392 132 Z" fill="${C}" stroke="none"/>`
);

// DRONE PİLOTU — iki elde kumanda, havada quadcopter.
// VİDEOGRAF'tan (omuzda kamera) kumanda + drone ile ayrışır.
const dronePilotu = wrap(
  `
    <circle cx="168" cy="180" r="46"/>
    <path d="M168 226 L 168 320"/>
    <path d="M168 252 Q 122 286 122 324"/>
    <path d="M168 252 Q 214 286 214 324"/>
    <path d="M168 376 L 168 406"/>
    <path d="M168 406 L 148 528"/>
    <path d="M168 406 L 188 528"/>
    <rect x="114" y="320" width="108" height="52" rx="16"/>
  ` +
    ince(
      `<path d="M132 320 L 122 288"/>
       <path d="M204 320 L 214 288"/>
       <path d="M274 136 L 402 136"/>
       <path d="M288 100 L 288 136"/>
       <path d="M388 100 L 388 136"/>
       <ellipse cx="288" cy="92" rx="34" ry="11"/>
       <ellipse cx="388" cy="92" rx="34" ry="11"/>
       <rect x="314" y="136" width="48" height="36" rx="10"/>`,
      15
    ) +
    `<g fill="${C}" stroke="none">
       <circle cx="144" cy="348" r="9"/>
       <circle cx="192" cy="348" r="9"/>
     </g>`
);

// AKROBAT — amuda kalkmış figür, bacaklar açık (split). Eller yerde, kafa
// omuzların altında asılı. DANSÇI'dan (ayakta, kollar yukarı) ters duruşla ayrışır.
const akrobat = wrap(
  `
    <path d="M208 392 L 222 244"/>
    <path d="M208 392 L 104 524"/>
    <path d="M208 392 L 296 516"/>
    <path d="M208 392 L 206 428"/>
    <circle cx="204" cy="466" r="36"/>
    <path d="M222 244 L 196 100"/>
    <path d="M222 244 L 318 206"/>
    <path d="M318 206 L 352 112"/>
  `
);

// SAC, MAKYAJ VE STYLING — ayakta stilist, kaldirilmis elde makas.
const sacMakyaj = wrap(
  `
    <circle cx="168" cy="196" r="46"/>
    <path d="M168 242 L 168 400"/>
    <path d="M168 276 Q 128 304 124 356"/>
    <path d="M168 272 Q 222 268 250 230"/>
    <path d="M168 400 L 150 522"/>
    <path d="M168 400 L 186 522"/>
  ` +
    ince(
      `<path d="M300 170 L 266 90"/>
       <path d="M300 170 L 338 92"/>
       <path d="M300 170 L 276 214"/>
       <path d="M300 170 L 324 214"/>
       <circle cx="268" cy="230" r="17"/>
       <circle cx="332" cy="230" r="17"/>`,
      15
    )
);

// ETKINLIK KOORDINATORU — kulaklikli figur + elinde pano.
const koordinator = wrap(
  `
    <circle cx="172" cy="182" r="46"/>
    <path d="M172 228 L 172 404"/>
    <path d="M172 264 Q 134 292 130 344"/>
    <path d="M172 260 Q 208 264 230 284"/>
    <path d="M172 404 L 154 524"/>
    <path d="M172 404 L 190 524"/>
    <rect x="230" y="256" width="110" height="146" rx="14"/>
  ` +
    ince(
      `<path d="M112 178 Q 172 84 232 178"/>
       <path d="M232 180 Q 230 226 202 230"/>
       <rect x="264" y="242" width="42" height="24" rx="9"/>
       <path d="M252 306 L 318 306"/>
       <path d="M252 338 L 318 338"/>
       <path d="M252 370 L 296 370"/>`,
      15
    )
);

// CANLI YAYIN — tripod uzerinde kamera + yayin dalgalari, onunde anlatan figur.
const canliYayin = wrap(
  `
    <circle cx="140" cy="212" r="44"/>
    <path d="M140 256 L 140 402"/>
    <path d="M140 288 Q 106 314 102 362"/>
    <path d="M140 284 Q 182 292 204 266"/>
    <path d="M140 402 L 124 522"/>
    <path d="M140 402 L 156 522"/>
    <rect x="262" y="190" width="104" height="72" rx="14"/>
  ` +
    ince(
      `<path d="M262 226 L 242 226"/>
       <circle cx="234" cy="226" r="15"/>
       <path d="M314 262 L 314 300"/>
       <path d="M314 300 L 272 376"/>
       <path d="M314 300 L 356 376"/>
       <path d="M314 300 L 320 372"/>
       <path d="M382 190 Q 406 158 382 126"/>
       <path d="M410 206 Q 442 158 410 110"/>`,
      15
    )
);

const ICONS = {
  'dansci.png': dansci,
  'stand-up-komedyen.png': standup,
  'tercuman.png': tercuman,
  'konusmaci.png': konusmaci,
  'influencer.png': influencer,
  'drone-pilotu.png': dronePilotu,
  'akrobat.png': akrobat,
  'sac-makyaj-styling.png': sacMakyaj,
  'etkinlik-koordinatoru.png': koordinator,
  'canli-yayin.png': canliYayin,
};

async function main() {
  // Argüman verilirse YALNIZ o ikonlar basılır (mevcut dosyalara dokunulmaz).
  const istenen = process.argv.slice(2).map((s) => s.replace(/\.png$/, ''));
  const liste = Object.entries(ICONS).filter(
    ([name]) =>
      istenen.length === 0 || istenen.includes(name.replace(/\.png$/, ''))
  );
  if (liste.length === 0) {
    console.error(
      'eslesen ikon yok. gecerli adlar: ' + Object.keys(ICONS).join(', ')
    );
    process.exit(1);
  }
  for (const [name, svg] of liste) {
    await sharp(Buffer.from(svg)).png().toFile(join(OUT, name));
    console.log('yazıldı: public/icons/' + name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
