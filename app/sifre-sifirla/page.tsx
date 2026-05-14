import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { SifreSifirlaForm } from './sifre-sifirla-form';
import { SifreSifirlaInvalid } from './sifre-sifirla-invalid';

export const metadata = {
  title: 'Şifreyi sıfırla — Kashe',
  description: 'Yeni şifreni belirle.',
};

export default async function SifreSifirlaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Session yoksa veya hata varsa invalid göster
  if (!session || params.error) {
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md">
            <SifreSifirlaInvalid />
          </div>
        </main>
      </>
    );
  }

  // Session var: yeni şifre formunu göster
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <SifreSifirlaForm />
        </div>
      </main>
    </>
  );
}