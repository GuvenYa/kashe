import {
  saticiRol,
  ZIYARETCI_GIRISSIZ,
  type Ziyaretci,
} from "@/app/lib/ziyaretci";

/**
 * KAPANIS CTA.
 *
 * GIRISSIZ metin AYNEN korunur (brief v3 "Degismeyecekler" — CTA metni).
 * Girisli kullanici farkli bir metin gorur: "uye ol / hesap ac" cagrisi onun
 * icin yanlis; onun yerine sahip oldugu yuzeylere baglanir.
 */
export function FooterCTA({
  ziyaretci = ZIYARETCI_GIRISSIZ,
}: {
  ziyaretci?: Ziyaretci;
}) {
  const girisli = ziyaretci.girisli;
  const satici = saticiRol(ziyaretci);

  const birincil = !girisli
    ? { href: "/uye-ol?rol=profesyonel", label: "Hizmet ver →" }
    : satici
      ? { href: "/profil", label: "Profilim →" }
      : { href: "/kesfet", label: "Profesyonel bul →" };

  const ikincil = !girisli
    ? { href: "/uye-ol?rol=musteri", label: "Hizmet ara" }
    : satici
      ? { href: "/ilanlar", label: "İlanlara bak" }
      : { href: "/teklif-topla", label: "Teklif topla" };

  return (
    /* Dış bölüm: bg-paper, içinde rounded-3xl brand-ink gradyan kart */
    <section className="bg-paper py-14 md:py-20">
      <div className="max-w-7xl mx-auto px-6 md:px-9">
        <div
          className="rounded-3xl text-center px-8 md:px-16 lg:px-24 py-16 md:py-20"
          style={{ background: "var(--gradient-brand)" }}
        >
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 mb-8">
            <span className="inline-block h-px w-6 shrink-0 bg-white/30" />
            <span className="font-body font-semibold text-[11px] uppercase tracking-[0.2em] text-white/60">
              Hemen başla
            </span>
            <span className="inline-block h-px w-6 shrink-0 bg-white/30" />
          </div>

          {/* Başlık — <span className="text-brand-accent"> kullan, em (brand-ink) koyu zeminde görünmez */}
          <h2 className="font-display font-semibold text-4xl md:text-6xl lg:text-7xl leading-[0.95] tracking-[-0.04em] text-white mb-6 max-w-3xl mx-auto">
            {girisli ? (
              <>Sıradaki etkinliğin için hazır mısın?</>
            ) : (
              <>
                Profilini <span className="text-brand-accent">aç</span>,
                çalışmaya başla.
              </>
            )}
          </h2>

          {/* Alt metin */}
          <p className="font-body text-lg md:text-xl text-white/65 leading-[1.55] mb-10 max-w-xl mx-auto">
            {girisli
              ? "Profilini güncel tut, ilanlara göz at, teklif topla — hepsi tek yerde."
              : "Ücretsiz hesap aç, profilini oluştur, hizmet ver ya da ihtiyacın olan profesyoneli bul. Lansman döneminde komisyonsuz; sonrasında yalnız tamamlanan işten."}
          </p>

          {/* CTA butonları */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={birincil.href}
              className="inline-flex items-center gap-2 bg-white text-ink font-display font-semibold rounded-lg px-8 py-3.5 text-base hover:bg-paper transition-colors"
            >
              {birincil.label}
            </a>
            {/* T7: beyaz/75 metin gradyan (cyan→pembe) uzerinde 4.5:1 altinda
                kaliyordu — gradyanin HICBIR noktasinda duz beyaz yazi 4:1 gecmiyor.
                Dugme brand-ink zemine alindi: beyaz/brand-ink = 19.3:1. */}
            <a
              href={ikincil.href}
              className="inline-flex items-center gap-2 bg-brand-ink border border-white/30 text-white font-display font-semibold rounded-lg px-8 py-3.5 text-base hover:bg-brand-ink-deep transition-colors"
            >
              {ikincil.label}
            </a>
          </div>

          {/* Güven satırı — yalnız girişsiz ziyaretçiye (kayıt çağrısının yanı) */}
          {!girisli && (
            <p className="mt-10 font-body text-[11px] uppercase tracking-[0.18em] text-white/35">
              Ücretsiz kayıt · KVKK uyumlu · İstediğin zaman çıkış
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
