import { createClient } from '@/app/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { KonusmaDetay } from './konusma-detay';
import { markConversationRead } from '../actions';
import type { Message } from '@/app/lib/types';

type ConversationRow = {
  id: string;
  customer_id: string;
  professional_id: string;
  event_date: string | null;
  event_type: string | null;
  customer: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
  } | null;
  professional: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
  } | null;
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
      id, customer_id, professional_id, event_date, event_type,
      customer:customer_id (id, full_name, avatar_url, company_name, role),
      professional:professional_id (id, full_name, avatar_url, company_name, role)
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

  // Bu konuşmadaki okunmamış mesajları işaretle
  await markConversationRead(id);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/mesajlar"
            className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-6"
          >
            ← Tüm mesajlar
          </Link>

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
            initialMessages={messages}
          />
        </div>
      </main>
    </>
  );
}