import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { SifremiUnuttumForm } from './sifremi-unuttum-form';

export const metadata = {
  title: 'Şifremi unuttum — Kashe',
  description: 'Şifreni sıfırlamak için email adresini gir.',
};

export default async function SifremiUnuttumPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Zaten login'se profilime yönlendir
  if (user) {
    redirect('/profil');
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <SifremiUnuttumForm />
        </div>
      </main>
    </>
  );
}