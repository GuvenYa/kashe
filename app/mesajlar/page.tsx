import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';

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

function formatRelativeTime(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Az önce';
  if (diffMin < 60) return `${diffMin} dakika önce`;
  if (diffHour < 24) return `${diffHour} saat önce`;
  if (diffDay < 7) return `${diffDay} gün önce`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export default async function MesajlarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris');
  }

  // Tüm konuşmalarımı çek (hem müşteri hem profesyonel olarak)
  const { data: conversationsData } = await supabase
    .from('conversations')
    .select(
      `
      id, customer_id, professional_id, event_date, event_type, last_message_at,
      customer:customer_id (id, full_name, avatar_url, company_name, role),
      professional:professional_id (id, full_name, avatar_url, company_name, role)
      `
    )
    .or(`customer_id.eq.${user.id},professional_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false });

  const conversations = (conversationsData || []) as unknown as ConversationRow[];

  // Her konuşma için: son mesaj + okunmamış sayısı (paralel batch)
  const conversationIds = conversations.map((c) => c.id);

  let lastMessagesByConv: Record<
    string,
    { body: string; sender_id: string; created_at: string }
  > = {};
  let unreadCountsByConv: Record<string, number> = {};

  if (conversationIds.length > 0) {
    // Son mesajlar: her konuşma için en son tek mesajı çek
    // Basit yöntem: tüm mesajları çek, JS'te grup
    const { data: allMessages } = await supabase
      .from('messages')
      .select('conversation_id, body, sender_id, created_at, read_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    (allMessages || []).forEach((msg) => {
      // İlk gelen (en son) konuşmanın son mesajıdır
      if (!lastMessagesByConv[msg.conversation_id]) {
        lastMessagesByConv[msg.conversation_id] = {
          body: msg.body,
          sender_id: msg.sender_id,
          created_at: msg.created_at,
        };
      }
      // Okunmamış: bana gelen + henüz okumadığım
      if (msg.sender_id !== user.id && !msg.read_at) {
        unreadCountsByConv[msg.conversation_id] =
          (unreadCountsByConv[msg.conversation_id] || 0) + 1;
      }
    });
  }

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

          {conversations.length === 0 ? (
            <div className="bg-white border border-line rounded-lg p-12 text-center">
              <p className="font-display text-2xl text-ink mb-3">
                Henüz mesajın yok.
              </p>
              <p className="text-ink-72 max-w-md mx-auto mb-6">
                Keşfet sayfasından bir profesyonele mesaj göndererek başlayabilirsin.
              </p>
              <Link
                href="/kesfet"
                className="inline-block px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
              >
                Profesyonelleri keşfet
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map((conv) => {
                const isCustomer = conv.customer_id === user.id;
                const other = isCustomer ? conv.professional : conv.customer;
                if (!other) return null;

                const otherName =
                  other.role === 'business' && other.company_name
                    ? other.company_name
                    : other.full_name || 'İsimsiz';

                const initials = (other.full_name || other.company_name || 'K')
                  .split(' ')
                  .map((s) => s[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const lastMessage = lastMessagesByConv[conv.id];
                const unreadCount = unreadCountsByConv[conv.id] || 0;

                return (
                  <Link
                    key={conv.id}
                    href={`/mesajlar/${conv.id}`}
                    className="block bg-white border border-line rounded-lg p-5 hover:border-terracotta transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {other.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={other.avatar_url}
                          alt={otherName}
                          className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold shrink-0">
                          {initials}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-display font-semibold text-ink truncate">
                            {otherName}
                          </p>
                          <p className="text-xs text-ink-72 shrink-0">
                            {formatRelativeTime(conv.last_message_at)}
                          </p>
                        </div>

                        {lastMessage && (
                          <p
                            className={`text-sm truncate ${
                              unreadCount > 0
                                ? 'text-ink font-medium'
                                : 'text-ink-72'
                            }`}
                          >
                            {lastMessage.sender_id === user.id && 'Sen: '}
                            {lastMessage.body}
                          </p>
                        )}

                        {conv.event_type && (
                          <p className="text-xs text-ink-72 mt-1 font-mono uppercase tracking-[0.1em]">
                            {conv.event_type}
                            {conv.event_date &&
                              ` · ${new Date(conv.event_date).toLocaleDateString('tr-TR')}`}
                          </p>
                        )}
                      </div>

                      {unreadCount > 0 && (
                        <div className="shrink-0 min-w-[24px] h-6 px-2 bg-terracotta text-paper rounded-full flex items-center justify-center text-xs font-display font-semibold">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}