'use client';

import { useState, useRef, useEffect, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  sendMessage,
  sendMessageWithAttachment,
  getAttachmentUrl,
  markConversationRead,
  assignConversation,
  unassignConversation,
} from '../actions';
import { getEventTypeLabel, getBudgetRangeLabel } from '../data';
import type { Quote } from '../quotes-data';
import { QuoteModal } from './quote-modal';
import { QuoteCard, SystemMessage } from './quote-message';
import { createClient } from '@/app/lib/supabase-browser';
import { MediaLightbox } from '@/app/components/media-lightbox';
import type { Message } from '@/app/lib/types';
import {
  validateMessageContent,
  formatViolationMessage,
} from '@/app/lib/message-validation';
import {
  getChatTemplates,
  type TemplateRole,
} from '@/app/lib/message-templates';

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
  categorySlug: string | null;
  viewerRole: TemplateRole;
  eventDate: string | null;
  eventType: string | null;
  location: string | null;
  guestCount: number | null;
  budgetRange: string | null;
  initialMessages: Message[];
  initialQuotes: Record<string, Quote>;
};

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20 MB
const ATTACHMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ATTACHMENT_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function attachmentKind(mime: string): 'image' | 'pdf' | 'doc' | null {
  if (ATTACHMENT_IMAGE_TYPES.includes(mime)) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (ATTACHMENT_DOC_TYPES.includes(mime)) return 'doc';
  return null;
}

