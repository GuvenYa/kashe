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
  assignedIds: string[];
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

// Renk tonları — hero/featured-profiles ile aynı dil
const TONES = [
  { bg: 'rgba(200,68,42,0.12)', fg: '#C8442A' },
  { bg: 'rgba(107,46,92,0.12)', fg: '#6B2E5C' },
  { bg: 'rgba(63,107,71,0.12)', fg: '#3F6B47' },
  { bg: 'rgba(168,52,30,0.12)', fg: '#A8341E' },
];

function pickTone(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return TONES[h % TONES.length];
}

function formatMessageTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) return 'Bugün';
  if (dateOnly.getTime() === yesterday.getTime()) return 'Dün';

  // Bu yıl içinde mi?
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
    });
  }
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDateKey(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function KonusmaDetay({
  conversationId,
  currentUserId,
  isProfessional,
  isAssignedPro,
  isOwnerAgency,
  assignedIds,
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
  const [assigned, setAssigned] = useState<string[]>(assignedIds);
  const [assignOpen, setAssignOpen] = useState(false);
  const [isAssigning, startAssignTransition] = useTransition();

  useEffect(() => {
    setAssigned(assignedIds);
  }, [assignedIds]);

  const assignedMembers = teamMembers.filter((m) => assigned.includes(m.id));

  function handleToggleAssign(professionalId: string) {
    setError(null);
    const isCurrentlyAssigned = assigned.includes(professionalId);
    startAssignTransition(async () => {
      const result = isCurrentlyAssigned
        ? await unassignConversation(conversationId, professionalId)
        : await assignConversation(conversationId, professionalId);
      if (result.success) {
        setAssigned((prev) =>
          isCurrentlyAssigned
            ? prev.filter((id) => id !== professionalId)
            : [...prev, professionalId]
        );
        router.refresh();
      } else {
        setError(result.error || 'İşlem başarısız.');
      }
    });
  }

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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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

  const otherTone = pickTone(other.id);

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

  useEffect(() => {
    setQuotesById(initialQuotes);
  }, [initialQuotes]);

  useEffect(() => {
    markConversationRead(conversationId).catch(() => {});
  }, [conversationId]);

  // Realtime: yeni mesaj + presence (typing, online)
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isCancelled = false;

    async function setupChannel() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
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

  // Yeni mesajda mesaj listesinin altına scroll (sadece liste içi, sayfa scroll'una dokunma)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length]);

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

  const distinctSenders = new Set(
    messages
      .filter((m) => m.message_type !== 'system')
      .map((m) => m.sender_id)
  );
  const showSenderNames = distinctSenders.size > 2;

  // Etkinlik özeti çıtası için tek satır
  const briefBits: { label: string; value: string }[] = [];
  if (eventType) {
    briefBits.push({ label: 'Tür', value: getEventTypeLabel(eventType) ?? eventType });
  }
  if (eventDate) {
    briefBits.push({
      label: 'Tarih',
      value: new Date(eventDate).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    });
  }
  if (location) {
    briefBits.push({ label: 'Lokasyon', value: location });
  }
  if (guestCount !== null) {
    briefBits.push({ label: 'Kişi', value: String(guestCount) });
  }
  if (budgetRange) {
    briefBits.push({
      label: 'Bütçe',
      value: getBudgetRangeLabel(budgetRange) ?? budgetRange,
    });
  }
  const hasBrief = briefBits.length > 0;

  const canSend = body.trim().length > 0 && !isPending;

  return (
    <div className="bg-card border border-line rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-150px)] md:h-[calc(100vh-180px)] min-h-[500px]">
      {/* HEADER */}
      <div className="border-b border-line px-4 md:px-5 py-3 md:py-4 flex items-center gap-3 md:gap-4 bg-card">
        <Link
          href={`/p/${other.id}`}
          className="flex items-center gap-3 group min-w-0 flex-1"
        >
          <div className="relative shrink-0">
            {other.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={other.avatar_url}
                alt={otherName}
                className="w-11 h-11 rounded-full object-cover border border-line"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-display font-semibold text-sm"
                style={{ background: otherTone.bg, color: otherTone.fg }}
              >
                {initials}
              </div>
            )}
            {isOtherOnline && (
              <span
                className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card kashe-pulse"
                aria-label="Çevrimiçi"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold text-base text-ink truncate group-hover:text-terracotta transition-colors">
              {otherName}
            </p>
            {isOtherTyping ? (
              <p className="text-[11px] text-terracotta font-mono uppercase tracking-[0.14em] italic">
                yazıyor...
              </p>
            ) : isOtherOnline ? (
              <p className="text-[11px] text-ink-72 font-mono uppercase tracking-[0.14em] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Çevrimiçi
              </p>
            ) : (
              <p className="text-[11px] text-ink-50 font-mono uppercase tracking-[0.14em]">
                Çevrimdışı
              </p>
            )}
          </div>
        </Link>

        {isOwnerAgency && (
          <div className="relative shrink-0" ref={assignRef}>
            <div className="flex items-center gap-2.5">
              {assignedMembers.length > 0 && (
                <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-[0.14em] text-moss">
                  {assignedMembers.length === 1
                    ? `${assignedMembers[0].full_name || 'Bir üye'} atandı`
                    : `${assignedMembers.length} kişi`}
                </span>
              )}
              <button
                type="button"
                onClick={() => setAssignOpen((v) => !v)}
                disabled={isAssigning || teamMembers.length === 0}
                className="kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 bg-plum/10 hover:bg-plum/15 text-plum rounded-full text-[10px] font-mono uppercase tracking-[0.14em] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assignedMembers.length > 0 ? 'Düzenle' : 'Ekibe ata'}
              </button>
            </div>

            {assignOpen && (
              <div className="absolute right-0 top-full mt-2 z-20 w-60 bg-card border border-line rounded-xl shadow-lg py-1.5">
                {teamMembers.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-ink-72">
                    Ekibinde henüz üye yok.
                  </p>
                ) : (
                  teamMembers.map((m) => {
                    const isOn = assigned.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleToggleAssign(m.id)}
                        disabled={isAssigning}
                        className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-paper-2 transition-colors disabled:opacity-50 flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{m.full_name || 'İsimsiz'}</span>
                        <span
                          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                            isOn ? 'bg-plum border-plum text-paper' : 'border-line'
                          }`}
                        >
                          {isOn ? '✓' : ''}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ETKİNLİK ÖZETİ ÇITASI — kompakt tek satır, scroll edilebilir */}
      {hasBrief && (
        <div className="border-b border-line bg-terracotta/[0.04] px-4 md:px-5 py-2">
          <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap kashe-no-scrollbar">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta shrink-0">
              Etkinlik
            </span>
            {briefBits.map((b, i) => (
              <span key={b.label} className="flex items-center gap-2 shrink-0">
                {i > 0 && (
                  <span className="w-1 h-1 rounded-full bg-ink-50 inline-block" />
                )}
                <span className="text-[11px] text-ink-72 font-mono uppercase tracking-[0.12em]">
                  {b.label}:
                </span>
                <span className="text-[12px] text-ink font-medium">{b.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* MESSAGES */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 md:px-5 py-5 space-y-3 bg-paper/40"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-center text-ink-72 text-sm py-8 max-w-xs">
              Konuşma başlamak üzere. İlk mesajı sen yaz.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            // Tarih grubu pill — gün değişiminde göster (ilk mesaj dahil)
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showDayLabel =
              !prevMsg ||
              getDateKey(prevMsg.created_at) !== getDateKey(msg.created_at);
            const dayLabelEl = showDayLabel ? (
              <div className="flex justify-center my-4">
                <span className="inline-flex items-center bg-line/40 border border-line/50 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.16em] text-ink-72">
                  {formatDayLabel(msg.created_at)}
                </span>
              </div>
            ) : null;

            // Quote tipinde mesaj — Quote kartı render et
            if (msg.message_type === 'quote' && msg.quote_id) {
              const quote = quotesById[msg.quote_id];
              if (!quote) {
                return (
                  <div key={msg.id}>
                    {dayLabelEl}
                    <div className="flex justify-center my-2">
                      <p className="text-xs text-ink-50 font-mono">
                        Teklif yükleniyor...
                      </p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={msg.id}>
                  {dayLabelEl}
                  <QuoteCard quote={quote} currentUserId={currentUserId} />
                </div>
              );
            }

            if (msg.message_type === 'system') {
              return (
                <div key={msg.id}>
                  {dayLabelEl}
                  <SystemMessage body={msg.body} createdAt={msg.created_at} />
                </div>
              );
            }

            const isMine = msg.sender_id === currentUserId;
            return (
              <div
              key={msg.id}>
                {dayLabelEl}
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    isMine
                      ? 'bg-terracotta text-paper rounded-br-md shadow-[0_4px_12px_-4px_rgba(200,68,42,0.35)]'
                      : 'bg-card border border-line text-ink rounded-bl-md shadow-sm'
                  }`}
                >
                  {!isMine && showSenderNames && (
                    <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-plum mb-1">
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
                      isMine ? 'text-paper/70' : 'text-ink-50'
                    }`}
                  >
                    {formatMessageTime(msg.created_at)}
                  </p>
                </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-line p-3 md:p-4 bg-card"
      >
        {error && (
          <p className="text-xs text-terracotta mb-2">{error}</p>
        )}
        <div className="flex items-end gap-2 md:gap-3">
          {(isProfessional || isAssignedPro) && (
            <button
              type="button"
              onClick={() => setQuoteModalOpen(true)}
              aria-label="Teklif gönder"
              title="Teklif gönder"
              className="kashe-tap shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl border border-plum/30 bg-plum/8 text-plum hover:bg-plum/15 hover:border-plum/50 transition flex items-center justify-center font-display text-xl leading-none"
            >
              +
            </button>
          )}
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
            className="flex-1 px-4 py-3 bg-paper border border-line rounded-xl text-ink placeholder:text-ink-50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none text-sm"
          />
          <button
            type="submit"
            disabled={!canSend}
            className={`kashe-tap shrink-0 px-5 py-3 rounded-xl font-display font-semibold text-sm transition-all whitespace-nowrap ${
              canSend
                ? 'bg-terracotta text-paper hover:bg-ember shadow-[3px_3px_0_var(--color-terracotta-12)]'
                : 'bg-terracotta/40 text-paper cursor-not-allowed'
            }`}
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
