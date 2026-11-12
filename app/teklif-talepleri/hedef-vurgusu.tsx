'use client';

import { useEffect } from 'react';

/**
 * HEDEF VURGUSU (Duzeltme 15-B) - "Islerim" merkezinden gelen `#talep-<id>`
 * capasindaki karti isaretler ve ekranin ortasina getirir.
 *
 * CSS `:target` burada calismiyor: uygulama ici gecis adresi `pushState` ile
 * degistirir, tarayici `:target`i yalniz gercek gezinmede gunceller (15-B
 * onizleme turunda kart isaretlenmedi). Liste sonundaki kart sayfanin ustune
 * de kaydirilamadigi icin hangi talebin kastedildigi belli olmuyordu.
 *
 * Kart `data-hedef-vurgu` alir; gorunum sayfadaki `data-[hedef-vurgu]:`
 * siniflarindan gelir. Durum tasimaz, bir sey cizmez.
 */
export function HedefVurgusu({ onEk }: { onEk: string }) {
  useEffect(() => {
    const uygula = () => {
      document
        .querySelectorAll('[data-hedef-vurgu]')
        .forEach((el) => el.removeAttribute('data-hedef-vurgu'));
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith(onEk)) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute('data-hedef-vurgu', '');
      el.scrollIntoView({ block: 'center' });
    };
    uygula();
    window.addEventListener('hashchange', uygula);
    return () => window.removeEventListener('hashchange', uygula);
  }, [onEk]);
  return null;
}