const TONES = [
  { bg: 'rgba(109,79,176,0.12)', fg: '#6D4FB0' }, // mor
  { bg: 'rgba(45,111,184,0.12)', fg: '#2D6FB8' }, // mavi
  { bg: 'rgba(181,133,31,0.12)', fg: '#B5851F' }, // altın
  { bg: 'rgba(226,103,74,0.12)', fg: '#E2674A' }, // mercan
  { bg: 'rgba(31,138,95,0.12)', fg: '#1F8A5F' },  // yeşil
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
  categorySlug,
  viewerRole,
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
  const [uploadingFile, setUploadingFile] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // GÜVENLİK — telefon/IBAN/e-posta için anlık client-side kontrol
  // Sunucu da aynı kontrolü yapar; bu sadece UX (kullanıcı bilinçli olur)
  const securityWarning = useMemo(() => {
    const trimmed = body.trim();
    if (trimmed.length < 6) return null; // çok kısa metin için kontrol gereksiz
    const v = validateMessageContent(trimmed);
    if (v.ok) return null;
    return formatViolationMessage(v.violations);
  }, [body]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setError(null);
    const kind = attachmentKind(file.type);
    if (!kind) {
      setError('Desteklenmeyen dosya tipi. Görsel, PDF veya Word gönderebilirsin.');
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setError("Dosya 20 MB'dan büyük olamaz.");
      return;
    }

    setUploadingFile(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${currentUserId}/${conversationId}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('message-attachments')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (upErr) {
        setError('Yükleme başarısız: ' + upErr.message);
        return;
      }

      const result = await sendMessageWithAttachment(
        conversationId,
        { path, type: kind, name: file.name },
        body.trim()
      );

      if (result.success) {
        setBody('');
        router.refresh();
      } else {
        setError(result.error || 'Dosya gönderilemedi.');
        // Başarısızsa yüklenen dosyayı temizle
        await supabase.storage.from('message-attachments').remove([path]);
      }
    } catch (err) {
      setError('Bir hata oluştu: ' + (err instanceof Error ? err.message : 'bilinmeyen'));
    } finally {
      setUploadingFile(false);
    }
  }

  // Bir mesaj ekini signed URL ile aç (resim → lightbox, doc → yeni sekme)
  async function openAttachment(msg: Message) {
    if (!msg.attachment_path) return;
    const result = await getAttachmentUrl(conversationId, msg.attachment_path);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    if (msg.attachment_type === 'image') {
      setLightboxUrl(result.url);
    } else {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const text = body.trim();
    if (!text) return;

    // Client-side son kontrol — eğer güvenlik uyarısı varsa gönderme
    if (securityWarning) {
      setError(securityWarning);
      return;
    }

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

  const briefBits: { label: string; value: string }[] = [];
  if (eventType) {
    briefBits.push({
      label: 'Tür',
      value: getEventTypeLabel(eventType) ?? eventType,
    });
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

  const chatTemplates = useMemo(
    () => getChatTemplates(viewerRole, categorySlug),
    [viewerRole, categorySlug]
  );
  const [templatesOpen, setTemplatesOpen] = useState(false);

  function applyTemplate(text: string) {
    // Mevcut metin varsa araya boşlukla ekle, yoksa direkt yaz
    setBody((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    setTemplatesOpen(false);
  }

  const canSend = body.trim().length > 0 && !isPending && !securityWarning;

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
                        <span className="truncate">
                          {m.full_name || 'İsimsiz'}
                        </span>
                        <span
                          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                            isOn
                              ? 'bg-plum border-plum text-paper'
                              : 'border-line'
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

      {/* ETKİNLİK ÖZETİ ÇITASI */}
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
                <span className="text-[12px] text-ink font-medium">
                  {b.value}
                </span>
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
              <div key={msg.id}>
                {dayLabelEl}
                <div
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isMine
                        ? 'bg-terracotta text-paper rounded-br-md shadow-[0_4px_12px_-4px_rgba(31,92,74,0.35)]'
                        : 'bg-card border border-line text-ink rounded-bl-md shadow-sm'
                    }`}
                  >
                    {!isMine && showSenderNames && (
                      <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-plum mb-1">
                        {senderNames[msg.sender_id]?.name || 'Bilinmeyen'}
                        {senderNames[msg.sender_id]?.agencyTag && (
                          <span className="text-ink-72">
                            {' '}
                            • {senderNames[msg.sender_id]!.agencyTag}
                          </span>
                        )}
                      </p>
                    )}
                    {msg.message_type === 'file' && msg.attachment_path && (
                      <button
                        type="button"
                        onClick={() => openAttachment(msg)}
                        className={`mb-2 flex items-center gap-2.5 rounded-lg border px-3 py-2 w-full text-left transition ${
                          isMine
                            ? 'border-paper/30 bg-paper/10 hover:bg-paper/20'
                            : 'border-line bg-paper hover:border-terracotta'
                        }`}
                      >
                        <span
                          className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                            isMine ? 'bg-paper/20' : 'bg-terracotta/10'
                          }`}
                        >
                          {msg.attachment_type === 'image' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isMine ? 'var(--color-paper)' : 'var(--color-terracotta)'} strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isMine ? 'var(--color-paper)' : 'var(--color-terracotta)'} strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <path d="M14 2v6h6" />
                            </svg>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-xs font-medium truncate ${isMine ? 'text-paper' : 'text-ink'}`}>
                            {msg.attachment_name || 'Dosya'}
                          </span>
                          <span className={`block text-[10px] ${isMine ? 'text-paper/70' : 'text-ink-50'}`}>
                            {msg.attachment_type === 'image' ? 'Görseli aç' : 'Dosyayı aç'}
                          </span>
                        </span>
                      </button>
                    )}
                    {msg.body && msg.body !== 'Dosya gönderildi' && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {msg.body}
                      </p>
                    )}
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
        {/* Hazır mesaj şablonları */}
        {chatTemplates.length > 0 && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setTemplatesOpen((v) => !v)}
              className="kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] border border-line text-ink-72 hover:border-terracotta hover:text-terracotta transition"
            >
              Hazır mesajlar
              <span aria-hidden="true">{templatesOpen ? '×' : '+'}</span>
            </button>
            {templatesOpen && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {chatTemplates.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="kashe-tap text-left text-[12px] leading-snug text-ink bg-paper border border-line rounded-lg px-2.5 py-1.5 hover:border-terracotta hover:bg-terracotta/[0.04] transition max-w-full"
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Güvenlik uyarısı — anlık */}
        {securityWarning && (
          <div className="mb-3 flex items-start gap-2 bg-terracotta-08 border border-terracotta/25 rounded-xl px-3 py-2.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="var(--color-terracotta)"
                strokeWidth="1.5"
              />
              <path
                d="M12 8v4"
                stroke="var(--color-terracotta)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="12" cy="16" r="1" fill="var(--color-terracotta)" />
            </svg>
            <p className="text-[12px] leading-relaxed text-ink">
              {securityWarning}
            </p>
          </div>
        )}

        {error && !securityWarning && (
          <p className="text-xs text-danger mb-2">{error}</p>
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            aria-label="Dosya ekle"
            title="Dosya ekle"
            className="kashe-tap shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl border border-line bg-paper text-ink-72 hover:text-terracotta hover:border-terracotta transition flex items-center justify-center disabled:opacity-50"
          >
            {uploadingFile ? (
              <span className="font-mono text-[10px]">...</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
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
            className={`flex-1 px-4 py-3 bg-paper border rounded-xl text-ink placeholder:text-ink-50 focus:outline-none focus:ring-2 transition resize-none text-sm ${
              securityWarning
                ? 'border-terracotta/50 focus:border-terracotta focus:ring-terracotta-08'
                : 'border-line focus:border-terracotta focus:ring-terracotta-08'
            }`}
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
          categorySlug={categorySlug}
          open={quoteModalOpen}
          onClose={() => setQuoteModalOpen(false)}
        />
      )}

      <MediaLightbox
        items={lightboxUrl ? [{ url: lightboxUrl, type: 'image' }] : []}
        index={lightboxUrl ? 0 : null}
        onClose={() => setLightboxUrl(null)}
        onNavigate={() => {}}
      />
    </div>
  );
}
