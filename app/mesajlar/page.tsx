import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/app/components/sections/top-nav';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { MesajListesi, type ConversationItem } from './mesaj-listesi';

export const metadata = {
  title: 'Mesajlar — Kashe',
};

type ConversationRow = {
  id: string;
  customer_id: string;
  professional_id: string;
  event_date: string | null;
  event_type: string | null;
  last_message_at: string;
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

export default async function MesajlarPage() {
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
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  // Atandığım konuşma id'lerini junction'dan çek
  const { data: myAssignments } = await supabase
    .from('conversation_assignees')
    .select('conversation_id')
    .eq('professional_id', user.id);

  const assignedConvIds = (myAssignments ?? []).map((r) => r.conversation_id);

  // .or() filtresi için atanan id'leri ekle (varsa)
  const orFilter = [
    `customer_id.eq.${user.id}`,
    `professional_id.eq.${user.id}`,
    ...(assignedConvIds.length > 0
      ? [`id.in.(${assignedConvIds.join(',')})`]
      : []),
  ].join(',');

  // Tüm konuşmalarımı çek (müşteri, owner ajans/pro, veya atanan pro)
  const { data: conversationsData } = await supabase
    .from('conversations')
    .select(
      `
      id, customer_id, professional_id, event_date, event_type, last_message_at,
      customer:customer_id (id, full_name, avatar_url, company_name, role),
      professional:professional_id (id, full_name, avatar_url, company_name, role)
      `
    )
    .or(orFilter)
    .order('last_message_at', { ascending: false });

  type RawRow = {
    id: string;
    customer_id: string;
    professional_id: string;
    event_date: string | null;
    event_type: string | null;
    last_message_at: string;
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

  const rawConversations = (conversationsData || []) as unknown as RawRow[];
  const conversationIds = rawConversations.map((c) => c.id);

  // Son mesaj + okunmamış sayıları için tek sorgu
  let lastMessagesByConv: Record<
    string,
    { body: string; sender_id: string; created_at: string }
  > = {};
  let unreadCountsByConv: Record<string, number> = {};

  if (conversationIds.length > 0) {
    const { data: allMessages } = await supabase
      .from('messages')
      .select('conversation_id, body, sender_id, created_at, read_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    (allMessages || []).forEach((msg) => {
      if (!lastMessagesByConv[msg.conversation_id]) {
        lastMessagesByConv[msg.conversation_id] = {
          body: msg.body,
          sender_id: msg.sender_id,
          created_at: msg.created_at,
        };
      }
      if (msg.sender_id !== user.id && !msg.read_at) {
        unreadCountsByConv[msg.conversation_id] =
          (unreadCountsByConv[msg.conversation_id] || 0) + 1;
      }
    });
  }

  // ConversationItem listesini hazırla (karşı tarafı çöz)
  const conversations: ConversationItem[] = rawConversations
    .map((conv): ConversationItem | null => {
      const isCustomer = conv.customer_id === user.id;
      const other = isCustomer ? conv.professional : conv.customer;
      if (!other) return null;
      return {
        id: conv.id,
        customer_id: conv.customer_id,
        professional_id: conv.professional_id,
        event_date: conv.event_date,
        event_type: conv.event_type,
        last_message_at: conv.last_message_at,
        other: {
          id: other.id,
          full_name: other.full_name,
          avatar_url: other.avatar_url,
          company_name: other.company_name,
          role: other.role,
        },
        last_message: lastMessagesByConv[conv.id] ?? null,
        unread_count: unreadCountsByConv[conv.id] || 0,
      };
    })
    .filter((c): c is ConversationItem => c !== null);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
              Mesajlar
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              Tüm{' '}
              <em className="text-terracotta not-italic italic font-medium">
                konuşmaların
              </em>
              .
            </h1>
          </div>

          <MesajListesi
            currentUserId={user.id}
            initialConversations={conversations}
          />
        </div>
      </main>
    </>
  );
}