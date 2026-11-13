import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { orderCities } from '@/app/lib/city-order';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { TopNav } from '@/app/components/sections/top-nav';
import { getCachedUser } from '@/app/lib/auth';
import { TeklifToplaFormu } from './teklif-topla-formu';
import { VurguEtiketi } from '@/app/components/ui/vurgu-etiketi';
import { etkinlikTuruAnahtarlari } from '@/app/lib/etkinlik-turleri';
import { getWritableBusinesses } from '@/app/lib/business-write';
import { musteriMerkeziAcik, MERKEZ_BEKLEYEN_YOLU } from '@/app/lib/musteri-merkezi';
import { gorunenEtkinlikId } from '@/app/lib/eventspec-server';

export const metadata = {
  title: 'Teklif Topla — Kashe',
};

type OnDolduParams = {
  /** `event_types.key` — brief 'event_type' alanina duser. */
  tur?: string;
  /** turkish_cities.id */
  sehir?: string;
  /** ISO tarih — brief 'event_date' alanına düşer. */
  tarih?: string;
  /** Duzeltme 18-A: ilce / semt metni (sihirbazdan); sehirle birlikte anlamli. */
  ilce?: string;
  /** service_categories.id — YALNIZ tek değer ön-doldurulur (form tekil seçim). */
  kategori?: string;
  /** FAZ 4c/P3: events.id — talep bu etkinlige baglanir (sunucuda dogrulanir). */
  etkinlik?: string;
  /** Etkinlikten gelen butce araligi (TL) */
  butce_min?: string;
  butce_max?: string;
};

export default async function TeklifToplaPage({
  searchParams,
}: {
  searchParams: Promise<OnDolduParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  // FAZ 10b: gecerli tur anahtarlari `event_types` tablosundan.
  const turAnahtarlari = await etkinlikTuruAnahtarlari();

  const user = await getCachedUser();

  if (!user) {
    // Kayıt duvarı: MEVCUT kalıp (?redirect=) korunur, yeni mekanizma icat edilmez.
    // Sihirbazdan gelen ön-doldurma parametreleri redirect'e GÖMÜLÜR ki giriş
    // sonrasında kullanıcının seçimleri kaybolmasın.
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'string' && v) qs.set(k, v);
    }
    const hedef = qs.toString() ? `/teklif-topla?${qs.toString()}` : '/teklif-topla';
    redirect(`/giris?redirect=${encodeURIComponent(hedef)}`);
  }

  // Rol + suspension kontrolü — sadece client/business teklif toplayabilir
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü
  if (profile?.suspended_at) return <SuspendedNotice />;

  const role = profile?.role;
  // manager+ kurum üyesi (profil rolü ne olursa olsun) kurum adına talep açabilir
  const writableBusinesses = await getWritableBusinesses();
  const canSelfCreate = role === 'client' || role === 'business';

  if (!canSelfCreate && writableBusinesses.length === 0) {
    return (
      <>
      <TopNav />
      <div className="bg-paper min-h-screen">
        <div className="max-w-2xl mx-auto px-6 md:px-12 py-20 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink mb-4">
            Erişim yok
          </p>
          <h1 className="font-display text-4xl text-ink mb-3">
            Teklif toplamak için{' '}
            <em className="text-brand-ink not-italic italic font-medium">
              müşteri
            </em>{' '}
            hesabı gerek
          </h1>
          <p className="text-ink-72 mb-8">
            Profesyonel ve ajans hesapları teklif talebi alır, oluşturamaz.
          </p>
          <Link
            href="/kesfet"
            className="inline-block px-6 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
          >
            Profesyonelleri keşfet
          </Link>
        </div>
      </div>
      </>
    );
  }

  const [categoriesResult, citiesResult] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, slug, name_tr')
      .eq('is_active', true)
      .order('name_tr'),
    supabase.from('turkish_cities').select('id, name').order('name'),
  ]);

  return (
    <>
    <TopNav />
    <div className="bg-paper min-h-screen">
      <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
        {/* Duzeltme 15 (gorsel dil): ekip kurma ekranindaki baslik kalibi. */}
        <header className="mb-8">
          <VurguEtiketi>Kashe · Teklif topla</VurguEtiketi>
          <h1 className="font-display font-semibold text-3xl md:text-4xl text-ink tracking-tight leading-tight mt-2 break-words">
            Bir kez anlat,{' '}
            <em className="not-italic text-brand-accent">
              teklifler sana gelsin
            </em>
            .
          </h1>
          <p className="mt-3 text-ink-72 text-base max-w-2xl">
            İhtiyacını bir kez yaz; Kashe uygun profesyonellere özel olarak
            iletsin. Talebin ilan tahtasında görünmez, yalnız seçilen
            profesyoneller görür ve sana teklif verir.
          </p>
        </header>

        <TeklifToplaFormu
          categories={categoriesResult.data || []}
          cities={orderCities(citiesResult.data || [])}
          writableBusinesses={writableBusinesses}
          canSelfCreate={canSelfCreate}
          donusYolu={
            (await musteriMerkeziAcik()) ? MERKEZ_BEKLEYEN_YOLU : '/teklif-taleplerim'
          }
          onDoldur={{
            kategoriId: params.kategori ? Number(params.kategori) : null,
            sehirId: params.sehir ? Number(params.sehir) : null,
            // FAZ 10b: on-doldurma yalniz TABLODAKI anahtarla yapilir; liste
            // disi `?tur=` yok sayilir (form bos baslar, hata yok).
            etkinlikTuru:
              params.tur && turAnahtarlari.has(params.tur)
                ? params.tur
                : null,
            etkinlikTarihi: params.tarih ?? null,
            ilce: typeof params.ilce === 'string' ? params.ilce : null,
            // FAZ 4c/P3: id istemciden geliyor ama YAZILMADAN once sunucuda
            // dogrulanir (gorunenEtkinlikId); burada yalniz forma tasinir.
            etkinlikId: await gorunenEtkinlikId(supabase, params.etkinlik),
            butceMin: params.butce_min ? Number(params.butce_min) : null,
            butceMax: params.butce_max ? Number(params.butce_max) : null,
          }}
        />
      </div>
    </div>
    </>
  );
}