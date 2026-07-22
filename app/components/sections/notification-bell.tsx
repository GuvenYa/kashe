'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/app/lib/supabase-browser';

type Props = {
  userId: string;
  initialCount: number;
};

export function NotificationBell({ userId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount);

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
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            setCount((c) => c + 1);
          }
        )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // read_at değişti mi kontrol et
          const oldRead = (payload.old as { read_at: string | null })?.read_at;
          const newRead = (payload.new as { read_at: string | null })?.read_at;

          if (oldRead === null && newRead !== null) {
            // Okunmamıştan okunmuşa geçti → sayacı düşür
            setCount((c) => Math.max(0, c - 1));
          } else if (oldRead !== null && newRead === null) {
            // (Olası değil ama) okunmuştan okunmamışa → sayacı artır
            setCount((c) => c + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldRead = (payload.old as { read_at: string | null })?.read_at;
          if (oldRead === null) {
            setCount((c) => Math.max(0, c - 1));
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
  }, [userId]);

  const hasUnread = count > 0;
  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <Link
      href="/bildirimler"
      className="relative inline-flex items-center justify-center w-7 h-7 text-ink-72 hover:text-brand-ink transition-colors"
      aria-label={hasUnread ? `${count} okunmamış bildirim` : 'Bildirimler'}
    >
      <Bell size={18} strokeWidth={1.75} />
      {hasUnread && (
        <span
          className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 bg-brand-ink text-paper text-[10px] font-mono font-bold rounded-full flex items-center justify-center leading-none"
          aria-hidden="true"
        >
          {displayCount}
        </span>
      )}
    </Link>
  );
}