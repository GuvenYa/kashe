import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { sanitizeReturnPath } from '@/app/lib/safe-redirect';
import GirisForm from './giris-form';

export const metadata = {
  title: 'Giriş yap — Kashe',
  description: 'Kashe hesabına giriş yap.',
};

export default async function GirisPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = sanitizeReturnPath(params.redirect);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(redirectTo);
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <GirisForm redirectTo={redirectTo} />
        </div>
      </main>
    </>
  );
}