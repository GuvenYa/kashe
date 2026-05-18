import { createClient } from '@/app/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { KonusmaDetay } from './konusma-detay';
import { KarsiTarafPaneli } from './karsi-taraf-paneli';
import type { Message } from '@/app/lib/types';

type ConversationParticipant = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
  bio: string | null;
  phone: string | null;
  turkish_cities: { name: string } | null;
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

  const { data: convData } = await supabase
    .from('conversations')
    .select(
      `
      id, customer_id, professional_id,
      event_date, event_type, location, guest_count, budget_range,
      customer:customer_id (
        id, full_name, avatar_url, company_name, role, bio, phone,
        turkish_cities(name)
      ),
      professional:professional_id (
        id, full_name, avatar_url, company_name, role, bio, phone,
        turkish_cities(name)
      )
      `
    )
    .eq('id', id)
    .single();

  if (!convData) {
    notFound();
  }

  const conv = convData as unknown as ConversationRow;

  // Erişim kontrolü
  if (conv.customer_id !== user.id && conv.professional_id !== user.id) {
    notFound();
  }

  const isCustomer = conv.customer_id === user.id;
  const other = isCustomer ? conv.professional : conv.customer;

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

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-8 md:py-12">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/mesajlar"
            className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-6"
          >
            ← Tüm mesajlar
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
            <div className="min-w-0">
              <KonusmaDetay
                conversationId={conv.id}
                currentUserId={user.id}
                other={{
                  id: other.id,
                  full_name: other.full_name,
                  avatar_url: other.avatar_url,
                  company_name: other.company_name,
                  role: other.role,
                }}
                eventDate={conv.event_date}
                eventType={conv.event_type}
                location={conv.location}
                guestCount={conv.guest_count}
                budgetRange={conv.budget_range}
                initialMessages={messages}
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
                phone: other.phone,
                city: other.turkish_cities?.name ?? null,
              }}
              viewerRole={isCustomer ? 'customer' : 'professional'}
            />
          </div>
        </div>
      </main>
    </>
  );
}