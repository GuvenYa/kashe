import { aktiviteGetir, aktiviteAdlari } from '@/app/lib/gorev-data';
import { aktiviteMetni } from '@/app/lib/gorevler';
import { goreliZaman, zamanMetni } from '@/app/lib/tarih';
import { AktiviteDahaFazla } from './aktivite-daha-fazla';

/**
 * FAZ 8a — aktivite akisi (SUNUCU bileseni).
 *
 * `activity_logs` satirlarini okur ve Turkce cumleye cevirir. INSERT yalniz
 * tetikleyicide; bu yuzey SALT OKUNUR — "aktivite ekle" diye bir yol yoktur.
 *
 * Cumledeki kisi/gorev adlari diff'teki kimliklerden cozulur (`aktiviteAdlari`);
 * ad bulunamazsa cumle kimlik yazmaz, daha genel bir ifade kurar.
 */
const ILK_GOSTERILEN = 12;

export async function AktiviteAkisi({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId?: string;
}) {
  const { satirlar } = await aktiviteGetir({ orgId, eventId, limit: 50 });
  if (satirlar.length === 0) {
    return (
      <p className="text-sm text-ink-72">
        Henüz aktivite yok. Görev oluşturma, atama ve durum değişiklikleri burada
        görünür.
      </p>
    );
  }

  const adlar = await aktiviteAdlari(satirlar);

  const satirCiz = (s: (typeof satirlar)[number]) => (
    <li key={s.id} className="flex items-start gap-3 py-2.5">
      {s.aktorAvatar ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={s.aktorAvatar}
          alt=""
          className="w-7 h-7 rounded-full object-cover border border-line shrink-0 mt-0.5"
        />
      ) : (
        <span
          className="w-7 h-7 rounded-full bg-brand-ink-08 border border-line shrink-0 mt-0.5 flex items-center justify-center font-display text-[11px] text-brand-ink"
          aria-hidden
        >
          {s.aktorAdi.charAt(0).toLocaleUpperCase('tr')}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          {aktiviteMetni(s, s.aktorAdi, adlar)}
        </p>
        <p
          className="text-[11px] text-ink-50"
          title={zamanMetni(s.created_at) ?? undefined}
        >
          {goreliZaman(s.created_at)}
        </p>
      </div>
    </li>
  );

  const ilk = satirlar.slice(0, ILK_GOSTERILEN);
  const kalan = satirlar.slice(ILK_GOSTERILEN);

  return (
    <AktiviteDahaFazla
      kalanSayisi={kalan.length}
      ilk={<ul className="divide-y divide-line">{ilk.map(satirCiz)}</ul>}
      kalan={<ul className="divide-y divide-line">{kalan.map(satirCiz)}</ul>}
    />
  );
}
