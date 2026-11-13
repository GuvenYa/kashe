import { createClient } from '@/app/lib/supabase-server';
import { gosterilecekAd } from '@/app/lib/kamu-adi';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { KonusmaDetay } from './konusma-detay';
import { KarsiTarafPaneli } from './karsi-taraf-paneli';
import type { Message } from '@/app/lib/types';
import type { Quote } from '../quotes-data';
import { getTeamContext } from '@/app/lib/business-write';
import { kurulusumunId, OWNER_SEED } from '@/app/lib/uyelik';
import { briefSatirlari } from '@/app/lib/brief-ozet';
import { DurumKarti } from '@/app/components/panel/durum-karti';
import { simdiMs } from '@/app/lib/premium';
import { istanbulGunu } from '@/app/lib/tarih';
import { VurguEtiketi } from '@/app/components/ui/vurgu-etiketi';
import {
  sohbetDurumu,
  type SohbetRezervasyonu,
} from '@/app/lib/sohbet-durumu';

type ConversationParticipant = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
  bio: string | null;
  last_seen_at: string | null;
  turkish_cities: { name: string } | null;
  service_categories: { slug: string } | null;
};

type ConversationRow = {
  id: string;
  customer_id: string;
  professional_id: string;
  event_date: string | null;
  event_type: string | null;
  location: string | null;
  guest_count: number | null;
  budget_range: string | null;
  start_time: string | null;
  end_time: string | null;
  /** Duzeltme 12-B: sohbetteki talep sayisi. */
  request_count: number | null;
  /** A2: kategoriye ozel brief cevaplari (jsonb; `brief-config.ts` anahtarlari). */
  brief_data: Record<string, unknown> | null;
  customer: ConversationParticipant | null;
  professional: ConversationParticipant | null;
};

/**
 * SEKME BASLIGI (Duzeltme 01 / #26).
 *
 * Birkac konusma sekmesi acikken hepsi ayni "Mesajlar — Kashe" basligini
 * tasiyordu. Baslik karsi tarafin ADIYLA yazilir; e-posta/telefon gibi PII
 * SORGULANMAZ (yalniz ad ve sirket adi okunur). Erisimi olmayan ya da
 * bulunamayan konusmada genel baslik kalir (sayfa zaten 404 verir).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const genel = { title: 'Mesajlar — Kashe' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return genel;

  const { data } = await supabase
    .from('conversations')
    .select(
      `customer_id, professional_id,
       customer:profiles!conversations_customer_id_fkey (full_name, company_name, role),
       professional:profiles!conversations_professional_id_fkey (full_name, company_name, role)`
    )
    .eq('id', id)
    .maybeSingle();

  type KonusmaTarafi = {
    full_name: string | null;
    company_name: string | null;
    role: string | null;
  };
  const konusma = data as unknown as {
    customer_id: string;
    professional_id: string;
    customer: KonusmaTarafi | null;
    professional: KonusmaTarafi | null;
  } | null;
  if (!konusma) return genel;

  // Musteri tarafindaysa karsi taraf profesyonel, degilse musteri. Kurum ekip
  // uyeligi burada cozulmez (ek sorgu olurdu); o durumda da musteri KENDISI
  // olmadigi icin profesyonel adi dogru karsi taraftir.
  const karsi =
    konusma.customer_id === user.id ? konusma.professional : konusma.customer;

  /**
   * Duzeltme 11-F1 (bulgu 85): sekme basligi TAM ADI yaziyordu
   * ("Mesaj — Eda Bozkurt — Kashe") ama sayfa basligi "Eda B." idi.
   * Kamu ad kurali (Duzeltme 05-E) baslikta da gecerli: ayni yardimci ve
   * AYNI kapi — onayli / tamamlanmis rezervasyon varsa tam ad.
   */
  const { data: rezervasyonlar } = await supabase
    .from('bookings')
    .select('id')
    .eq('conversation_id', id)
    .in('status', ['confirmed', 'completed'])
    .limit(1);
  const tamAd = (rezervasyonlar ?? []).length > 0;

  const ad =
    karsi?.company_name?.trim() ||
    gosterilecekAd(karsi?.role ?? null, karsi?.full_name ?? null, tamAd) ||
    null;
  return ad ? { title: `Mesaj — ${ad} — Kashe` } : genel;
}

