'use client';

import { IletisimButton } from './iletisim-button';
import { RezervasyonButton } from './rezervasyon-button';
import { useProfilIslem } from './profil-islem-baglami';
import { type OnBehalfBusiness } from '@/app/components/on-behalf-selector';

/**
 * MOBIL ALT CTA CUBUGU (D2-ek) — `lg` altinda sayfanin dibine sabit.
 *
 * ISTEMCI BILESENI OLMASININ TEK SEBEBI: karttaki Tarih/Sehir/Kisi degerlerini
 * BAGLAMDAN okuyup dugmelere on-doldurma olarak vermek. Mobilde kart CTA
 * tasimiyor; kullanici kartta tarih seciyor, sonra buradaki dugmeye basiyor.
 *
 * Dugmeler, etiketleri ve action'lari AYNEN eski cubuktaki gibi
 * ("Teklif Al" / "Rezervasyon Talebi" — site genelinde ayni).
 */
export function MobilCtaCubugu({
  professionalId,
  professionalName,
  categorySlug,
  isLoggedIn,
  currentUserIsProfessional,
  isOwnProfile,
  writableBusinesses,
}: {
  professionalId: string;
  professionalName: string;
  categorySlug: string | null;
  isLoggedIn: boolean;
  currentUserIsProfessional: boolean;
  isOwnProfile: boolean;
  writableBusinesses: OnBehalfBusiness[];
}) {
  const { tarih, sehir, kisi } = useProfilIslem();

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-line px-4 py-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <IletisimButton
            professionalId={professionalId}
            professionalName={professionalName}
            categorySlug={categorySlug}
            isLoggedIn={isLoggedIn}
            currentUserIsProfessional={currentUserIsProfessional}
            isOwnProfile={isOwnProfile}
            writableBusinesses={writableBusinesses}
            variant="primary-accent"
            onDolgu={{ tarih, sehir, kisi }}
          />
        </div>
        <div className="flex-1">
          <RezervasyonButton
            professionalId={professionalId}
            professionalName={professionalName}
            isLoggedIn={isLoggedIn}
            currentUserIsProfessional={currentUserIsProfessional}
            isOwnProfile={isOwnProfile}
            writableBusinesses={writableBusinesses}
            variant="outline-ink"
            initialDate={tarih}
            initialLocation={sehir}
          />
        </div>
      </div>
    </div>
  );
}
