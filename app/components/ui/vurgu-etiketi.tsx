import type { ReactNode } from 'react';

/**
 * VURGU ETIKETI — pembe cizgili kucuk ust baslik.
 *
 * Etkinlik sayfasindaki "Kashe AI · Eslesme sonucu" basliginin ortak hali
 * (Duzeltme 15: ekip kurma ekraninin gorsel dili diger sayfalara tasiniyor).
 * Bolum basliklarinin ve kart ici etiketlerin onunde durur; sayfada birden cok
 * kez kullanilabilir. Baslik seviyesi tasimaz (`p`): asil baslik ayri yazilir.
 */
export function VurguEtiketi({
  children,
  koyuZemin = false,
}: {
  children: ReactNode;
  /** Koyu zeminde (serit, koyu kart) acik metin. */
  koyuZemin?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-0.5 w-6 rounded-full bg-brand-accent shrink-0"
        aria-hidden="true"
      />
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
          koyuZemin ? 'text-paper-72' : 'text-ink-72'
        }`}
      >
        {children}
      </p>
    </div>
  );
}
