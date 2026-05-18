'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-browser';
import { getEventTypeLabel } from './data';

type OtherUserMini = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
};

export type ConversationItem = {
  id: string;
  customer_id: string;
  professional_id: string;
  event_date: string | null;
  event_type: string | null;
  last_message_at: string;
  other: OtherUserMini;
  last_message: {
    body: string;
    sender_id: string;
    created_at: string;
  } | null;
  unread_count: number;
};

type Props = {
  currentUserId: string;
  initialConversations: ConversationItem[];
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

type DateGroup = 'today' | 'week' | 'older';

function getDateGroup(iso: string): DateGroup {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return 'today';
  if (diffDays < 7) return 'week';
  return 'older';
}

const GROUP_LABELS: Record<DateGroup, string> = {
  today: 'Bugün',
  week: 'Bu hafta',
  older: 'Daha eski',
};

export function MesajListesi({ currentUserId, initialConversations }: Props) {
  const [conversations, setConversations] = useState<ConversationItem[]>(
    initialConversations
  );

  // Prop güncellenirse (router.refresh sonrası) state'i tazele
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  // Realtime: messages INSERT/UPDATE
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isCancelled = false;

    async function setupChannel() {
      // Auth context'i realtime'a manuel ilet (race condition'ı önle)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }

      if (isCancelled) return;

      channel = supabase
        .channel(`mesajlar-listesi:${currentUserId}`)
        .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const m = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            body: string;
            created_at: string;
            read_at: string | null;
          };

          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === m.conversation_id);
            if (idx === -1) return prev; // konuşma listede yok, ignore

            const updated = { ...prev[idx] };
            updated.last_message = {
              body: m.body,
              sender_id: m.sender_id,
              created_at: m.created_at,
            };
            updated.last_message_at = m.created_at;
            if (m.sender_id !== currentUserId && !m.read_at) {
              updated.unread_count = updated.unread_count + 1;
            }

            // Bu konuşmayı tepeye taşı, diğerlerinin sırasını koru
            const rest = prev.filter((_, i) => i !== idx);
            return [updated, ...rest];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const m = payload.new as {
            conversation_id: string;
            sender_id: string;
            read_at: string | null;
          };
          // read_at güncellendi (genelde markAsRead) → unread'i sıfırla
          if (m.sender_id !== currentUserId && m.read_at) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === m.conversation_id ? { ...c, unread_count: 0 } : c
              )
            );
          }
        }
      )
      .subscribe();
    }

    setupChannel();

    return () => {
      isCancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUserId]);

  if (conversations.length === 0) {
    return (
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
    );
  }

  // Konuşmaları tarih gruplarına böl. Sıra korunur — state hep last_message_at DESC sıralı.
  const groups: Record<DateGroup, ConversationItem[]> = {
    today: [],
    week: [],
    older: [],
  };
  conversations.forEach((conv) => {
    groups[getDateGroup(conv.last_message_at)].push(conv);
  });

  return (
    <div className="space-y-8">
      {(['today', 'week', 'older'] as const).map((groupKey) => {
        const items = groups[groupKey];
        if (items.length === 0) return null;

        return (
          <div key={groupKey}>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
              {GROUP_LABELS[groupKey]}
            </p>
            <div className="space-y-3">
              {items.map((conv) => {
                const other = conv.other;
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

                const lastMessage = conv.last_message;
                const unreadCount = conv.unread_count;

                return (
                  <Link
                    key={conv.id}
                    href={`/mesajlar/${conv.id}`}
                    className="block bg-white border border-line rounded-lg p-5 hover:border-terracotta transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {other.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
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
                            {lastMessage.sender_id === currentUserId && 'Sen: '}
                            {lastMessage.body}
                          </p>
                        )}

                        {(conv.event_type || conv.event_date) && (
                          <p className="text-xs text-ink-72 mt-1 font-mono uppercase tracking-[0.1em]">
                            {conv.event_type &&
                              (getEventTypeLabel(conv.event_type) ?? conv.event_type)}
                            {conv.event_type && conv.event_date && ' · '}
                            {conv.event_date &&
                              new Date(conv.event_date).toLocaleDateString('tr-TR')}
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
          </div>
        );
      })}
    </div>
  );
}