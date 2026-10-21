import {
  saticiRol,
  ZIYARETCI_GIRISSIZ,
  type Ziyaretci,
} from "@/app/lib/ziyaretci";
import {
  KoyuBolum,
  KOYU_BTN_BIRINCIL,
  KOYU_BTN_IKINCIL,
} from "@/app/components/koyu-bolum";

/**
 * KAPANIS CTA.
 *
 * GIRISSIZ metin AYNEN korunur (brief v3 "Degismeyecekler" — CTA metni).
 * Girisli kullanici farkli bir metin gorur: "uye ol / hesap ac" cagrisi onun
 * icin yanlis; onun yerine sahip oldugu yuzeylere baglanir.
 *
 * D4 — KABUK `KoyuBolum`'a gecti; metinler, CTA hedefleri ve dallanma AYNI.
 * Eski kart tum zemini `--gradient-brand` ile boyuyordu ve T7 bulgusu oradan
 * cikmisti: gradyanin hicbir noktasinda beyaz govde metni 4,5:1 gecmiyordu.
 * Duz lacivert zeminde govde `paper-72` ile rahatca gecer; ikincil dugmenin
 * "gradyan uzerinde okunmuyor" diye `bg-brand-ink` zemine alinmasina da gerek
 * kalmadi (zemin artik zaten lacivert) — kenarlikli ikincil dugme kullanilir.
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
    <KoyuBolum
      yogunluk="kart"
      eyebrow="Hemen başla"
      baslik={
        girisli ? (
          <>Sıradaki etkinliğin için hazır mısın?</>
        ) : (
          <>
            {/* span, em DEGIL: `em` globalde `brand-ink` renk aliyor ve koyu
                zeminde gorunmuyor. Sinifla ezmek yerine notr etiket. */}
            Profilini <span className="text-brand-accent">aç</span>, çalışmaya
            başla.
          </>
        )
      }
      altMetin={
        girisli
          ? "Profilini güncel tut, ilanlara göz at, teklif topla — hepsi tek yerde."
          : "Ücretsiz hesap aç, profilini oluştur, hizmet ver ya da ihtiyacın olan profesyoneli bul. Lansman döneminde komisyonsuz; sonrasında yalnız tamamlanan işten."
      }
    >
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <a href={birincil.href} className={KOYU_BTN_BIRINCIL}>
          {birincil.label}
        </a>
        <a href={ikincil.href} className={KOYU_BTN_IKINCIL}>
          {ikincil.label}
        </a>
      </div>

      {/* Güven satırı — yalnız girişsiz ziyaretçiye (kayıt çağrısının yanı) */}
      {!girisli && (
        <p className="mt-10 font-body text-[11px] uppercase tracking-[0.18em] text-paper-50">
          Ücretsiz kayıt · KVKK uyumlu · İstediğin zaman çıkış
        </p>
      )}
    </KoyuBolum>
  );
}
