'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sendMessage, markConversationRead } from '../actions';
import { createClient } from '@/app/lib/supabase-browser';
import type { Message } from '@/app/lib/types';

type OtherUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
};

type Props = {
  conversationId: string;
  currentUserId: string;
  other: OtherUser;
  eventDate: string | null;
  eventType: string | null;
  initialMessages: Message[];
};

function formatMessageTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) {
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function KonusmaDetay({
  conversationId,
  currentUserId,
  other,
  eventDate,
  eventType,
  initialMessages,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Prop'tan yeni mesajlar gelirse (router.refresh fallback) dedup ile state'e merge et
  useEffect(() => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const incoming = initialMessages.filter((m) => !existingIds.has(m.id));
      if (incoming.length === 0) return prev;
      return [...prev, ...incoming].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, [initialMessages]);
// Mount'ta okunmamış mesajları işaretle (eski page.tsx render-time call yerine)
  useEffect(() => {
    markConversationRead(conversationId).catch(() => {
      // sessiz fail
    });
  }, [conversationId]);
  // Realtime: bu konuşmaya gelen yeni mesajları dinle
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
          // Karşı taraftan geldi ve sayfa açık → okundu işaretle
          if (newMessage.sender_id !== currentUserId) {
            markConversationRead(conversationId).catch(() => {
              // sessiz fail; UX'i bozmasın
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  // Yeni mesajda en alta scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const text = body.trim();
    if (!text) return;

    startTransition(async () => {
      const result = await sendMessage(conversationId, text);
      if (result.success) {
        setBody('');
        // Mesaj realtime ile state'e düşecek; router.refresh failsafe
        router.refresh();
      } else {
        setError(result.error || 'Gönderilemedi.');
      }
    });
  }

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      {/* HEADER */}
      <div className="border-b border-line p-4 flex items-center gap-3 bg-paper">
        <Link href={`/p/${other.id}`} className="flex items-center gap-3 group">
          {other.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={other.avatar_url}
              alt={otherName}
              className="w-10 h-10 rounded-full object-cover border border-line"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-sm">
              {initials}
            </div>
          )}
          <div>
            <p className="font-display font-semibold text-ink group-hover:text-terracotta transition-colors">
              {otherName}
            </p>
            {(eventType || eventDate) && (
              <p className="text-xs text-ink-72 font-mono uppercase tracking-[0.1em]">
                {eventType}
                {eventType && eventDate && ' · '}
                {eventDate && new Date(eventDate).toLocaleDateString('tr-TR')}
              </p>
            )}
          </div>
        </Link>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-paper/30">
        {messages.length === 0 ? (
          <p className="text-center text-ink-72 text-sm py-8">
            Bu konuşmada henüz mesaj yok.
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    isMine
                      ? 'bg-terracotta text-paper rounded-br-sm'
                      : 'bg-white border border-line text-ink rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.body}
                  </p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isMine ? 'text-paper/70' : 'text-ink-72'
                    }`}
                  >
                    {formatMessageTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <form onSubmit={handleSubmit} className="border-t border-line p-4 bg-paper">
        {error && (
          <p className="text-xs text-terracotta mb-2">{error}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Mesajını yaz..."
            rows={1}
            maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            className="flex-1 px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none text-sm"
          />
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            className="px-5 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            {isPending ? '...' : 'Gönder'}
          </button>
        </div>
      </form>
    </div>
  );
}