'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  sendMessage,
  markConversationRead,
  assignConversation,
  unassignConversation,
} from '../actions';
import { getEventTypeLabel, getBudgetRangeLabel } from '../data';
import type { Quote } from '../quotes-data';
import { QuoteModal } from './quote-modal';
import { QuoteCard, SystemMessage } from './quote-message';
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
  isProfessional: boolean;
  isAssignedPro: boolean;
  isOwnerAgency: boolean;
  assignedProfessionalId: string | null;
  teamMembers: { id: string; full_name: string | null }[];
 senderNames: Record<string, { name: string; agencyTag: string | null }>;
  other: OtherUser;
  eventDate: string | null;
  eventType: string | null;
  location: string | null;
  guestCount: number | null;
  budgetRange: string | null;
  initialMessages: Message[];
  initialQuotes: Record<string, Quote>;
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
  isProfessional,
  isAssignedPro,
  isOwnerAgency,
  assignedProfessionalId,
  teamMembers,
  senderNames,
  other,
  eventDate,
  eventType,
  location,
  guestCount,
  budgetRange,
  initialMessages,
  initialQuotes,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [quotesById, setQuotesById] =
    useState<Record<string, Quote>>(initialQuotes);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [assignedId, setAssignedId] = useState<string | null>(
    assignedProfessionalId
  );
  const [assignOpen, setAssignOpen] = useState(false);
  const [isAssigning, startAssignTransition] = useTransition();

  const assignedName =
    teamMembers.find((m) => m.id === assignedId)?.full_name || 'Bir üye';

  function handleAssign(professionalId: string) {
    setError(null);
    startAssignTransition(async () => {
      const result = await assignConversation(conversationId, professionalId);
      if (result.success) {
        setAssignedId(professionalId);
        setAssignOpen(false);
        router.refresh();
      } else {
        setError(result.error || 'Atama başarısız.');
      }
    });
  }

  function handleUnassign() {
    setError(null);
    startAssignTransition(async () => {
      const result = await unassignConversation(conversationId);
      if (result.success) {
        setAssignedId(null);
        setAssignOpen(false);
        router.refresh();
      } else {
        setError(result.error || 'Atama kaldırılamadı.');
      }
    });
  }

  // Dropdown dışına tıklanınca kapat
  useEffect(() => {
    if (!assignOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) {
        setAssignOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [assignOpen]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const assignRef = useRef<HTMLDivElement>(null);

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

  // Quote'lar prop'tan değişirse state'i tazele (yeni quote, status değişikliği)
  useEffect(() => {
    setQuotesById(initialQuotes);
  }, [initialQuotes]);

  // Mount'ta okunmamış mesajları işaretle
  useEffect(() => {
    markConversationRead(conversationId).catch(() => {
      // sessiz fail
    });
  }, [conversationId]);

  // Realtime: yeni mesaj + presence (typing, online)
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

      // Effect cleanup oldu mu kontrol et
      if (isCancelled) return;

      channel = supabase.channel(`messages:${conversationId}`, {
        config: { presence: { key: currentUserId } },
      });
      channelRef.current = channel;

      channel
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
          if (newMessage.sender_id !== currentUserId) {
            markConversationRead(conversationId).catch(() => {});
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel!.presenceState();
        const otherStates = state[other.id];
        setIsOtherOnline(!!(otherStates && otherStates.length > 0));
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const data = payload.payload as { userId: string; isTyping: boolean };
        if (data.userId !== currentUserId) {
          setIsOtherTyping(data.isTyping);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && channel) {
          await channel.track({});
        }
      });
    }

    setupChannel();

    return () => {
      isCancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
      channelRef.current = null;
    };
  }, [conversationId, currentUserId, other.id]);

  // Yeni mesajda en alta scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Textarea değişince typing state'ini broadcast et
  function broadcastTyping(isTyping: boolean) {
    if (!channelRef.current) return;
    channelRef.current
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, isTyping },
      })
      .catch(() => {});
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const text = body.trim();
    if (!text) return;

    startTransition(async () => {
      const result = await sendMessage(conversationId, text);
      if (result.success) {
        setBody('');
        broadcastTyping(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        router.refresh();
      } else {
        setError(result.error || 'Gönderilemedi.');
      }
    });
  }

  // Konuşmada ikiden fazla benzersiz gönderen varsa balonlarda isim göster
  const distinctSenders = new Set(
    messages
      .filter((m) => m.message_type !== 'system')
      .map((m) => m.sender_id)
  );
  const showSenderNames = distinctSenders.size > 2;

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      {/* HEADER */}
      <div className="border-b border-line p-4 flex items-center gap-3 bg-paper">
        <Link href={`/p/${other.id}`} className="flex items-center gap-3 group">
          <div className="relative shrink-0">
            {other.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
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
            {isOtherOnline && (
              <span
                className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-paper"
                aria-label="Çevrimiçi"
              />
            )}
          </div>
          <div>
            <p className="font-display font-semibold text-ink group-hover:text-terracotta transition-colors">
              {otherName}
            </p>
            {isOtherTyping ? (
              <p className="text-xs text-terracotta font-mono uppercase tracking-[0.1em] italic">
                yazıyor...
              </p>
            ) : (
              isOtherOnline && (
                <p className="text-xs text-ink-72 font-mono uppercase tracking-[0.1em]">
                  Çevrimiçi
                </p>
              )
            )}
          </div>
        </Link>

        {isOwnerAgency && (
          <div className="ml-auto relative" ref={assignRef}>
            {assignedId ? (
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono uppercase tracking-[0.1em] text-moss">
                  {assignedName} · atandı
                </span>
                <button
                  type="button"
                  onClick={() => setAssignOpen((v) => !v)}
                  disabled={isAssigning}
                  className="text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-terracotta transition-colors disabled:opacity-50"
                >
                  Değiştir
                </button>
                <button
                  type="button"
                  onClick={handleUnassign}
                  disabled={isAssigning}
                  className="text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-ember transition-colors disabled:opacity-50"
                >
                  Kaldır
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAssignOpen((v) => !v)}
                disabled={isAssigning || teamMembers.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-plum/8 hover:bg-plum/15 text-plum rounded-lg text-xs font-mono uppercase tracking-[0.1em] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ekibe ata
              </button>
            )}

            {assignOpen && (
              <div className="absolute right-0 top-full mt-2 z-10 w-56 bg-white border border-line rounded-lg shadow-lg py-1.5">
                {teamMembers.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-ink-72">
                    Ekibinde henüz üye yok.
                  </p>
                ) : (
                  teamMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleAssign(m.id)}
                      disabled={isAssigning || m.id === assignedId}
                      className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-paper transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {m.full_name || 'İsimsiz'}
                      {m.id === assignedId ? ' ✓' : ''}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BRIEF KARTI (eğer en az 1 alan dolu ise) */}
      {(eventType || eventDate || location || guestCount !== null || budgetRange) && (
        <div className="border-b border-line bg-terracotta/5 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Etkinlik özeti
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            {eventType && (
              <span className="flex items-center gap-1.5">
                <span className="text-ink-72 font-mono uppercase tracking-[0.1em]">Tür:</span>
                <span className="text-ink font-medium">
                  {getEventTypeLabel(eventType) ?? eventType}
                </span>
              </span>
            )}
            {eventDate && (
              <span className="flex items-center gap-1.5">
                <span className="text-ink-72 font-mono uppercase tracking-[0.1em]">Tarih:</span>
                <span className="text-ink font-medium">
                  {new Date(eventDate).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1.5">
                <span className="text-ink-72 font-mono uppercase tracking-[0.1em]">Lokasyon:</span>
                <span className="text-ink font-medium">{location}</span>
              </span>
            )}
            {guestCount !== null && (
              <span className="flex items-center gap-1.5">
                <span className="text-ink-72 font-mono uppercase tracking-[0.1em]">Kişi:</span>
                <span className="text-ink font-medium">{guestCount}</span>
              </span>
            )}
            {budgetRange && (
              <span className="flex items-center gap-1.5">
                <span className="text-ink-72 font-mono uppercase tracking-[0.1em]">Bütçe:</span>
                <span className="text-ink font-medium">
                  {getBudgetRangeLabel(budgetRange) ?? budgetRange}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-paper/30">
        {messages.length === 0 ? (
          <p className="text-center text-ink-72 text-sm py-8">
            Bu konuşmada henüz mesaj yok.
          </p>
        ) : (
          messages.map((msg) => {
            // Quote tipinde mesaj — Quote kartı render et
            if (msg.message_type === 'quote' && msg.quote_id) {
              const quote = quotesById[msg.quote_id];
              if (!quote) {
                // Quote henüz state'e gelmemiş (Realtime race) — placeholder
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <p className="text-xs text-ink-72 font-mono">
                      Teklif yükleniyor...
                    </p>
                  </div>
                );
              }
              return (
                <QuoteCard
                  key={msg.id}
                  quote={quote}
                  currentUserId={currentUserId}
                />
              );
            }

            // Sistem mesajı — sade ortalı satır
            if (msg.message_type === 'system') {
              return (
                <SystemMessage
                  key={msg.id}
                  body={msg.body}
                  createdAt={msg.created_at}
                />
              );
            }

            // Normal text mesaj (mevcut bubble)
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
                  {!isMine && showSenderNames && (
                    <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-plum mb-1">
                      {senderNames[msg.sender_id]?.name || 'Bilinmeyen'}
                      {senderNames[msg.sender_id]?.agencyTag && (
                        <span className="text-ink-72">
                          {' '}• {senderNames[msg.sender_id]!.agencyTag}
                        </span>
                      )}
                    </p>
                  )}
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
        {(isProfessional || isAssignedPro) && (
          <button
            type="button"
            onClick={() => setQuoteModalOpen(true)}
            className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 bg-[#1E3A5F]/8 hover:bg-[#1E3A5F]/15 text-[#1E3A5F] rounded-lg text-xs font-mono uppercase tracking-[0.1em] transition"
          >
            <span className="text-base leading-none">+</span>
            Teklif gönder
          </button>
        )}
        {error && (
          <p className="text-xs text-terracotta mb-2">{error}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => {
              const newValue = e.target.value;
              setBody(newValue);
              const hasContent = newValue.trim().length > 0;
              broadcastTyping(hasContent);
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              if (hasContent) {
                typingTimeoutRef.current = setTimeout(() => {
                  broadcastTyping(false);
                }, 1500);
              }
            }}
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
            disabled={isPending || body.trim().length === 0}
            className="px-5 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            {isPending ? '...' : 'Gönder'}
          </button>
        </div>
      </form>

      {(isProfessional || isAssignedPro) && (
        <QuoteModal
          conversationId={conversationId}
          open={quoteModalOpen}
          onClose={() => setQuoteModalOpen(false)}
        />
      )}
    </div>
  );
}