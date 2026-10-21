import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/app/components/sections/top-nav';
import { PlanSecici } from './plan-secici';
import { KoyuBolum } from '@/app/components/koyu-bolum';
import { getCachedUser } from '@/app/lib/auth';
import { isPremiumActive, type PremiumTier } from '@/app/lib/badges';

export const metadata = {
  title: 'Premium — Kashe',
};

export default async function PremiumPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris?redirect=/premium');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, premium_tier, premium_until, suspended_at')
    .eq('id', user.id)
    .single();

  if (profile?.suspended_at) {
    redirect('/askiya-alindi');
  }

  const role = profile?.role ?? 'client';
  const tier = (profile?.premium_tier ?? 'none') as PremiumTier;
  const premiumUntil = profile?.premium_until ?? null;
  const premiumActive = isPremiumActive(tier, premiumUntil);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper">
        {/* D4 — sayfanin ust basligi koyu bolum. Sayfanin TEK h1'i burada
            oldugu icin `basliketiketi="h1"`; metinler AYNEN. `em` koyu
            zeminde gorunsun diye `not-italic text-brand-accent` ile ezilir
            (globalde `em` = brand-ink). */}
        <KoyuBolum
          yogunluk="tam"
          basliketiketi="h1"
          eyebrow="Premium"
          isaret
          baslik={
            <>
              Öne çık,{' '}
              <em className="not-italic text-brand-accent">
                daha çok iş al
              </em>
            </>
          }
          altMetin="Premium üyelikle Keşfet listelerinde üst sıralarda yer al, profil rozetinle güven kazan, daha fazla müşteriye ulaş."
        />

        <div className="px-6 md:px-12 py-16">
          <div className="max-w-5xl mx-auto">
            <PlanSecici
              userRole={role}
              currentTier={tier}
              premiumActive={premiumActive}
              premiumUntil={premiumUntil}
            />
          </div>
        </div>
      </main>
    </>
  );
}