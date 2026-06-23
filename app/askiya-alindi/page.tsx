import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { Eyebrow } from '@/app/components/ui/eyebrow';

export const metadata = {
  title: 'Hesabın askıya alındı — Kashe',
  robots: { index: false, follow: false },
};

/**
 * Askıya alınan kullanıcıların gördüğü sayfa.
 *
 * - Giriş yapmamışsa → ana sayfaya yönlendirir.
 * - Giriş yapmış ama askıda değilse → ana sayfaya yönlendirir
 *   (yanlışlıkla buraya gelen aktif kullanıcı normal akışına dönsün).
 * - Askıda olan kullanıcı sebep + iletişim bilgisini görür.
 */
export default async function AskiyaAlindiPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, suspended_at, suspension_reason')
    .eq('id', user.id)
    .single();

  if (!profile?.suspended_at) {
    redirect('/');
  }

  const displayName = profile.full_name || user.email || '';

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center justify-center gap-2.5 mb-10"
        >
          <span className="w-8 h-8 bg-terracotta flex items-center justify-center text-paper font-display font-semibold italic text-xl leading-none rounded">
            k
          </span>
          <span className="font-display font-semibold text-2xl text-ink tracking-tight">
            Kashe
          </span>
        </Link>

        {/* Ana kart */}
        <div className="bg-card border border-line rounded-2xl p-7 md:p-8 shadow-[0_18px_40px_-18px_rgba(26,18,14,0.16)]">
          {/* İkon + eyebrow */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full bg-danger-08 border border-danger/30 flex items-center justify-center shrink-0">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 8v5M12 16h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke="var(--color-terracotta)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <Eyebrow variant="inline" className="!text-danger">
              Hesap askıda
            </Eyebrow>
          </div>

          {/* Başlık */}
          <h1 className="font-display font-light text-2xl md:text-3xl text-ink tracking-tight leading-[1.15] mb-3">
            Merhaba {displayName}, hesabın şu an{' '}
            <em className="text-danger">askıya alınmış</em>.
          </h1>

          <p className="text-[15px] text-ink-72 leading-relaxed mb-5">
            Bu durumda profilini görüntüleyemez, mesaj atamaz, teklif veya
            rezervasyon işlemi yapamazsın. Hesap geri açıldığında bildirim
            alacaksın.
          </p>

          {/* Sebep */}
          {profile.suspension_reason && (
            <div className="bg-paper-2/60 border border-line rounded-xl p-4 mb-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-2">
                Sebep
              </p>
              <p className="text-[14px] text-ink leading-relaxed whitespace-pre-line">
                {profile.suspension_reason}
              </p>
            </div>
          )}

          {/* İletişim CTA */}
          <a
            href="mailto:kasheofficial@gmail.com?subject=Hesap%20Askısı%20%C4%B0tirazı"
            className="kashe-tap inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-ink text-paper rounded-xl font-display font-semibold text-sm hover:bg-ink/85 transition shadow-[3px_3px_0_rgba(26,18,14,0.12)] mb-3"
          >
            kasheofficial@gmail.com&apos;a yaz
            <span>→</span>
          </a>

          {/* Çıkış */}
          <form action="/api/auth/cikis" method="POST">
            <button
              type="submit"
              className="kashe-tap w-full text-center text-[12px] font-mono uppercase tracking-[0.14em] text-ink-50 hover:text-ink transition-colors py-2"
            >
              Hesaptan çıkış yap
            </button>
          </form>
        </div>

        {/* Alt bilgi */}
        <p className="text-center text-[11px] text-ink-50 font-mono uppercase tracking-[0.14em] mt-6">
          Yanlışlıkla mı askıya alındın? · Bize yaz, inceleyelim
        </p>
      </div>
    </main>
  );
}
