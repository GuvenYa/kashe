import type { ReactNode } from 'react';
import { PanelYanMenu, type PanelHesap } from './panel-yan-menu';
import { PanelBaslik } from './panel-baslik';
import type { PanelMenuGrubu } from '@/app/lib/panel-menu-tipler';

/**
 * PANEL KABUGU — calisma yuzeylerinin tek kabugu.
 *
 * Kaynak: `app/admin/admin-nav.tsx` + `app/admin/layout.tsx` yerlesimi
 * genellestirildi (lacivert sol sutun 240 px, icerik `lg:ml-60`, `max-w-7xl`).
 *
 * KIRILMA NOKTASI `lg` (1024 px): sol sutun `md`'de (768) acilsaydi icerik
 * alani 768-1023 px arasinda 528-783 px kalir, sayfalarin `md:` yerlesimleri
 * (tablo sutunlari, baslik satiri) sutunun arkasinda sikisirdi. `lg`'de sutun
 * acildiginda icerik en az 784 px'tir; `md:` yerlesimleri rahat sigar.
 * `/ajans`, `/kurumsal`, `/profil` ve `/admin` ayni bilesene bakar.
 *
 * UST NAV YOKTUR: bu kabugu kullanan sayfa `TopNav` render ETMEZ (admin'de de
 * yoktu) — gezinti yan menudedir, iki menu birden gosterilmez.
 *
 * Sunucu bileseni: yalniz yan menu istemci (aktif madde + cekmece + cikis).
 */
export function PanelKabugu({
  menu,
  hesap,
  yonetici = false,
  ustBaslik,
  children,
}: {
  menu: PanelMenuGrubu[];
  hesap: PanelHesap;
  /** Platform yoneticisi — yan menunun dibinde "Admin paneli" cikar. */
  yonetici?: boolean;
  ustBaslik?: {
    eyebrow: string;
    baslik: ReactNode;
    sagAlan?: ReactNode;
  };
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <PanelYanMenu menu={menu} hesap={hesap} yonetici={yonetici} />
      <main className="lg:ml-60 px-6 md:px-12 py-8 md:py-10">
        <div className="max-w-7xl mx-auto">
          {ustBaslik && (
            <PanelBaslik
              eyebrow={ustBaslik.eyebrow}
              sagAlan={ustBaslik.sagAlan}
            >
              {ustBaslik.baslik}
            </PanelBaslik>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
