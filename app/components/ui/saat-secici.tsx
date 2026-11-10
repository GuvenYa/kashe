'use client';

/**
 * SAAT SECICI (Duzeltme 14-A) - 24 saatlik saat + dakika kutulari.
 *
 * `<input type="time">` tarayicinin diline uyuyor: Ingilizce tarayicida
 * "--:-- --" ve AM / PM gorunuyordu. Rezervasyon talebi formu bunu saat ve
 * dakika secimleriyle cozmustu; ayni kural teklif formunda da kullanilsin diye
 * buraya tasindi.
 *
 * DEGER "HH:MM" ya da '' (secim yok). Dakika 00 / 15 / 30 / 45; mevcut deger
 * baska bir dakikaysa (eski kayit, musterinin yazdigi saat) o da listede kalir.
 * Saat "--" secilirse deger temizlenir; yalniz biri secilirse digeri 00 olur.
 */

const SAATLER = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const DAKIKALAR = ['00', '15', '30', '45'];

const KUTU =
  'flex-1 min-w-0 px-3 py-3 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';

function parcala(t: string): { h: string; m: string } {
  if (!t) return { h: '', m: '' };
  const [h, m] = t.split(':');
  return { h: (h ?? '').slice(0, 2), m: (m ?? '').slice(0, 2) };
}

export function SaatSecici({
  deger,
  onDegis,
  etiket,
  id,
  kutuSinifi,
}: {
  deger: string;
  onDegis: (saat: string) => void;
  /** Ekran okuyucu icin ad: "Başlangıç" -> "Başlangıç saati" / "Başlangıç dakikası". */
  etiket: string;
  /** Saat kutusunun id'si (etiketin `htmlFor`u). */
  id?: string;
  /** Kutu sinifi (dar formlar icin); verilmezse varsayilan. */
  kutuSinifi?: string;
}) {
  const { h, m } = parcala(deger);
  const dakikalar = m && !DAKIKALAR.includes(m) ? [...DAKIKALAR, m].sort() : DAKIKALAR;

  function yaz(parca: 'h' | 'm', v: string) {
    const yeniH = parca === 'h' ? v : h;
    const yeniM = parca === 'm' ? v : m;
    if (parca === 'h' && !v) {
      onDegis('');
      return;
    }
    if (!yeniH && !yeniM) {
      onDegis('');
      return;
    }
    onDegis(`${yeniH || '00'}:${yeniM || '00'}`);
  }

  const sinif = kutuSinifi ?? KUTU;
  return (
    <div className="flex items-center gap-1.5">
      <select
        id={id}
        value={h}
        onChange={(e) => yaz('h', e.target.value)}
        className={sinif}
        aria-label={`${etiket} saati`}
      >
        <option value="">--</option>
        {SAATLER.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <span className="text-ink-72 font-medium" aria-hidden="true">
        :
      </span>
      <select
        value={m}
        onChange={(e) => yaz('m', e.target.value)}
        className={sinif}
        aria-label={`${etiket} dakikası`}
      >
        <option value="">--</option>
        {dakikalar.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}
