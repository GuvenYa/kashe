import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Bell } from 'lucide-react';
import { PanelKabugu } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { EmptyState } from '@/app/components/EmptyState';
import { getNotifications } from './actions';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCachedUser } from '@/app/lib/auth';
import { BildirimListesi } from './bildirim-listesi';
import { PushToggle } from './push-toggle';

export const metadata = {
  title: 'Bildirimler — Kashe',
};

export default async function BildirimlerPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  // Girissiz ziyaretci: diger panel sayfalariyla AYNI davranis (hijyen 04).
  // Eskiden vitrin duzeninde bir `PanelBaslik` karti ciziliyordu; panel
  // bileseni vitrinde kullanilmaz ve ayni bilgi iki dilde iki kez duruyordu.
  if (!user) redirect('/giris?redirect=/bildirimler');

  // Suspension kontrolü — askıdaki kullanıcı bildirim göremez
  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps();

  // Bildirimleri çek
  const { notifications, error } = await getNotifications();

  // Durum 2: Hata
  if (error) {
    return (
      <PanelKabugu {...kabuk}>
        <div className="max-w-3xl">
            <div className="bg-danger-08 border border-danger/30 rounded-lg p-6">
              <p className="text-danger text-sm">
                Bir sorun oluştu, lütfen sayfayı yenile.
              </p>
            </div>
          </div>
    </PanelKabugu>
  );
  }

  // Durum 3: Boş
  if (notifications.length === 0) {
    return (
      <PanelKabugu {...kabuk}>
        <div className="max-w-3xl">
            <div className="mb-10">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
                Bildirimler
              </p>
              <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink tracking-tight">
                Henüz bildirim{' '}
                <em className="not-italic font-medium text-brand-accent">
                  yok
                </em>
                .
              </h1>
            </div>
            <PushToggle />
            <EmptyState
              icon={Bell}
              title="Ortalık sakin"
              description="Yeni bir şey olduğunda — mesaj, yorum, yanıt — sahne arkasından sana haber vereceğiz."
            />
          </div>
    </PanelKabugu>
  );
  }

  // Durum 4: Dolu — client component'e devret
  const unreadCount = notifications.filter((n) => !n.read_at).length;


  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-3xl">
          <PushToggle />
          <BildirimListesi
            initialNotifications={notifications}
            initialUnreadCount={unreadCount}
          />
        </div>
    </PanelKabugu>
  );
}