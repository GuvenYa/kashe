import { createClient } from '@/app/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { KonusmaDetay } from './konusma-detay';
import { KarsiTarafPaneli } from './karsi-taraf-paneli';
import type { Message } from '@/app/lib/types';
import type { Quote } from '../quotes-data';

type ConversationParticipant = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
  bio: string | null;
  phone: string | null;
  email: string | null;
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
  customer: ConversationParticipant | null;
  professional: ConversationParticipant | null;
};

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
    redirect('/giris');
  }

  // Suspension kontrolü — askıdaki kullanıcı mesajlaşamaz
  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) redirect('/askiya-alindi');

  // Kurumsal ekip üyeliği (owner OLMAYAN) — üye kurum konuşmasını PASİF izler
  const { data: memberships } = await supabase
    .from('business_members')
    .select('business_id, member_role')
    .eq('member_user_id', user.id);
  const teamBusinessIds = (memberships ?? [])
    .filter((m) => m.member_role !== 'owner')
    .map((m) => m.business_id);

  const { data: convData } = await supabase
    .from('conversations')
    .select(
      `
      id, customer_id, professional_id,
      event_date, event_type, location, guest_count, budget_range,
      customer:customer_id (
        id, full_name, avatar_url, company_name, role, bio, phone, email, last_seen_at,
        turkish_cities(name),
        service_categories!profiles_primary_category_id_fkey(slug)
      ),
      professional:professional_id (
        id, full_name, avatar_url, company_name, role, bio, phone, email, last_seen_at,
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
  const canWrite =
    isTeam &&
    (memberships ?? []).some(
      (m) =>
        m.business_id === conv.customer_id &&
        (m.member_role === 'owner' || m.member_role === 'manager')
    );

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
  const { data: dealRows } = await supabase
    .from('bookings')
    .select('id')
    .eq('conversation_id', id)
    .in('status', ['confirmed', 'completed'])
    .limit(1);

  const contactUnlocked = (dealRows?.length ?? 0) > 0;

  // Profesyonel mi tespit et (teklif gönderme yetkisi — owner kalıyor)
  const isProfessional = conv.professional_id === user.id;

  // Sahibi ajans mı? (atama dropdown'ı sadece ona görünür)
  const isOwnerAgency =
    conv.professional_id === user.id && conv.professional?.role === 'agency';

  // Owner ajansın ekip üyeleri (atama dropdown'ı için)
  let teamMembers: { id: string; full_name: string | null }[] = [];
  if (isOwnerAgency) {
    const { data: membersData } = await supabase
      .from('agency_members')
      .select(
        'professional:profiles!agency_members_professional_id_fkey (id, full_name)'
      )
      .eq('agency_id', user.id);

    teamMembers = (membersData ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m) => (m as any).professional)
      .filter(Boolean) as { id: string; full_name: string | null }[];
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-4 md:px-12 py-4 md:py-8">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/mesajlar"
            className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-3 md:mb-4"
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
                  full_name: other.full_name,
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
                initialMessages={messages}
                initialQuotes={quotesById}
              />
            </div>

            <KarsiTarafPaneli
              other={{
                id: other.id,
                full_name: other.full_name,
                avatar_url: other.avatar_url,
                company_name: other.company_name,
                role: other.role,
                bio: other.bio,
                phone: contactUnlocked ? other.phone : null,
                email: contactUnlocked ? other.email : null,
                city: other.turkish_cities?.name ?? null,
                last_seen_at: other.last_seen_at,
              }}
              viewerRole={isCustomerSide ? 'customer' : 'professional'}
              contactUnlocked={contactUnlocked}
            />
          </div>
        </div>
      </main>
    </>
  );
}