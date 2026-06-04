import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { TopNav } from '@/app/components/sections/top-nav';
import { EmptyState } from '@/app/components/EmptyState';
import { getNotifications } from './actions';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { BildirimListesi } from './bildirim-listesi';

export const metadata = {
  title: 'Bildirimler — Kashe',
};

export default async function BildirimlerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Durum 1: Giriş yapmamış
  if (!user) {
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="mb-10">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
                Bildirimler
              </p>
              <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
                Önce{' '}
                <em className="text-terracotta not-italic italic font-medium">
                  giriş yap
                </em>
                .
              </h1>
            </div>
            <div className="bg-white border border-line rounded-lg p-12 text-center">
              <p className="font-display text-xl text-ink mb-3">
                Bildirimleri görmek için giriş yapmalısın.
              </p>
              <p className="text-ink-72 max-w-md mx-auto mb-6">
                Mesajların, yorumların ve etkileşimlerin tek yerde.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  href="/giris"
                  className="inline-block px-6 py-3 bg-terracotta text-paper font-mono text-xs uppercase tracking-[0.16em] rounded hover:bg-terracotta/90 transition-colors"
                >
                  Giriş yap
                </Link>
                <Link
                  href="/uye-ol"
                  className="inline-block px-6 py-3 border border-line text-ink font-mono text-xs uppercase tracking-[0.16em] rounded hover:border-terracotta hover:text-terracotta transition-colors"
                >
                  Kayıt ol
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Suspension kontrolü — askıdaki kullanıcı bildirim göremez
  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  // Bildirimleri çek
  const { notifications, error } = await getNotifications();

  // Durum 2: Hata
  if (error) {
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="bg-terracotta/10 border border-terracotta/30 rounded-lg p-6">
              <p className="text-terracotta text-sm">
                Bir sorun oluştu, lütfen sayfayı yenile.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Durum 3: Boş
  if (notifications.length === 0) {
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="mb-10">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
                Bildirimler
              </p>
              <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
                Henüz bildirim{' '}
                <em className="text-terracotta not-italic italic font-medium">
                  yok
                </em>
                .
              </h1>
            </div>
            <EmptyState
              icon={Bell}
              title="Ortalık sakin"
              description="Yeni bir şey olduğunda — mesaj, yorum, yanıt — sahne arkasından sana haber vereceğiz."
            />
          </div>
        </main>
      </>
    );
  }

  // Durum 4: Dolu — client component'e devret
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <BildirimListesi
            initialNotifications={notifications}
            initialUnreadCount={unreadCount}
          />
        </div>
      </main>
    </>
  );
}