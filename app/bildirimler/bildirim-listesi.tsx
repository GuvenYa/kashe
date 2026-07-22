'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-browser';
import {
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from './actions';

type Props = {
  initialNotifications: Notification[];
  initialUnreadCount: number;
};

// Türkçe relative time formatlama
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Az önce';
  if (diffMin < 60) return `${diffMin} dakika önce`;
  if (diffHour < 24) return `${diffHour} saat önce`;
  if (diffDay < 7) return `${diffDay} gün önce`;

  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Bildirimi tarih grubuna ayır
function getDateGroup(iso: string): 'today' | 'week' | 'older' {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return 'today';
  if (diffDays < 7) return 'week';
  return 'older';
}

const GROUP_LABELS: Record<'today' | 'week' | 'older', string> = {
  today: 'Bugün',
  week: 'Bu hafta',
  older: 'Daha eski',
};

// Bildirim tipine göre etiket
const TYPE_LABELS: Record<Notification['type'], string> = {
  message: 'Mesaj',
  review: 'Yorum',
  review_reply: 'Yanıt',
};

export function BildirimListesi({
  initialNotifications,
  initialUnreadCount,
}: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isPending, startTransition] = useTransition();

  // Realtime: bu sayfa açıkken yeni bildirim gelirse listeye ekle
  useEffect(() => {
    // İlk bildirimden user_id'yi al; liste boşsa subscription kurmaya gerek yok
    // (boş listede zaten sayfa "Henüz bildirim yok" state'inde, bu component render olmuyor)
    const userId = initialNotifications[0]?.user_id;
    if (!userId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`notifications-list:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          // En üste ekle, duplikasyon önle
          setNotifications((prev) => {
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
          if (!newNotif.read_at) {
            setUnreadCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialNotifications]);

  function handleClick(notif: Notification) {
    // Okunmamışsa optimistic markRead
    if (!notif.read_at) {
      const readAt = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: readAt } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      startTransition(async () => {
        const result = await markNotificationRead(notif.id);
        if (!result.success) {
          // Revert
          setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, read_at: null } : n))
          );
          setUnreadCount((c) => c + 1);
        }
      });
    }

    router.push(notif.link);
  }

  function handleMarkAll() {
    if (unreadCount === 0) return;

    const readAt = new Date().toISOString();
    const prevState = notifications;
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt }))
    );
    setUnreadCount(0);

    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.success) {
        setNotifications(prevState);
        setUnreadCount(prevState.filter((n) => !n.read_at).length);
      }
    });
  }

  // Gruplara ayır
  const groups: Record<'today' | 'week' | 'older', Notification[]> = {
    today: [],
    week: [],
    older: [],
  };
  notifications.forEach((n) => {
    groups[getDateGroup(n.created_at)].push(n);
  });

  return (
    <>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
            Bildirimler
          </p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={isPending}
              className="font-mono text-xs uppercase tracking-[0.16em] text-brand-ink hover:underline disabled:opacity-50 disabled:cursor-wait transition-opacity"
            >
              Tümünü okundu işaretle
            </button>
          )}
        </div>
        <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink tracking-tight">
          {unreadCount > 0 ? (
            <>
              <em className="text-brand-ink not-italic italic font-medium">
                {unreadCount} yeni
              </em>{' '}
              bildirimin var.
            </>
          ) : (
            <>Tümü okunmuş.</>
          )}
        </h1>
      </div>

      {/* Gruplar */}
      <div className="space-y-8">
        {(['today', 'week', 'older'] as const).map((groupKey) => {
          const items = groups[groupKey];
          if (items.length === 0) return null;

          return (
            <div key={groupKey}>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
                {GROUP_LABELS[groupKey]}
              </p>
              <div className="bg-card border border-line rounded-lg overflow-hidden">
                {items.map((notif, idx) => {
                  const isUnread = !notif.read_at;
                  const isLast = idx === items.length - 1;

                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => handleClick(notif)}
                      className={`w-full text-left px-6 py-4 flex items-start gap-4 transition-colors hover:bg-paper ${
                        !isLast ? 'border-b border-line' : ''
                      } ${isUnread ? 'bg-brand-ink/5' : ''}`}
                    >
                      {/* Okunmamış indikatörü */}
                      <div className="pt-1.5 shrink-0">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isUnread ? 'bg-brand-ink' : 'bg-transparent'
                          }`}
                          aria-hidden="true"
                        />
                      </div>

                      {/* İçerik */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
                          <p
                            className={`text-ink ${
                              isUnread ? 'font-semibold' : ''
                            }`}
                          >
                            {notif.body}
                          </p>
                          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 shrink-0">
                            {TYPE_LABELS[notif.type]}
                          </p>
                        </div>
                        <p className="text-xs text-ink-72">
                          {formatRelativeTime(notif.created_at)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}