import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { DavetPaneli } from './davet-paneli';

export const metadata = {
  title: 'Yetenek Havuzu Daveti — Kashe',
  robots: { index: false, follow: false },
};

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Davet baglantisi. Token ile TABLO SORGUSU YAPILMAZ (`invitation_token` sutunu
 * istemciye kapali); oturumsuz ziyaretciye kurulus adi da gosterilmez — token'i
 * dogrulayacak acik bir RPC yok, genel metin yeterli. Dogrulama sahiplenme aninda
 * `claim_talent_record` icinde olur.
 */
export default async function HavuzDavetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_KALIBI.test(token)) notFound();

  const user = await getCachedUser();
  const donusYolu = `/davet/havuz/${token}`;

  let rol: string | null = null;
  if (user) {
    const supabase = await createClient();
    const { data: profil } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    rol = (profil as { role: string } | null)?.role ?? null;
  }

  const rolUygun = rol === 'professional' || rol === 'agency';

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink mb-3">
            Yetenek havuzu daveti
          </p>
          <h1 className="font-display text-3xl md:text-4xl text-ink leading-tight">
            Bir kuruluş seni Kashe{' '}
            <em className="text-brand-ink not-italic italic font-medium">
              yetenek havuzuna
            </em>{' '}
            ekledi
          </h1>

          {!user && (
            <div className="mt-6 space-y-5">
              <p className="text-ink-72 leading-relaxed">
                Kashe&apos;de profesyonel ya da ajans hesabı olan kişi bu kaydı
                sahiplenebilir; kayıt profiline bağlanır. Hesabın yoksa
                profesyonel olarak kaydolabilirsin — kayıt ve e-posta
                doğrulaması sonrası bu sayfaya dönersin. Dönmezsen kaydı profil
                sayfandaki &quot;seni havuzuna ekledi&quot; bildiriminden de
                sahiplenebilirsin.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href={`/giris?redirect=${encodeURIComponent(donusYolu)}`}
                  className="kashe-tap px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
                >
                  Giriş yap
                </Link>
                <Link
                  href={`/uye-ol?rol=profesyonel&redirect=${encodeURIComponent(donusYolu)}`}
                  className="kashe-tap px-5 py-2.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors"
                >
                  Profesyonel olarak kaydol
                </Link>
              </div>
              <p className="text-xs text-ink-50">
                Davet bağlantısı 14 gün geçerlidir.
              </p>
            </div>
          )}

          {user && !rolUygun && (
            <div className="mt-6 space-y-5">
              <p className="text-ink-72 leading-relaxed">
                Bu davet profesyonel ve ajans hesapları için. Hesabın müşteri
                hesabı olduğu için kaydı sahiplenemezsin.
              </p>
              <Link
                href="/profil"
                className="kashe-tap inline-block px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
              >
                Profile dön
              </Link>
            </div>
          )}

          {user && rolUygun && <DavetPaneli token={token} />}
        </div>
      </main>
    </>
  );
}
