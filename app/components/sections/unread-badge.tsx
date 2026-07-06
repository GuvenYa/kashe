'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/app/lib/supabase-browser';
import {
  getUnreadMessageCount,
  getTeamConversationIds,
} from '@/app/mesajlar/actions';

type Props = {
  userId: string;
};

export function UnreadBadge({ userId }: Props) {
  const [count, setCount] = useState<number>(0);
  // Kurumsal ekip (pasif gözlemci) konuşmaları — realtime increment'te sayılmaz
  const teamConvIdsRef = useRef<Set<string>>(new Set());

  // İlk fetch + team konuşma id'leri (increment hariç tutma için)
  useEffect(() => {
    getUnreadMessageCount().then(setCount).catch(() => setCount(0));
    getTeamConversationIds()
      .then((ids) => {
        teamConvIdsRef.current = new Set(ids);
      })
      .catch(() => {});
  }, []);

  // Realtime: INSERT artırır, UPDATE (read_at set) sayıyı re-sync
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
        .channel(`unread-badge:${userId}`)
        .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as {
            sender_id: string;
            read_at: string | null;
            conversation_id: string;
          };
          // Kurumsal ekip (pasif gözlemci) konuşması → sayma (hayalet unread önle)
          if (teamConvIdsRef.current.has(newMessage.conversation_id)) return;
          // RLS bizi sadece kendi konuşmalarımızdaki mesajlara sınırlar.
          // Kendi mesajlarımızı sayma.
          if (newMessage.sender_id !== userId && !newMessage.read_at) {
            setCount((c) => c + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // read_at güncellendi → fresh sayıyı çek
          getUnreadMessageCount().then(setCount).catch(() => {});
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

  // Tab focus'a geri dönünce drift'i temizle
  useEffect(() => {
    function onFocus() {
      getUnreadMessageCount().then(setCount).catch(() => {});
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-terracotta text-paper rounded-full text-[10px] font-display font-semibold leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}