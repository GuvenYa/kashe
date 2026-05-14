import { TopNav } from '@/app/components/sections/top-nav';
import { SifreSifirlaForm } from './sifre-sifirla-form';

export const metadata = {
  title: 'Şifreyi sıfırla — Kashe',
  description: 'Yeni şifreni belirle.',
};

export default function SifreSifirlaPage() {
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