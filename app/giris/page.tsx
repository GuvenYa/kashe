import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import GirisForm from './giris-form';

export const metadata = {
  title: 'Giriş yap — Kashe',
  description: 'Kashe hesabına giriş yap.',
};

export default async function GirisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/profil');
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <GirisForm />
      </div>
    </main>
  );
}