export default async function KonusmaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/giris?redirect=/mesajlar/${id}`);
  }

  // Suspension kontrolü — askıdaki kullanıcı mesajlaşamaz
  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) redirect('/askiya-alindi');

  // Kurumsal ekip bağlamı — tek sorgu. teamBusinessIds = tüm üyelikler (görünürlük);
  // canWriteSet = owner+manager (kurum adına yazma → pasiflik kalkar).
  const { teamBusinessIds, canWriteSet } = await getTeamContext();

  const { data: convData } = await supabase
    .from('conversations')
    .select(
      `
      id, customer_id, professional_id,
      event_date, event_type, location, guest_count, budget_range, brief_data,
      start_time, end_time, request_count,
      customer:customer_id (
        id, full_name, avatar_url, company_name, role, bio, last_seen_at,
        turkish_cities(name),
        service_categories!profiles_primary_category_id_fkey(slug)
      ),
      professional:professional_id (
        id, full_name, avatar_url, company_name, role, bio, last_seen_at,
        turkish_cities(name),
        service_categories!profiles_primary_category_id_fkey(slug)
      )
      `
    )
    .eq('id', id)
    .single();

  if (!convData) {
    notFound();
  }

  const conv = convData as unknown as ConversationRow;

  // Bu konuşmaya atanmış profesyoneller (junction)
  const { data: assigneeRows } = await supabase
    .from('conversation_assignees')
    .select('professional_id')
    .eq('conversation_id', id);

  const assignedIds = (assigneeRows ?? []).map((r) => r.professional_id);
  const isAssignedPro = assignedIds.includes(user.id);
  const isTeam =
    conv.customer_id !== user.id &&
    teamBusinessIds.includes(conv.customer_id);
  // owner/manager üye → kurum adına yazma yetkisi (pasiflik kalkar)
  const canWrite = isTeam && canWriteSet.has(conv.customer_id);

  // Erişim kontrolü — sahibi ajans, müşteri, atanan profesyonel VEYA kurum ekip üyesi
  if (
    conv.customer_id !== user.id &&
    conv.professional_id !== user.id &&
    !isAssignedPro &&
    !isTeam
  ) {
    notFound();
  }

  const isCustomer = conv.customer_id === user.id;
  // Kurum üyesi müşteri-tarafı sayılır → karşı taraf = profesyonel (kendi kurumu değil)
  const isCustomerSide = isCustomer || isTeam;
  const other = isCustomerSide ? conv.professional : conv.customer;
  const teamBusinessName = isTeam
    ? conv.customer?.company_name || conv.customer?.full_name || 'Kurum'
    : null;

  if (!other) {
    notFound();
  }

  // Mesajları çek
  const { data: messagesData } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  const messages = (messagesData || []) as Message[];

  // Gönderen isim haritası — mesajlarda GERÇEKTEN görünen tüm gönderenleri kapsar
  // (geçmişte atanmış ama sonradan ayrılmış profesyoneller dahil).
  // Değer: { name, agencyTag } — agencyTag, ajans adına yazan pro'larda dolu.
  const senderNames: Record<
    string,
    { name: string; agencyTag: string | null }
  > = {};

  function profileName(p: {
    full_name: string | null;
    company_name: string | null;
    role: string;
  }): string {
    return p.role === 'business' && p.company_name
      ? p.company_name
      : p.full_name || 'İsimsiz';
  }

  // Konuşma sahibi ajans mı? Etiket olarak adını kullanacağız.
  const ownerIsAgency = conv.professional?.role === 'agency';
  const agencyLabel = ownerIsAgency ? profileName(conv.professional!) : null;

  // Önce elimizdeki katılımcıları ekle (ekstra sorgu gerektirmez)
  for (const p of [conv.customer, conv.professional]) {
    if (p) {
      senderNames[p.id] = { name: profileName(p), agencyTag: null };
    }
  }

  // Mesajlardaki benzersiz gönderenlerden haritada olmayanları topla
  const missingSenderIds = Array.from(
    new Set(
      messages
        .filter((m) => m.message_type !== 'system')
        .map((m) => m.sender_id)
    )
  ).filter((sid) => !senderNames[sid]);

  if (missingSenderIds.length > 0) {
    const { data: extraProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, role')
      .in('id', missingSenderIds);

    (extraProfiles ?? []).forEach((p) => {
      senderNames[p.id] = { name: profileName(p), agencyTag: null };
    });
  }

  // Ajans etiketi (Seçenek A): konuşma sahibi ajanssa, müşteri ve ajansın
  // kendisi dışındaki tüm gönderenler ajans adına yazan pro'lardır.
  if (ownerIsAgency && agencyLabel) {
    for (const sid of Object.keys(senderNames)) {
      if (sid !== conv.customer_id && sid !== conv.professional_id) {
        senderNames[sid].agencyTag = agencyLabel;
      }
    }
  }

  // Attribution (kurum-DIŞI görünüm): viewer PRO ise, kurum ekip üyelerinin (müşteri
  // tarafı, katılımcı olmayan gönderenler) adı KURUM adıyla gösterilir — üye adı sızmaz.
  // Kurum-içi görünümde (owner + üyeler) üyenin gerçek adı görünmeye devam eder.
  const viewerIsProfessional = conv.professional_id === user.id || isAssignedPro;
  const customerIsBusiness = conv.customer?.role === 'business';
  if (viewerIsProfessional && customerIsBusiness && !ownerIsAgency && conv.customer) {
    const orgName = profileName(conv.customer);
    for (const sid of Object.keys(senderNames)) {
      if (sid !== conv.customer_id && sid !== conv.professional_id) {
        senderNames[sid] = { name: orgName, agencyTag: null };
      }
    }
  }

  // Quote'ları çek — sadece bu konuşmadaki, message_type='quote' olanlar zaten quote_id taşıyor
  const quoteIds = messages
    .filter((m) => m.message_type === 'quote' && m.quote_id)
    .map((m) => m.quote_id as string);

  const quotesById: Record<string, Quote> = {};
  if (quoteIds.length > 0) {
    const { data: quotesData } = await supabase
      .from('quotes')
      .select('*')
      .in('id', quoteIds);

    (quotesData || []).forEach((q) => {
      quotesById[q.id] = q as Quote;
    });
  }

  // İLETİŞİM GATE (komisyon-kritik) — telefon yalnızca gerçek anlaşmada açılır.
  // Anlaşma = bu konuşmaya bağlı onaylı/tamamlanmış rezervasyon (bookings).
  // Kilitliyken telefon client'a HİÇ gitmez (data katmanı, görsel gizleme değil).
  // Bu konuşmadaki tüm rezervasyonlar (id + quote_id + status):
  //  - contactUnlocked (iletişim gate): confirmed/completed varsa açılır
  //  - bookingIdByQuoteId (köprü): kabul edilmiş teklif kartından /rezervasyon/[id]
  const { data: convBookings } = await supabase
    .from('bookings')
    .select(
      'id, quote_id, status, completed_at, cancelled_at, cancelled_by, customer_id, professional_id, completion_requested_at, created_at, event_date'
    )
    .eq('conversation_id', id);

  const contactUnlocked = (convBookings ?? []).some(
    (b) => b.status === 'confirmed' || b.status === 'completed'
  );
  /**
   * Duzeltme 05-E: tam ad ayni kapiyla acilir. Rezervasyon yoksa bireysel
   * profesyonel "Ad S." gorunur (panel basligi, sohbet basligi, avatar alt
   * metni — hepsi bu tek degerden beslenir).
   */
  const karsiTarafAdi =
    gosterilecekAd(other.role, other.full_name, contactUnlocked) ||
    other.full_name;
  // Telefon/e-posta embed'den değil RPC'den gelir: profiles.email/phone authenticated
  // rolüne kapalı (PII adım 2b). get_contact_info aynı kuralı (onaylı/tamamlanmış
  // rezervasyon) veritabanında da uygular; kilitliyken hiç çağrılmaz.
  let otherContact: { email: string | null; phone: string | null } | null = null;
  if (contactUnlocked) {
    const { data: contactData } = await supabase
      .rpc('get_contact_info', { p_profile_id: other.id })
      .maybeSingle();
    otherContact = (contactData as { email: string | null; phone: string | null } | null) ?? null;
  }
  const bookingIdByQuoteId: Record<string, string> = {};
  for (const b of convBookings ?? []) {
    if (b.quote_id) bookingIdByQuoteId[b.quote_id] = b.id;
  }

  /**
   * A2 — kategoriye ozel brief alanlari. Etiketler `brief-config.ts`ten;
   * seritte zaten olan bes alan ve `message` atlanir. Istemciye HAZIR
   * satirlar gider (sunucu modulu istemciye girmez).
   */
  // Kategori her zaman PROFESYONELIN kategorisidir (brief o kategorinin
  // formuyla dolduruldu); karsi tarafa gore secilirse profesyonel kendi
  // ekraninda ham anahtar gorur (musteri kategorisiz).
  const briefAlanlari = briefSatirlari(
    conv.brief_data,
    conv.professional?.service_categories?.slug ?? null
  );

  /**
   * YORUM CAGRISI (Duzeltme 01 / #28) — yalniz MUSTERI tarafinda.
   *
   * Tespit METIN ESLESTIRMEYLE DEGIL rezervasyon satiriyla yapilir: konusmanin
   * `completed` rezervasyonu varsa, cagri o rezervasyonun `completed_at`
   * zamanindan SONRAKI ilk sistem mesajinin altina cizilir (tamamlama
   * mesajini yazan eylem ayni islemde ekliyor). Musteri kendi rezervasyonunu
   * ve kendi yorumunu RLS ile okur.
   *
   * Duzeltme 12-G (bulgu 117): profesyonelin IPTAL ettigi onayli is de yorum
   * hakki verir (veritabani kurali fn_duz03_tamamlanmis_rezervasyon_var);
   * cagri iptal sistem satirinin altina asilir.
   */
  let yorumCagrisi: { href: string; etiket: string } | null = null;
  // Duzeltme 23-A: durum ozetindeki yorum satiri ayni karardan beslenir.
  let yorumDurumu: 'yok' | 'bekliyor' | 'yayinda' = 'yok';
  let tamamlanmaZamani: string | null = null;
  type YorumluRezervasyon = {
    status: string;
    completed_at: string | null;
    cancelled_at: string | null;
    cancelled_by: string | null;
    customer_id: string | null;
    professional_id: string | null;
  };
  const yorumluRezervasyonlar = (convBookings ?? []) as YorumluRezervasyon[];
  const tamamlanan =
    yorumluRezervasyonlar.find((b) => b.status === 'completed' && b.completed_at) ??
    yorumluRezervasyonlar.find(
      (b) =>
        b.status === 'cancelled' &&
        !!b.cancelled_at &&
        !!b.cancelled_by &&
        b.cancelled_by === (b.professional_id ?? conv.professional_id)
    );
  if (isCustomerSide && tamamlanan) {
    const saglayiciId = tamamlanan.professional_id ?? conv.professional_id;
    const musteriId = tamamlanan.customer_id;
    // Kurum adina bakan uye yalniz yazma yetkisi varsa yorum birakabilir.
    const yorumYazabilir = isCustomer || canWrite;
    if (saglayiciId && musteriId && yorumYazabilir) {
      const { data: yorumSatirlari } = await supabase
        .from('reviews')
        .select('id')
        .eq('provider_id', saglayiciId)
        .eq('customer_id', musteriId)
        .limit(1);
      const yorumVar = (yorumSatirlari ?? []).length > 0;
      yorumDurumu = yorumVar ? 'yayinda' : 'bekliyor';
      tamamlanmaZamani =
        tamamlanan.status === 'completed'
          ? tamamlanan.completed_at
          : tamamlanan.cancelled_at;
      yorumCagrisi = yorumVar
        ? { href: `/p/${saglayiciId}#yorumlar`, etiket: 'Yorumun yayında →' }
        : {
            href: `/p/${saglayiciId}?yorum=1`,
            etiket:
              tamamlanan.status === 'completed'
                ? 'Yorum bırak →'
                : 'Deneyimini yorumla →',
          };
    }
  }

  /**
   * ISIN DURUMU (Duzeltme 23-A; gorsel dil, bulgu 151). Sohbetin guncel isi
   * dort adimda: talep, teklif, rezervasyon, tamamlanma. YENI SORGU YOK:
   * teklifler ve rezervasyonlar yukarida zaten okundu (rezervasyon sorgusuna
   * iki kolon eklendi). Kural is merkezleriyle ayni (`app/lib/sohbet-durumu.ts`).
   */
  const durum = sohbetDurumu({
    sohbetId: conv.id,
    talepSayisi: conv.request_count,
    teklifler: Object.values(quotesById),
    rezervasyonlar: (convBookings ?? []) as unknown as SohbetRezervasyonu[],
    musteriTarafi: isCustomerSide,
    yorum: yorumDurumu,
    simdi: simdiMs(),
    bugun: istanbulGunu(),
  });

  // Profesyonel mi tespit et (teklif gönderme yetkisi — owner kalıyor)
  const isProfessional = conv.professional_id === user.id;

  // Duzeltme 18-B: teklif formundaki "Yer" il + ilce + mekan secicisi; il
  // listesi yalniz teklif verebilen tarafa yuklenir.
  const { data: illerData } =
    isProfessional || isAssignedPro
      ? await supabase.from('turkish_cities').select('id, name').order('name')
      : { data: null };
  const iller = (illerData ?? []) as { id: number; name: string }[];

  // Sahibi ajans mı? (atama dropdown'ı sadece ona görünür)
  const isOwnerAgency =
    conv.professional_id === user.id && conv.professional?.role === 'agency';

  // Owner ajansın ekip üyeleri (atama dropdown'ı için).
  // FAZ 10a: uyelik `organization_memberships`'ten okunur. Kurulusun kendi
  // hesabi (`owner_seed`) listede YOK; atama yalniz PROFESYONEL uyeye yapilir
  // (`assignConversation` ayni kumeyi dogrular).
  let teamMembers: { id: string; full_name: string | null }[] = [];
  if (isOwnerAgency) {
    const orgId = await kurulusumunId(supabase, user.id);
    if (orgId) {
      const { data: membersData } = await supabase
        .from('organization_memberships')
        .select(
          `legacy_source,
           uye:profiles!organization_memberships_user_id_fkey (id, full_name, role)`
        )
        .eq('organization_id', orgId)
        .eq('status', 'active');

      teamMembers = ((membersData ?? []) as unknown as {
        legacy_source: string | null;
        uye: { id: string; full_name: string | null; role: string } | null;
      }[])
        .filter((m) => m.legacy_source !== OWNER_SEED)
        .map((m) => m.uye)
        .filter(
          (u): u is { id: string; full_name: string | null; role: string } =>
            !!u && u.role === 'professional'
        )
        .map((u) => ({ id: u.id, full_name: u.full_name }));
    }
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-4 md:px-12 py-4 md:py-8">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/mesajlar"
            className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-brand-ink transition-colors inline-flex items-center gap-1.5 mb-3 md:mb-4"
          >
            ← Tüm mesajlar
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
            <div className="min-w-0">
              <KonusmaDetay
                conversationId={conv.id}
                currentUserId={user.id}
                isProfessional={isProfessional}
                isAssignedPro={isAssignedPro}
                isOwnerAgency={isOwnerAgency}
                isTeam={isTeam}
                canWrite={canWrite}
                teamBusinessName={teamBusinessName}
                assignedIds={assignedIds}
                teamMembers={teamMembers}
                senderNames={senderNames}
                other={{
                  id: other.id,
                  full_name: karsiTarafAdi,
                  avatar_url: other.avatar_url,
                  company_name: other.company_name,
                  role: other.role,
                }}
                categorySlug={other.service_categories?.slug ?? null}
                viewerRole={isCustomerSide ? 'customer' : 'professional'}
                eventDate={conv.event_date}
                eventType={conv.event_type}
                location={conv.location}
                guestCount={conv.guest_count}
                budgetRange={conv.budget_range}
                briefAlanlari={briefAlanlari}
                initialMessages={messages}
                initialQuotes={quotesById}
                bookingIdByQuoteId={bookingIdByQuoteId}
                yorumCagrisi={yorumCagrisi}
                tamamlanmaZamani={tamamlanmaZamani}
                teklifVarsayilanlari={{
                  eventDate: conv.event_date,
                  startTime: conv.start_time,
                  endTime: conv.end_time,
                  location: conv.location,
                }}
                talepSayisi={conv.request_count ?? 1}
                iller={iller}
                durumOzeti={{
                  baslik: durum.baslik,
                  tamam: durum.tamam,
                  vurgu: durum.vurgu,
                  rezervasyonId: durum.rezervasyonId,
                }}
              />
            </div>

            {/* Sag sutun (dar ekranda sohbetin altinda): once isin durumu,
                sonra konusulan kisi. Dar ekranda durum basligi ayrica sohbetin
                ustundeki ince seritte (KonusmaDetay). */}
            <div className="space-y-4 md:sticky md:top-24 md:self-start min-w-0">
              <section aria-label="İşin durumu">
                <VurguEtiketi>
                  {durum.talepNo > 1
                    ? `İşin durumu · talep #${durum.talepNo}`
                    : 'İşin durumu'}
                </VurguEtiketi>
                <div className="mt-2.5">
                  <DurumKarti
                    baslik={durum.baslik}
                    tamam={durum.tamam}
                    ilerleme={durum.ilerleme}
                    satirlar={durum.satirlar}
                    altAlan={
                      durum.rezervasyonId ? (
                        <Link
                          href={`/rezervasyon/${durum.rezervasyonId}`}
                          className="kashe-tap text-sm font-medium text-brand-ink hover:underline"
                        >
                          Rezervasyonu aç →
                        </Link>
                      ) : undefined
                    }
                  />
                </div>
              </section>

              <KarsiTarafPaneli
                other={{
                  id: other.id,
                  full_name: karsiTarafAdi,
                  avatar_url: other.avatar_url,
                  company_name: other.company_name,
                  role: other.role,
                  bio: other.bio,
                  phone: otherContact?.phone ?? null,
                  email: otherContact?.email ?? null,
                  city: other.turkish_cities?.name ?? null,
                  last_seen_at: other.last_seen_at,
                }}
                viewerRole={isCustomerSide ? 'customer' : 'professional'}
                contactUnlocked={contactUnlocked}
                iptalNedeniyle={
                  !contactUnlocked &&
                  (convBookings ?? []).some((b) => b.status === 'cancelled')
                }
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}