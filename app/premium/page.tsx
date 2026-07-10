import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/app/components/sections/top-nav';
import { PlanSecici } from './plan-secici';
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
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-3">
              Premium
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
              Öne çık, <em>daha çok iş al</em>
            </h1>
            <p className="text-ink-72 text-lg mt-4 max-w-2xl leading-relaxed">
              Premium üyelikle Keşfet listelerinde üst sıralarda yer al, profil
              rozetinle güven kazan, daha fazla müşteriye ulaş.
            </p>
          </div>

          <PlanSecici
            userRole={role}
            currentTier={tier}
            premiumActive={premiumActive}
            premiumUntil={premiumUntil}
          />
        </div>
      </main>
    </>
  );
}